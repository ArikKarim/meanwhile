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
import { supabase } from '@/integrations/supabase/client';

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
  const [saving, setSaving] = useState(false);
  // Cursor tracking disabled
  // const [cursors, setCursors] = useState<CursorPosition[]>([]);
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
          
          // Load initial collaborators (cursors disabled)
          const initialCollaborators = await getNotepadCollaborators(foundNotepad.id);
          setCollaborators(initialCollaborators);

          // Set up simplified real-time subscriptions
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

  // Real-time event handlers - simplified
  const handleNotepadUpdate = useCallback((updatedNotepad: Notepad) => {
    // Only update if the content is different and we're not currently editing
    if (updatedNotepad.content !== content && !isApplyingOperation.current) {
      console.log('📝 Notepad updated from remote:', updatedNotepad.id);
      setNotepad(updatedNotepad);
      setContent(updatedNotepad.content);
      setTitle(updatedNotepad.title);
    }
  }, [content]);

  // Simplified operation handling - just refresh content from server
  const handleOperationUpdate = useCallback((operation: NotepadOperation) => {
    if (operation.user_id === user?.id) return; // Skip our own operations
    
    console.log('🔄 Remote operation detected, refreshing content...');
    
    // Simple approach: fetch latest content instead of applying operations
    const refreshContent = async () => {
      try {
        const { data: freshNotepad, error } = await supabase
          .from('notepads')
          .select('*')
          .eq('id', notepad?.id)
          .single();
        
        if (!error && freshNotepad && freshNotepad.content !== content) {
          setContent(freshNotepad.content);
          setNotepad(freshNotepad);
        }
      } catch (error) {
        console.error('Error refreshing notepad content:', error);
      }
    };
    
    // Debounce refresh to avoid too many calls
    setTimeout(refreshContent, 500);
  }, [user?.id, notepad?.id, content]);

  // Cursor update handler disabled
  const handleCursorUpdate = useCallback((cursor: NotepadCursor) => {
    // Cursor tracking disabled - no action taken
  }, []);

  const handleCollaboratorUpdate = useCallback((collaborator: NotepadCollaborator) => {
    setCollaborators(prevCollaborators => {
      const others = prevCollaborators.filter(c => c.user_id !== collaborator.user_id);
      if (collaborator.is_active) {
        return [...others, collaborator];
      }
      return others;
    });
  }, []);

  // Cursor position update disabled
  // const debouncedUpdateCursor = useCallback(
  //   debounce(async (position: number, selectionStart?: number, selectionEnd?: number) => {
  //     if (notepad) {
  //       await updateCursorPosition(notepad.id, position, selectionStart, selectionEnd);
  //     }
  //   }, 100),
  //   [notepad]
  // );

  // Debounced save function to reduce database calls
  const debouncedSave = useCallback(
    debounce(async (content: string) => {
      if (!notepad || !user) return;
      
      try {
        setSaving(true);
        console.log('💾 Saving notepad content...');
        
        // Simple direct content update to avoid operational transform complexity
        const { error } = await supabase
          .from('notepads')
          .update({ 
            content: content, 
            last_updated_by: user.id,
            updated_at: new Date().toISOString() 
          })
          .eq('id', notepad.id);
        
        if (error) {
          console.error('❌ Error saving notepad content:', error);
          toast({
            title: 'Save failed',
            description: 'Failed to save notepad changes',
            variant: 'destructive'
          });
        } else {
          console.log('✅ Notepad content saved successfully');
        }
      } catch (error) {
        console.error('❌ Error in debouncedSave:', error);
      } finally {
        setSaving(false);
      }
    }, 1000), // Save after 1 second of no changes
    [notepad, user, toast]
  );

  // Handle text changes - simplified approach
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!notepad || !user) return;

    const newContent = e.target.value;
    
    // Update local content immediately for responsive UI
    setContent(newContent);
    
    // Debounced save to database
    debouncedSave(newContent);
  };

  // Handle cursor position changes (disabled)
  const handleSelectionChange = useCallback(() => {
    // Cursor tracking disabled - no longer sending cursor position updates
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      currentCursorPosition.current = start;
    }
  }, []);

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
          
          {/* Cursor rendering disabled */}
        </div>
        
        <div className="mt-2 flex justify-between items-center text-xs text-muted-foreground">
          <span>
            {notepad.last_updated_by && (
              <>Last updated by {collaborators.find(c => c.user_id === notepad.last_updated_by)?.user_name || 'Unknown'}</>
            )}
          </span>
          <span className="flex items-center gap-1">
            {saving && (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b border-primary"></div>
                Saving...
              </>
            )}
            {!saving && (
              <span className="text-green-600">✓ Saved</span>
            )}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CollaborativeNotepad;
