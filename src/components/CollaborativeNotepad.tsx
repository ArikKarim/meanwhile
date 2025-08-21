import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { FileText, Users, Edit3, Save, X } from 'lucide-react';
import type { Notepad, NotepadCollaborator, NotepadCursor, NotepadOperation } from '@/types';
import { getUserColorFromId, getDisplayName } from '@/utils/colorUtils';
import { debounce } from '@/utils/debounce';
import {
  createOrGetGroupNotepad,
  joinNotepadCollaboration,
  leaveNotepadCollaboration,
  updateCursorPosition,
  applyNotepadOperation,
  getNotepadCollaborators,
  getNotepadCursors,
  updateNotepadTitle,
  subscribeToNotepadChanges
} from '@/services/notepadService';

interface CollaborativeNotepadProps {
  groupId: string;
  onClose?: () => void;
}

interface CursorPosition {
  userId: string;
  userName: string;
  userColor: string;
  position: number;
  selectionStart?: number;
  selectionEnd?: number;
}

const CollaborativeNotepad: React.FC<CollaborativeNotepadProps> = ({ groupId, onClose }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State
  const [notepad, setNotepad] = useState<Notepad | null>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [collaborators, setCollaborators] = useState<NotepadCollaborator[]>([]);
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  const [lastSequenceNumber, setLastSequenceNumber] = useState<number>(0);
  
  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const isApplyingOperation = useRef(false);
  const currentCursorPosition = useRef(0);

  // Initialize notepad
  useEffect(() => {
    const initializeNotepad = async () => {
      if (!user) return;

      try {
        const { notepad: foundNotepad, error } = await createOrGetGroupNotepad(groupId);
        
        if (error) {
          toast({
            title: 'Error loading notepad',
            description: error,
            variant: 'destructive'
          });
          return;
        }

        if (foundNotepad) {
          setNotepad(foundNotepad);
          setContent(foundNotepad.content);
          setTitle(foundNotepad.title);

          // Join collaboration
          const userColor = getUserColorFromId(user.id);
          const userName = getDisplayName(user);
          
          await joinNotepadCollaboration(foundNotepad.id, userName, userColor);
          
          // Load initial collaborators and cursors
          const [initialCollaborators, initialCursors] = await Promise.all([
            getNotepadCollaborators(foundNotepad.id),
            getNotepadCursors(foundNotepad.id)
          ]);
          
          setCollaborators(initialCollaborators);
          setCursors(initialCursors.map(cursor => ({
            userId: cursor.user_id,
            userName: initialCollaborators.find(c => c.user_id === cursor.user_id)?.user_name || 'Unknown',
            userColor: initialCollaborators.find(c => c.user_id === cursor.user_id)?.user_color || '#3b82f6',
            position: cursor.position,
            selectionStart: cursor.selection_start || undefined,
            selectionEnd: cursor.selection_end || undefined
          })));

          // Set up real-time subscriptions
          cleanupRef.current = subscribeToNotepadChanges(
            foundNotepad.id,
            handleNotepadUpdate,
            handleOperationUpdate,
            handleCursorUpdate,
            handleCollaboratorUpdate
          );
        }
      } catch (error) {
        console.error('Error initializing notepad:', error);
        toast({
          title: 'Error',
          description: 'Failed to load notepad',
          variant: 'destructive'
        });
      } finally {
        setLoading(false);
      }
    };

    initializeNotepad();

    // Cleanup on unmount
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
      if (notepad && user) {
        leaveNotepadCollaboration(notepad.id);
      }
    };
  }, [groupId, user]);

  // Real-time event handlers
  const handleNotepadUpdate = useCallback((updatedNotepad: Notepad) => {
    if (!isApplyingOperation.current) {
      setNotepad(updatedNotepad);
      setContent(updatedNotepad.content);
      setTitle(updatedNotepad.title);
    }
  }, []);

  const handleOperationUpdate = useCallback((operation: NotepadOperation) => {
    if (operation.user_id === user?.id) return; // Skip our own operations
    
    setLastSequenceNumber(Math.max(lastSequenceNumber, operation.sequence_number));
    
    // Apply the operation to local content
    setContent(prevContent => {
      let newContent = prevContent;
      
      if (operation.operation_type === 'insert' && operation.content) {
        newContent = prevContent.slice(0, operation.position) + 
                    operation.content + 
                    prevContent.slice(operation.position);
      } else if (operation.operation_type === 'delete' && operation.length) {
        newContent = prevContent.slice(0, operation.position) + 
                    prevContent.slice(operation.position + operation.length);
      }
      
      return newContent;
    });
  }, [user?.id, lastSequenceNumber]);

  const handleCursorUpdate = useCallback((cursor: NotepadCursor) => {
    if (cursor.user_id === user?.id) return; // Skip our own cursor
    
    setCursors(prevCursors => {
      const otherCursors = prevCursors.filter(c => c.userId !== cursor.user_id);
      const collaborator = collaborators.find(c => c.user_id === cursor.user_id);
      
      if (collaborator) {
        return [...otherCursors, {
          userId: cursor.user_id,
          userName: collaborator.user_name,
          userColor: collaborator.user_color,
          position: cursor.position,
          selectionStart: cursor.selection_start || undefined,
          selectionEnd: cursor.selection_end || undefined
        }];
      }
      
      return otherCursors;
    });
  }, [user?.id, collaborators]);

  const handleCollaboratorUpdate = useCallback((collaborator: NotepadCollaborator) => {
    setCollaborators(prevCollaborators => {
      const others = prevCollaborators.filter(c => c.user_id !== collaborator.user_id);
      if (collaborator.is_active) {
        return [...others, collaborator];
      }
      return others;
    });
  }, []);

  // Debounced cursor position update
  const debouncedUpdateCursor = useCallback(
    debounce(async (position: number, selectionStart?: number, selectionEnd?: number) => {
      if (notepad) {
        await updateCursorPosition(notepad.id, position, selectionStart, selectionEnd);
      }
    }, 100),
    [notepad]
  );

  // Handle text changes
  const handleContentChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!notepad || !user) return;

    const newContent = e.target.value;
    const prevContent = content;
    
    // Find the difference and create operation
    let operationType: 'insert' | 'delete' = 'insert';
    let position = 0;
    let operationContent = '';
    let operationLength = 0;

    if (newContent.length > prevContent.length) {
      // Insert operation
      operationType = 'insert';
      // Find insertion point
      for (let i = 0; i < Math.min(newContent.length, prevContent.length); i++) {
        if (newContent[i] !== prevContent[i]) {
          position = i;
          break;
        }
      }
      if (position === 0 && newContent.length > prevContent.length) {
        position = prevContent.length;
      }
      operationContent = newContent.slice(position, position + (newContent.length - prevContent.length));
    } else if (newContent.length < prevContent.length) {
      // Delete operation
      operationType = 'delete';
      // Find deletion point
      for (let i = 0; i < Math.min(newContent.length, prevContent.length); i++) {
        if (newContent[i] !== prevContent[i]) {
          position = i;
          break;
        }
      }
      if (position === 0 && newContent.length < prevContent.length) {
        position = newContent.length;
      }
      operationLength = prevContent.length - newContent.length;
    }

    // Update local content immediately for responsive UI
    setContent(newContent);

    // Apply operation to database
    if (operationType === 'insert' && operationContent) {
      isApplyingOperation.current = true;
      const { sequenceNumber } = await applyNotepadOperation(
        notepad.id, 
        'insert', 
        position, 
        operationContent
      );
      if (sequenceNumber) {
        setLastSequenceNumber(sequenceNumber);
      }
      isApplyingOperation.current = false;
    } else if (operationType === 'delete' && operationLength > 0) {
      isApplyingOperation.current = true;
      const { sequenceNumber } = await applyNotepadOperation(
        notepad.id, 
        'delete', 
        position, 
        undefined, 
        operationLength
      );
      if (sequenceNumber) {
        setLastSequenceNumber(sequenceNumber);
      }
      isApplyingOperation.current = false;
    }
  };

  // Handle cursor position changes
  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      currentCursorPosition.current = start;
      
      debouncedUpdateCursor(
        start, 
        start !== end ? start : undefined, 
        start !== end ? end : undefined
      );
    }
  }, [debouncedUpdateCursor]);

  // Handle title update
  const handleTitleSave = async () => {
    if (!notepad) return;

    const result = await updateNotepadTitle(notepad.id, title);
    if (result.success) {
      setEditingTitle(false);
      toast({
        title: 'Title updated',
        description: 'Notepad title has been saved'
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to update title',
        variant: 'destructive'
      });
    }
  };

  // Get active collaborators (excluding current user)
  const activeCollaborators = collaborators.filter(c => c.user_id !== user?.id && c.is_active);

  if (loading) {
    return (
      <Card className="w-full h-96">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading notepad...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!notepad) {
    return (
      <Card className="w-full h-96">
        <CardContent className="flex items-center justify-center h-full">
          <div className="text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">Failed to load notepad</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <FileText className="h-5 w-5 text-primary" />
            {editingTitle ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleTitleSave();
                    } else if (e.key === 'Escape') {
                      setTitle(notepad.title);
                      setEditingTitle(false);
                    }
                  }}
                  className="text-lg font-semibold"
                  autoFocus
                />
                <Button size="sm" onClick={handleTitleSave}>
                  <Save className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={() => {
                    setTitle(notepad.title);
                    setEditingTitle(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <CardTitle 
                className="text-lg cursor-pointer hover:text-primary flex items-center gap-2"
                onClick={() => setEditingTitle(true)}
              >
                {title}
                <Edit3 className="h-4 w-4 opacity-50" />
              </CardTitle>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Active collaborators */}
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4 text-muted-foreground" />
              {activeCollaborators.length === 0 ? (
                <span className="text-sm text-muted-foreground">Just you</span>
              ) : (
                <div className="flex gap-1">
                  {activeCollaborators.map((collaborator) => (
                    <Badge 
                      key={collaborator.user_id} 
                      variant="outline" 
                      className="text-xs"
                      style={{ 
                        borderColor: collaborator.user_color,
                        color: collaborator.user_color 
                      }}
                    >
                      {collaborator.user_name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            {onClose && (
              <Button variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        
        <CardDescription>
          Collaborative notepad for group ideas and notes
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onSelect={handleSelectionChange}
            onKeyUp={handleSelectionChange}
            onClick={handleSelectionChange}
            placeholder="Start typing your ideas here... (changes save automatically)"
            className="w-full h-96 p-4 border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            style={{ 
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              lineHeight: '1.5'
            }}
          />
          
          {/* Render other users' cursors */}
          {cursors.map((cursor) => (
            <div
              key={cursor.userId}
              className="absolute pointer-events-none"
              style={{
                left: '1rem', // Approximate position - would need more complex calculation
                top: `${1 + (cursor.position * 1.5)}rem`, // Rough calculation
                borderLeft: `2px solid ${cursor.userColor}`,
                height: '1.5rem',
                zIndex: 10
              }}
            >
              <div 
                className="absolute -top-6 left-0 px-1 py-0.5 text-xs text-white rounded"
                style={{ backgroundColor: cursor.userColor }}
              >
                {cursor.userName}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-2 text-xs text-muted-foreground">
          {notepad.last_updated_by && (
            <span>
              Last updated by {collaborators.find(c => c.user_id === notepad.last_updated_by)?.user_name || 'Unknown'}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default CollaborativeNotepad;
