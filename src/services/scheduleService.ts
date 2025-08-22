// Service for managing schedule operations

import { supabase } from '@/integrations/supabase/client';
import type { TimeBlock } from '@/types';
import { timeToMinutes } from '@/utils/timeUtils';

/**
 * Ensure user session is set for RLS
 */
const ensureUserSession = async (userId: string): Promise<void> => {
  try {
    await supabase.rpc('set_session_user', { user_id: userId });
    console.log('🔒 Session user set for schedule operation:', userId);
  } catch (error) {
    console.error('❌ Failed to set session user:', error);
    throw new Error('Authentication failed. Please refresh the page and try again.');
  }
};

/**
 * Fetch all time blocks
 */
export const getTimeBlocks = async (): Promise<TimeBlock[]> => {
  try {
    const { data, error } = await supabase
      .from('time_blocks')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching time blocks:', error);
    return [];
  }
};

/**
 * Save multiple time blocks
 */
export const saveTimeBlocks = async (
  timeBlocks: Omit<TimeBlock, 'id' | 'created_at'>[]
): Promise<TimeBlock[]> => {
  try {
    console.log('💾 Attempting to save time blocks:', { count: timeBlocks.length, timeBlocks });
    
    // Try to set user session but don't fail if it doesn't work
    if (timeBlocks.length > 0) {
      try {
        await ensureUserSession(timeBlocks[0].user_id);
      } catch (sessionError) {
        console.warn('⚠️ Session setup failed, proceeding without RLS:', sessionError);
      }
    }
    
    const { data, error } = await supabase
      .from('time_blocks')
      .insert(timeBlocks)
      .select();
    
    if (error) {
      console.error('❌ Database error saving time blocks:', error);
      throw error;
    }
    
    console.log('✅ Time blocks saved successfully:', { count: data?.length, data });
    return data || [];
  } catch (error) {
    console.error('❌ Error saving time blocks:', error);
    throw error; // Re-throw to let caller handle the error properly
  }
};

/**
 * Copy schedule from one group to another
 */
export const copyScheduleToGroup = async (
  sourceGroupId: string, 
  targetGroupId: string, 
  userId: string
): Promise<boolean> => {
  try {
    // Get all time blocks for the user in the source group
    const { data: sourceTimeBlocks, error: fetchError } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('group_id', sourceGroupId)
      .eq('user_id', userId);

    if (fetchError) throw fetchError;

    if (!sourceTimeBlocks || sourceTimeBlocks.length === 0) {
      throw new Error('No schedules found in the source group to copy.');
    }

    // Check for existing schedules in target group that might overlap
    const { data: targetTimeBlocks, error: targetFetchError } = await supabase
      .from('time_blocks')
      .select('*')
      .eq('group_id', targetGroupId)
      .eq('user_id', userId);

    if (targetFetchError) throw targetFetchError;

    // Prepare new time blocks for insertion (remove id and created_at, update group_id)
    const newTimeBlocks = sourceTimeBlocks.map(block => ({
      user_id: block.user_id,
      group_id: targetGroupId,
      label: block.label,
      day_of_week: block.day_of_week,
      start_time: block.start_time,
      end_time: block.end_time,
      color: block.color,
      tag: block.tag
    }));

    // Check for overlaps with existing blocks in target group
    const overlaps: any[] = [];
    if (targetTimeBlocks && targetTimeBlocks.length > 0) {
      newTimeBlocks.forEach(newBlock => {
        targetTimeBlocks.forEach(existingBlock => {
          if (newBlock.day_of_week === existingBlock.day_of_week) {
            const newStart = timeToMinutes(newBlock.start_time);
            const newEnd = timeToMinutes(newBlock.end_time);
            const existingStart = timeToMinutes(existingBlock.start_time);
            const existingEnd = timeToMinutes(existingBlock.end_time);
            
            // Check for overlap
            if (newStart < existingEnd && existingStart < newEnd) {
              overlaps.push({
                new: newBlock,
                existing: existingBlock
              });
            }
          }
        });
      });
    }

    if (overlaps.length > 0) {
      throw new Error(`Cannot copy schedules: ${overlaps.length} time conflict(s) detected with your existing schedule in the target group.`);
    }

    // Insert the new time blocks
    const { data: insertedBlocks, error: insertError } = await supabase
      .from('time_blocks')
      .insert(newTimeBlocks)
      .select();

    if (insertError) throw insertError;

    return true;
  } catch (error) {
    console.error('Error copying schedule:', error);
    throw error;
  }
};
