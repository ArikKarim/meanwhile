// Service for managing collaborative notepad operations

import { supabase } from '@/integrations/supabase/client';
import type { Notepad, NotepadOperation, NotepadCursor, NotepadCollaborator } from '@/types';

/**
 * Create or get a notepad for a group
 */
export const createOrGetGroupNotepad = async (groupId: string): Promise<{ notepad: Notepad | null; error?: string }> => {
  try {
    // First try to get existing notepad
    const { data: existingNotepad, error: fetchError } = await supabase
      .from('notepads')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (!fetchError && existingNotepad) {
      return { notepad: existingNotepad };
    }

    // Create new notepad using the database function
    const { data: notepadId, error: createError } = await supabase
      .rpc('create_group_notepad', { p_group_id: groupId });

    if (createError) {
      console.error('Error creating notepad:', createError);
      return { notepad: null, error: createError.message };
    }

    // Fetch the created notepad
    const { data: newNotepad, error: newFetchError } = await supabase
      .from('notepads')
      .select('*')
      .eq('id', notepadId)
      .single();

    if (newFetchError) {
      console.error('Error fetching created notepad:', newFetchError);
      return { notepad: null, error: newFetchError.message };
    }

    return { notepad: newNotepad };
  } catch (error) {
    console.error('Error in createOrGetGroupNotepad:', error);
    return { 
      notepad: null, 
      error: error instanceof Error ? error.message : 'Failed to create or get notepad' 
    };
  }
};

/**
 * Join notepad collaboration
 */
export const joinNotepadCollaboration = async (
  notepadId: string, 
  userName: string, 
  userColor: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.rpc('join_notepad_collaboration', {
      p_notepad_id: notepadId,
      p_user_name: userName,
      p_user_color: userColor
    });

    if (error) {
      console.error('Error joining collaboration:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in joinNotepadCollaboration:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to join collaboration' 
    };
  }
};

/**
 * Leave notepad collaboration
 */
export const leaveNotepadCollaboration = async (notepadId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.rpc('leave_notepad_collaboration', {
      p_notepad_id: notepadId
    });

    if (error) {
      console.error('Error leaving collaboration:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in leaveNotepadCollaboration:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to leave collaboration' 
    };
  }
};

/**
 * Update cursor position
 */
export const updateCursorPosition = async (
  notepadId: string,
  position: number,
  selectionStart?: number,
  selectionEnd?: number
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.rpc('update_notepad_cursor', {
      p_notepad_id: notepadId,
      p_position: position,
      p_selection_start: selectionStart,
      p_selection_end: selectionEnd
    });

    if (error) {
      console.error('Error updating cursor:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateCursorPosition:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update cursor' 
    };
  }
};

/**
 * Apply notepad operation (insert, delete, retain)
 */
export const applyNotepadOperation = async (
  notepadId: string,
  operationType: 'insert' | 'delete' | 'retain',
  position: number,
  content?: string,
  length?: number
): Promise<{ sequenceNumber: number | null; error?: string }> => {
  try {
    const { data: sequenceNumber, error } = await supabase.rpc('apply_notepad_operation', {
      p_notepad_id: notepadId,
      p_operation_type: operationType,
      p_position: position,
      p_content: content,
      p_length: length
    });

    if (error) {
      console.error('Error applying operation:', error);
      return { sequenceNumber: null, error: error.message };
    }

    return { sequenceNumber };
  } catch (error) {
    console.error('Error in applyNotepadOperation:', error);
    return { 
      sequenceNumber: null, 
      error: error instanceof Error ? error.message : 'Failed to apply operation' 
    };
  }
};

/**
 * Get notepad collaborators
 */
export const getNotepadCollaborators = async (notepadId: string): Promise<NotepadCollaborator[]> => {
  try {
    const { data, error } = await supabase
      .from('notepad_collaborators')
      .select('*')
      .eq('notepad_id', notepadId)
      .eq('is_active', true)
      .order('last_seen', { ascending: false });

    if (error) {
      console.error('Error fetching collaborators:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getNotepadCollaborators:', error);
    return [];
  }
};

/**
 * Get notepad cursors
 */
export const getNotepadCursors = async (notepadId: string): Promise<NotepadCursor[]> => {
  try {
    const { data, error } = await supabase
      .from('notepad_cursors')
      .select('*')
      .eq('notepad_id', notepadId);

    if (error) {
      console.error('Error fetching cursors:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getNotepadCursors:', error);
    return [];
  }
};

/**
 * Get recent notepad operations (for conflict resolution)
 */
export const getRecentNotepadOperations = async (
  notepadId: string,
  afterSequence?: number
): Promise<NotepadOperation[]> => {
  try {
    let query = supabase
      .from('notepad_operations')
      .select('*')
      .eq('notepad_id', notepadId)
      .order('sequence_number', { ascending: true });

    if (afterSequence !== undefined) {
      query = query.gt('sequence_number', afterSequence);
    }

    const { data, error } = await query.limit(100); // Limit to prevent large responses

    if (error) {
      console.error('Error fetching operations:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getRecentNotepadOperations:', error);
    return [];
  }
};

/**
 * Update notepad title
 */
export const updateNotepadTitle = async (
  notepadId: string, 
  title: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('notepads')
      .update({ title })
      .eq('id', notepadId);

    if (error) {
      console.error('Error updating title:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateNotepadTitle:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update title' 
    };
  }
};

/**
 * Subscribe to notepad changes
 */
export const subscribeToNotepadChanges = (
  notepadId: string,
  onNotepadUpdate: (notepad: Notepad) => void,
  onOperationUpdate: (operation: NotepadOperation) => void,
  onCursorUpdate: (cursor: NotepadCursor) => void,
  onCollaboratorUpdate: (collaborator: NotepadCollaborator) => void
) => {
  // Subscribe to notepad content changes
  const notepadSubscription = supabase
    .channel(`notepad:${notepadId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'notepads',
        filter: `id=eq.${notepadId}`
      },
      (payload) => {
        onNotepadUpdate(payload.new as Notepad);
      }
    )
    .subscribe();

  // Subscribe to operations
  const operationsSubscription = supabase
    .channel(`notepad_operations:${notepadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notepad_operations',
        filter: `notepad_id=eq.${notepadId}`
      },
      (payload) => {
        onOperationUpdate(payload.new as NotepadOperation);
      }
    )
    .subscribe();

  // Subscribe to cursor changes
  const cursorsSubscription = supabase
    .channel(`notepad_cursors:${notepadId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notepad_cursors',
        filter: `notepad_id=eq.${notepadId}`
      },
      (payload) => {
        if (payload.new) {
          onCursorUpdate(payload.new as NotepadCursor);
        }
      }
    )
    .subscribe();

  // Subscribe to collaborator changes
  const collaboratorsSubscription = supabase
    .channel(`notepad_collaborators:${notepadId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'notepad_collaborators',
        filter: `notepad_id=eq.${notepadId}`
      },
      (payload) => {
        if (payload.new) {
          onCollaboratorUpdate(payload.new as NotepadCollaborator);
        }
      }
    )
    .subscribe();

  // Return cleanup function
  return () => {
    notepadSubscription.unsubscribe();
    operationsSubscription.unsubscribe();
    cursorsSubscription.unsubscribe();
    collaboratorsSubscription.unsubscribe();
  };
};
