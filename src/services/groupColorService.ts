// Service for managing group-specific user colors

import { supabase } from '@/integrations/supabase/client';
import type { UserColors } from '@/types';
import { getUserColorFromId, normalizeColor } from '@/utils/colorUtils';

/**
 * Fetch all user colors for a specific group
 */
export const fetchGroupColors = async (groupId: string): Promise<UserColors> => {
  try {
    const { data, error } = await supabase
      .from('user_group_colors')
      .select('user_id, color')
      .eq('group_id', groupId);
    
    if (error) throw error;
    
    const colorMap: UserColors = {};
    data?.forEach(record => {
      colorMap[record.user_id] = record.color;
    });
    
    return colorMap;
  } catch (error) {
    console.error('Error fetching group colors:', error);
    return {};
  }
};

/**
 * Set user color for a group using the atomic RPC function
 */
export const setUserColorForGroup = async (
  userId: string, 
  groupId: string, 
  color: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const normalized = normalizeColor(color);
    console.log('Calling set_user_color RPC with:', { 
      p_user_id: userId, 
      p_group_id: groupId, 
      p_color: normalized 
    });
    
    const { data, error } = await supabase.rpc('set_user_color', {
      p_user_id: userId,
      p_group_id: groupId,
      p_color: normalized,
    });
    
    if (error) {
      console.error('RPC error:', error);
      
      // Handle specific error cases
      if (error.message?.includes('color_taken')) {
        return { success: false, error: 'color_taken' };
      }
      if (error.message?.includes('not_group_member')) {
        return { success: false, error: 'not_group_member' };
      }
      
      return { success: false, error: error.message || 'Unknown error' };
    }
    
    console.log('RPC success, returned color:', data);
    return { success: true };
  } catch (error) {
    console.error('Error setting user color via RPC:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

/**
 * Check if a color is taken in a group (excluding a specific user)
 */
export const isColorTakenInGroup = async (
  color: string, 
  groupId: string, 
  excludeUserId?: string
): Promise<boolean> => {
  try {
    const normalizedColor = normalizeColor(color);
    const { data, error } = await supabase
      .from('user_group_colors')
      .select('user_id')
      .eq('group_id', groupId)
      .filter('color', 'ilike', normalizedColor)
      .neq('user_id', excludeUserId || '');
      
    if (error) throw error;
    return (data && data.length > 0) || false;
  } catch (error) {
    console.error('Error checking if color is taken:', error);
    return false;
  }
};

/**
 * Ensure user has a color assigned in database
 */
export const ensureUserColorInDatabase = async (
  userId: string, 
  groupId: string
): Promise<string> => {
  try {
    // Check if user already has a color in database
    const { data: existingColor, error: fetchError } = await supabase
      .from('user_group_colors')
      .select('color')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .single();
    
    if (!fetchError && existingColor) {
      return existingColor.color;
    }
    
    // Try to use database function to assign color if not found
    try {
      const { data: assignedColor, error: assignError } = await supabase
        .rpc('assign_user_color_in_group', {
          p_user_id: userId,
          p_group_id: groupId
        });
      
      if (!assignError && assignedColor) {
        return assignedColor;
      }
      
      console.warn('Database function failed, using fallback color assignment:', assignError);
    } catch (rpcError) {
      console.warn('RPC function not available, using fallback color assignment:', rpcError);
    }
    
    // Fallback: create a basic database entry with hash-based color
    const fallbackColor = getUserColorFromId(userId);
    const result = await setUserColorForGroup(userId, groupId, fallbackColor);
    
    if (result.success) {
      return fallbackColor;
    }
    
    return fallbackColor;
  } catch (error) {
    console.error('Error ensuring user color in database:', error);
    return getUserColorFromId(userId);
  }
};
