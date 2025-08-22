import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit3, Trash2, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface TimeBlock {
  id: string;
  user_id: string;
  label: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  color: string;
  tag: string;
  displayName?: string;
}

interface WeeklyCalendarProps {
  groupId: string;
  viewMode: 'busy' | 'free';
  visibleUsers?: Set<string>;
  startHour?: number;
  endHour?: number;
  weekStartDay?: 'sunday' | 'monday';
  userColors?: UserColors;
  groupColors?: {[userId: string]: string};
}

const DAYS_SUNDAY_START = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_MONDAY_START = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// User color system
interface UserColors {
  [userId: string]: string;
}

// Predefined color palette for auto-assignment (same as Index.tsx)
const DEFAULT_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red  
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
];

// Helper function for color assignment
const getUserColor = (userId: string): string => {
  // Auto-assign a color based on user ID hash
  const hashCode = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const colorIndex = Math.abs(hashCode) % DEFAULT_COLORS.length;
  return DEFAULT_COLORS[colorIndex];
};



// Category options (no colors, just tags)
const CATEGORIES = [
  { label: 'Class', value: 'class' },
  { label: 'Work', value: 'work' },
  { label: 'Personal', value: 'personal' },
  { label: 'Other', value: 'other' }
];

// Overlap detection utilities
const timeToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

const doTimeBlocksOverlap = (block1: TimeBlock, block2: TimeBlock): boolean => {
  // Only check if they're on the same day
  if (block1.day_of_week !== block2.day_of_week) return false;
  
  const start1 = timeToMinutes(block1.start_time);
  const end1 = timeToMinutes(block1.end_time);
  const start2 = timeToMinutes(block2.start_time);
  const end2 = timeToMinutes(block2.end_time);
  
  // Check if there's any overlap
  return start1 < end2 && start2 < end1;
};

const getOverlapLevel = (block: TimeBlock, allBlocks: TimeBlock[]): { selfOverlap: boolean, otherOverlap: boolean } => {
  let selfOverlap = false;
  let otherOverlap = false;
  
  allBlocks.forEach(otherBlock => {
    if (otherBlock.id !== block.id && doTimeBlocksOverlap(block, otherBlock)) {
      if (otherBlock.user_id === block.user_id) {
        selfOverlap = true;
      } else {
        otherOverlap = true;
      }
    }
  });
  
  return { selfOverlap, otherOverlap };
};

// Simple localStorage access
const TIME_BLOCKS_KEY = 'meanwhile_time_blocks';
const USERS_KEY = 'meanwhile_users';
const GROUP_MEMBERS_KEY = 'meanwhile_group_members';

interface StoredUser {
  id: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
}

interface StoredTimeBlock {
  id: string;
  user_id: string;
  group_id: string;
  label: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  color: string;
  tag: string;
  created_at: string;
}

const getTimeBlocks = async (): Promise<StoredTimeBlock[]> => {
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

const saveTimeBlock = async (timeBlock: Omit<StoredTimeBlock, 'id' | 'created_at'>): Promise<StoredTimeBlock | null> => {
  try {
    // Try to set session for RLS but don't fail if it doesn't work
    try {
      await supabase.rpc('set_session_user', { user_id: timeBlock.user_id });
    } catch (sessionError) {
      console.warn('⚠️ Session setup failed, proceeding anyway:', sessionError);
    }
    
    const { data, error } = await supabase
      .from('time_blocks')
      .insert([timeBlock])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving time block:', error);
    return null;
  }
};

const updateTimeBlock = async (id: string, updates: Partial<StoredTimeBlock>): Promise<StoredTimeBlock | null> => {
  try {
    const { data, error } = await supabase
      .from('time_blocks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating time block:', error);
    return null;
  }
};

const deleteTimeBlock = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('time_blocks')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting time block:', error);
    return false;
  }
};

const getUsers = async (groupId?: string): Promise<StoredUser[]> => {
  try {
    if (!groupId) {
      console.warn('No groupId provided for getUsers');
      return [];
    }

    // Use the same approach as Index.tsx - JOIN query to get group members with profiles
    const { data: memberData, error } = await supabase
      .from('group_members')
      .select(`
        user_id,
        profiles!inner(user_id, username, first_name, last_name)
      `)
      .eq('group_id', groupId);
    
    console.log('Group members with profiles query result:', { data: memberData, error });
    
    if (error) {
      console.error('Error fetching group members with profiles:', error);
      return [];
    }

    if (!memberData || memberData.length === 0) {
      console.warn('No group members found for groupId:', groupId);
      return [];
    }

    // Convert to StoredUser format
    const convertedUsers = memberData.map((member: any) => ({
      id: member.user_id,
      username: member.profiles.username || 'Unknown',
      password: '', // Not needed for display
      firstName: member.profiles.first_name || '',
      lastName: member.profiles.last_name || ''
    }));
    
    console.log('Final converted users:', convertedUsers);
    return convertedUsers;
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};

const getGroupMembers = async (): Promise<GroupMember[]> => {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .order('joined_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching group members:', error);
    return [];
  }
};

const getDisplayName = (user: StoredUser | undefined): string => {
  if (!user) return 'Unknown User';
  if (!user.firstName && !user.lastName) return user.username;
  
  const firstName = user.firstName?.trim() || '';
  const lastInitial = user.lastName?.trim()?.charAt(0)?.toUpperCase() || '';
  
  if (firstName && lastInitial) {
    return `${firstName} ${lastInitial}`;
  } else if (firstName) {
    return firstName;
  } else if (user.lastName) {
    return user.lastName;
  }
  
  return user.username;
};

const WeeklyCalendar = ({ groupId, viewMode, visibleUsers, startHour = 7, endHour = 21, weekStartDay = 'sunday', userColors: propUserColors, groupColors }: WeeklyCalendarProps) => {
  // Get the correct days array based on week start preference
  const DAYS = weekStartDay === 'monday' ? DAYS_MONDAY_START : DAYS_SUNDAY_START;
  
  // Helper to get user color for group
  const getUserColorForGroup = (userId: string): string => {
    if (groupColors && groupColors[userId]) {
      return groupColors[userId];
    }
    // Fallback to prop colors or default
    return (propUserColors && propUserColors[userId]) || DEFAULT_COLORS[0];
  };
  
  // Helper function to convert UI day index to storage day index (0=Sunday, 1=Monday, etc.)
  const getStorageDayIndex = (uiDayIndex: number): number => {
    if (weekStartDay === 'monday') {
      // Monday start: [Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6] -> [1,2,3,4,5,6,0]
      return uiDayIndex === 6 ? 0 : uiDayIndex + 1;
    } else {
      // Sunday start: [Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6] -> [0,1,2,3,4,5,6]
      return uiDayIndex;
    }
  };
  
  // Helper function to convert storage day index to UI day index
  const getUIDayIndex = (storageDayIndex: number): number => {
    if (weekStartDay === 'monday') {
      // Storage [0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat] -> UI [6,0,1,2,3,4,5]
      return storageDayIndex === 0 ? 6 : storageDayIndex - 1;
    } else {
      // Storage [0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat] -> UI [0,1,2,3,4,5,6]
      return storageDayIndex;
    }
  };
  
  // Generate dynamic time slots based on customizable range with 15-minute intervals
  const TIME_SLOTS = Array.from({ length: (endHour - startHour) * 4 }, (_, i) => {
    const hour = Math.floor(i / 4) + startHour;
    const minute = (i % 4) * 15;
    return { 
      hour, 
      minute, 
      time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
      isQuarterHour: minute % 30 === 15 // Mark quarter-hour slots
    };
  });

  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  // Use userColors from props (DB-synced)
  const userColors = propUserColors || {};
  const [editingBlock, setEditingBlock] = useState<TimeBlock | null>(null);
  const [editForm, setEditForm] = useState({
    label: '',
    start_time: '',
    end_time: '',
    tag: 'class'
  });
  const [originalEditForm, setOriginalEditForm] = useState({
    label: '',
    start_time: '',
    end_time: '',
    tag: 'class'
  });
  
  // New interactive features state
  const [dragState, setDragState] = useState<{
    blockId: string | null;
    dragType: 'top' | 'bottom' | 'move' | null;
    startX: number;
    startY: number;
    originalStart: string;
    originalEnd: string;
    originalDay: number;
    isDuplicating: boolean;
  }>({
    blockId: null,
    dragType: null,
    startX: 0,
    startY: 0,
    originalStart: '',
    originalEnd: '',
    originalDay: 0,
    isDuplicating: false
  });
  
  const [showQuickCreate, setShowQuickCreate] = useState<{
    day: number;
    hour: number;
    show: boolean;
  }>({ day: 0, hour: 0, show: false });
  
  const [duplicatingBlock, setDuplicatingBlock] = useState<TimeBlock | null>(null);
  const [selectedDuplicateDays, setSelectedDuplicateDays] = useState<number[]>([]);
  
  const { user } = useAuth();



  // Selected free time block for details dialog
  const [selectedFreeBlock, setSelectedFreeBlock] = useState<{ day: number; start: number; end: number } | null>(null);

  const formatMinutesToDisplay = (totalMinutes: number): string => {
    const hours24 = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
    return `${hours12}:${mins.toString().padStart(2, '0')} ${period}`;
  };

  const handleEditBlock = (block: TimeBlock) => {
    setEditingBlock(block);
    const formData = {
      label: block.label,
      start_time: block.start_time,
      end_time: block.end_time,
      tag: block.tag
    };
    setEditForm(formData);
    setOriginalEditForm(formData); // Store original values for comparison
  };

  const handleUpdateBlock = async () => {
    if (!editingBlock || !user) return;

    try {
      const updates = {
        ...editForm,
        color: user?.id ? getUserColorForGroup(user.id) : getUserColor(user?.id || '') // Always use group-specific or UUID-based color for consistency
      };
      
      const result = await updateTimeBlock(editingBlock.id, updates);
      
      if (!result) {
        throw new Error('Failed to update time block');
      }
      
      setEditingBlock(null);
      
      // Optimistically update local state instead of refetching
      setTimeBlocks(prev => prev.map(block => 
        block.id === editingBlock.id 
          ? { ...block, ...updates, displayName: block.displayName }
          : block
      ));
    } catch (error) {
      console.error('Error updating time block:', error);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!user) return;

    try {
      const success = await deleteTimeBlock(blockId);
      
      if (!success) {
        throw new Error('Failed to delete time block');
      }
      
      // Optimistically remove from local state instead of refetching
      setTimeBlocks(prev => prev.filter(block => block.id !== blockId));
    } catch (error) {
      console.error('Error deleting time block:', error);
    }
  };

  const handleDuplicateBlock = (block: TimeBlock) => {
    setDuplicatingBlock(block);
    setSelectedDuplicateDays([]);
  };

  const handleConfirmDuplicate = async () => {
    if (!duplicatingBlock || !user || selectedDuplicateDays.length === 0) return;

    try {
      const allTimeBlocks = await getTimeBlocks();
      const newBlocks: Promise<StoredTimeBlock | null>[] = [];

      selectedDuplicateDays.forEach(dayIndex => {
        const storageDayIndex = getStorageDayIndex(dayIndex);
        
        // Check if there's already an event at this time on this day for this user
        const existingBlock = allTimeBlocks.find(block => 
          block.user_id === user.id &&
          block.day_of_week === storageDayIndex &&
          block.start_time === duplicatingBlock.start_time &&
          block.end_time === duplicatingBlock.end_time
        );

        if (!existingBlock) {
          const newBlockData = {
            user_id: user.id,
            group_id: groupId,
            label: duplicatingBlock.label,
            day_of_week: storageDayIndex,
            start_time: duplicatingBlock.start_time,
            end_time: duplicatingBlock.end_time,
            color: duplicatingBlock.color,
            tag: duplicatingBlock.tag
          };
          newBlocks.push(saveTimeBlock(newBlockData));
        }
      });

      if (newBlocks.length > 0) {
        const results = await Promise.all(newBlocks);
        // Optimistically add the new blocks to local state
        const validResults = results.filter(result => result !== null);
        setTimeBlocks(prev => [...prev, ...validResults]);
      }

      setDuplicatingBlock(null);
      setSelectedDuplicateDays([]);
    } catch (error) {
      console.error('Error duplicating time block:', error);
    }
  };

  const toggleDuplicateDay = (dayIndex: number) => {
    setSelectedDuplicateDays(prev => 
      prev.includes(dayIndex) 
        ? prev.filter(d => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  // Interactive calendar functions
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const handleTimeSlotClick = async (dayIndex: number, timeSlot: { hour: number; minute: number; time: string }, event: React.MouseEvent) => {
    if (!user || viewMode !== 'busy') return;
    
    // Use the exact time slot that was clicked
    const startTime = timeSlot.time;
    const startMinutes = timeToMinutes(startTime);
    const endTime = minutesToTime(Math.min(startMinutes + 60, endHour * 60)); // Default 1 hour duration, cap at end hour
    
    // Create quick event
    const newBlock = {
      id: `tb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: user.id,
      group_id: groupId,
      label: 'New Event',
      day_of_week: getStorageDayIndex(dayIndex), // Convert UI day index to storage day index
      start_time: startTime,
      end_time: endTime,
      color: user?.id ? getUserColorForGroup(user.id) : getUserColor(user.id),
      tag: 'class',
      created_at: new Date().toISOString()
    };
    
    // Add to storage
    const savedBlock = await saveTimeBlock({
      user_id: user.id,
      group_id: groupId,
      label: newBlock.label,
      day_of_week: newBlock.day_of_week,
      start_time: newBlock.start_time,
      end_time: newBlock.end_time,
      color: newBlock.color,
      tag: newBlock.tag
    });
    
    if (!savedBlock) {
      console.error('Failed to save time block');
      return;
    }
    
    // Optimistically add to local state for immediate UI update
    setTimeBlocks(prev => [...prev, savedBlock]);
    
    // Open edit dialog immediately
    const blockWithDisplay = {
      ...savedBlock,
      displayName: user.firstName && user.lastName 
        ? `${user.firstName} ${user.lastName.charAt(0)}`
        : user.username
    };
    setEditingBlock(blockWithDisplay);
    const formData = {
      label: savedBlock.label,
      start_time: savedBlock.start_time,
      end_time: savedBlock.end_time,
      tag: savedBlock.tag
    };
    setEditForm(formData);
    setOriginalEditForm(formData); // Store original values for new blocks
  };

  const handleMouseDown = (blockId: string, dragType: 'top' | 'bottom' | 'move', event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const block = timeBlocks.find(b => b.id === blockId);
    if (!block || block.user_id !== user?.id) return;
    
    setDragState({
      blockId,
      dragType,
      startX: event.clientX,
      startY: event.clientY,
      originalStart: block.start_time,
      originalEnd: block.end_time,
      originalDay: block.day_of_week,
      isDuplicating: event.ctrlKey || event.metaKey // Ctrl/Cmd for duplication
    });
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!dragState.blockId || !dragState.dragType) return;
    
    const block = timeBlocks.find(b => b.id === dragState.blockId);
    if (!block) return;
    
    if (dragState.dragType === 'move') {
      // Handle moving entire block across days and times
      const deltaX = event.clientX - dragState.startX;
      const deltaY = event.clientY - dragState.startY;
      
      // Calculate day shift (assuming each day column is roughly 120px wide)
      const dayShift = Math.round(deltaX / 120);
      const newDay = Math.max(0, Math.min(6, dragState.originalDay + dayShift));
      
      // Calculate time shift (30px = 15 minutes for finer control)
      const timeShiftMinutes = Math.round((deltaY / 30) * 15);
      const snappedTimeShift = Math.round(timeShiftMinutes / 15) * 15; // Snap to 15-minute intervals
      
      let newStart = timeToMinutes(dragState.originalStart) + snappedTimeShift;
      let newEnd = timeToMinutes(dragState.originalEnd) + snappedTimeShift;
      
      // Constrain to calendar hours
      if (newStart < startHour * 60) {
        const adjustment = startHour * 60 - newStart;
        newStart += adjustment;
        newEnd += adjustment;
      }
      if (newEnd > endHour * 60) {
        const adjustment = newEnd - endHour * 60;
        newStart -= adjustment;
        newEnd -= adjustment;
      }
      
      // Update the time block temporarily (visual feedback)
      setTimeBlocks(prev => prev.map(b => 
        b.id === dragState.blockId 
          ? { ...b, day_of_week: newDay, start_time: minutesToTime(newStart), end_time: minutesToTime(newEnd) }
          : b
      ));
    } else {
      // Handle resizing (top/bottom drag)
      const deltaY = event.clientY - dragState.startY;
      const timeShiftMinutes = Math.round((deltaY / 30) * 15); // 30px = 15 minutes for finer control
      const snappedDeltaMinutes = Math.round(timeShiftMinutes / 15) * 15; // Snap to 15-minute intervals
      
      let newStart = timeToMinutes(dragState.originalStart);
      let newEnd = timeToMinutes(dragState.originalEnd);
      
      if (dragState.dragType === 'top') {
        newStart = Math.max(startHour * 60, Math.min(newStart + snappedDeltaMinutes, newEnd - 15)); // Min 15 min duration
      } else {
        newEnd = Math.min(endHour * 60, Math.max(newEnd + snappedDeltaMinutes, newStart + 15)); // Min 15 min duration
      }
      
      // Update the time block temporarily (visual feedback)
      setTimeBlocks(prev => prev.map(b => 
        b.id === dragState.blockId 
          ? { ...b, start_time: minutesToTime(newStart), end_time: minutesToTime(newEnd) }
          : b
      ));
    }
  };

  const handleMouseUp = async () => {
    if (!dragState.blockId) return;
    
    const block = timeBlocks.find(b => b.id === dragState.blockId);
    if (block && block.user_id === user?.id) {
      try {
        if (dragState.isDuplicating && dragState.dragType === 'move') {
          // Create a duplicate instead of moving
          const duplicateBlock = await saveTimeBlock({
            user_id: user.id,
            group_id: groupId,
            label: block.label,
            day_of_week: block.day_of_week,
            start_time: block.start_time,
            end_time: block.end_time,
            color: block.color,
            tag: block.tag
          });
          
          if (duplicateBlock) {
            // Add the duplicate to local state
            setTimeBlocks(prev => [...prev, duplicateBlock]);
          }
          
          // Reset original block position
          setTimeBlocks(prev => prev.map(b => 
            b.id === dragState.blockId 
              ? { ...b, 
                  day_of_week: dragState.originalDay, 
                  start_time: dragState.originalStart, 
                  end_time: dragState.originalEnd 
                }
              : b
          ));
        } else {
          // Regular move/resize - update the existing block
          if (dragState.dragType === 'move') {
            await updateTimeBlock(block.id, {
              day_of_week: block.day_of_week,
              start_time: block.start_time,
              end_time: block.end_time
            });
          } else {
            await updateTimeBlock(block.id, {
              start_time: block.start_time,
              end_time: block.end_time
            });
          }
        }
      } catch (error) {
        console.error('Error handling drag operation:', error);
        // Reset to original position on error
        setTimeBlocks(prev => prev.map(b => 
          b.id === dragState.blockId 
            ? { ...b, 
                day_of_week: dragState.originalDay, 
                start_time: dragState.originalStart, 
                end_time: dragState.originalEnd 
              }
            : b
        ));
      }
    }
    
    setDragState({
      blockId: null,
      dragType: null,
      startX: 0,
      startY: 0,
      originalStart: '',
      originalEnd: '',
      originalDay: 0,
      isDuplicating: false
    });
  };

  // Add mouse event listeners
  useEffect(() => {
    if (dragState.blockId) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState]);

    const fetchTimeBlocks = async () => {
    try {
      setLoading(true);
      
      const allTimeBlocks = await getTimeBlocks();
      let allUsers = await getUsers(groupId);
      const groupMembers = await getGroupMembers();
      
      // If we couldn't get users from the database and there's a current user, add them
      if (allUsers.length === 0 && user) {
        console.warn('No group members found from database, adding current user');
        allUsers = [{
          id: user.id,
          username: user.username || 'You',
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          password: ''
        }];
      }
      
      // Debug: Log fetched data
      console.log('Fetched data:', {
        groupId,
        timeBlocksCount: allTimeBlocks.length,
        usersCount: allUsers.length,
        groupMembersCount: groupMembers.length,
        currentUser: user,
        allUsers: allUsers.map(u => ({ id: u.id, firstName: u.firstName, lastName: u.lastName, username: u.username })),
        timeBlockUserIds: allTimeBlocks.map(block => block.user_id).filter((id, index, arr) => arr.indexOf(id) === index)
      });
      
      // Filter time blocks for this group
      const groupTimeBlocks = allTimeBlocks.filter(block => block.group_id === groupId);
      
      // Get member user IDs
      const groupMemberIds = groupMembers
        .filter(member => member.group_id === groupId)
        .map(member => member.user_id);
      
      // Filter time blocks to only include group members
      let memberTimeBlocks = groupTimeBlocks.filter(block => 
        groupMemberIds.includes(block.user_id)
      );
      
      // Note: User visibility filtering is now handled in getTimeBlocksForDay during rendering
      
      // Add display names to time blocks
      const blocksWithDisplayNames = memberTimeBlocks.map(block => {
        const blockUser = allUsers.find(u => u.id === block.user_id);
        
        // Enhanced debug: Check user lookup in detail
        console.log('User lookup debug:', {
          blockUserId: block.user_id,
          allUserIds: allUsers.map(u => u.id),
          foundUser: blockUser,
          allUsersDetailed: allUsers
        });
        
        let displayName;
        if (blockUser) {
          displayName = getDisplayName(blockUser);
        } else {
          // User not found in database - this shouldn't happen with proper group membership
          console.warn('User not found for block:', {
            blockUserId: block.user_id,
            availableUserIds: allUsers.map(u => u.id),
            blockDetails: block
          });
          
          // Use current user if it's their block
          if (user && block.user_id === user.id) {
            displayName = user.firstName ? `${user.firstName}${user.lastName ? ' ' + user.lastName.charAt(0) : ''}` : user.username || 'You';
          } else {
            // This indicates a data consistency issue - the user has activities but isn't in the group
            displayName = 'Former Member';
          }
          
          console.log('Using fallback display name:', displayName);
        }
        
        return {
          ...block,
          displayName
        };
      });

      setTimeBlocks(blocksWithDisplayNames);
    } catch (error) {
      console.error('Error fetching time blocks:', error);
      setTimeBlocks([]);
    } finally {
      setLoading(false);
    }
    };

  useEffect(() => {
    if (!groupId) return;

    fetchTimeBlocks();
    
    // Only set up realtime subscription instead of aggressive polling
    // The data will update when changes are made through the UI
  }, [groupId]); // Don't refetch data when visibleUsers changes - just re-filter

  // Note: userColors now comes from props, no need for local state management



  const getTimeBlocksForDay = (uiDayIndex: number) => {
    const storageDayIndex = getStorageDayIndex(uiDayIndex);
    let dayBlocks = timeBlocks.filter(block => block.day_of_week === storageDayIndex);
    
    // Apply user visibility filter for busy mode during rendering
    if (viewMode === 'busy' && visibleUsers && visibleUsers.size > 0) {
      dayBlocks = dayBlocks.filter(block => visibleUsers.has(block.user_id));
    }
    
    return dayBlocks;
  };

  // Calculate overlap positions for blocks on the same day
  const calculateBlockPositions = (blocks: TimeBlock[]) => {
    const blockPositions: Array<TimeBlock & { column: number, totalColumns: number }> = [];
    
    blocks.forEach((block, index) => {
      // Find all blocks that overlap with this one
      const overlappingBlocks = blocks.filter((otherBlock, otherIndex) => 
        otherIndex !== index && doTimeBlocksOverlap(block, otherBlock)
      );
      
      // Include the current block in the overlap group
      const overlapGroup = [block, ...overlappingBlocks];
      
      // Sort by duration (shortest events get higher z-index/forward position)
      // Then by start time as secondary sort, then by user_id for consistency
      overlapGroup.sort((a, b) => {
        const startTimeA = timeToMinutes(a.start_time);
        const endTimeA = timeToMinutes(a.end_time);
        const durationA = endTimeA - startTimeA;
        
        const startTimeB = timeToMinutes(b.start_time);
        const endTimeB = timeToMinutes(b.end_time);
        const durationB = endTimeB - startTimeB;
        
        if (durationA !== durationB) {
          return durationA - durationB; // Shorter durations first (in front)
        }
        
        if (startTimeA !== startTimeB) {
          return startTimeA - startTimeB; // Earlier start times first as secondary sort
        }
        
        return a.user_id.localeCompare(b.user_id); // Consistent fallback
      });
      
      const column = overlapGroup.findIndex(b => b.id === block.id);
      const totalColumns = overlapGroup.length;
      
      blockPositions.push({
        ...block,
        column,
        totalColumns
      });
    });
    
    return blockPositions;
  };

  const getBlockPosition = (startTime: string, endTime: string) => {
    const [startHourNum, startMin] = startTime.split(':').map(Number);
    const [endHourNum, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = (startHourNum - startHour) * 60 + startMin;
    const endMinutes = (endHourNum - startHour) * 60 + endMin;
    
    const top = (startMinutes / 15) * 15; // 15px per 15-minute slot
    const height = ((endMinutes - startMinutes) / 15) * 15; // 15px per 15-minute slot
    
    return { top, height };
  };

  const getFreeTimeBlocks = () => {
    if (viewMode !== 'free') return [];

    const freeBlocks: { day: number; start: number; end: number; overlap: number }[] = [];
    
    DAYS.forEach((_, dayIndex) => {
      const dayBlocks = getTimeBlocksForDay(dayIndex);
      const occupiedSlots = new Set<number>();
      
      // Mark occupied 30-minute slots
      dayBlocks.forEach(block => {
        const [blockStartHour, startMin] = block.start_time.split(':').map(Number);
        const [blockEndHour, endMin] = block.end_time.split(':').map(Number);
        
        const startSlot = (blockStartHour - startHour) * 2 + Math.floor(startMin / 30);
        const endSlot = (blockEndHour - startHour) * 2 + Math.floor(endMin / 30);
        
        for (let slot = startSlot; slot < endSlot; slot++) {
          occupiedSlots.add(slot);
        }
      });
      
      // Find free time blocks (consecutive free slots)
      let freeStart = null;
      const totalSlots = (endHour - startHour) * 2; // Dynamic slot count
      for (let slot = 0; slot < totalSlots; slot++) {
        if (!occupiedSlots.has(slot)) {
          if (freeStart === null) freeStart = slot;
        } else {
          if (freeStart !== null) {
            const freeStartHour = startHour + Math.floor(freeStart / 2);
            const freeStartMin = (freeStart % 2) * 30;
            const freeEndHour = startHour + Math.floor(slot / 2);
            const freeEndMin = (slot % 2) * 30;
            
            freeBlocks.push({
              day: dayIndex,
              start: freeStartHour * 60 + freeStartMin,
              end: freeEndHour * 60 + freeEndMin,
              overlap: 1
            });
            freeStart = null;
          }
        }
      }
      
      // Handle case where free time extends to end of day
      if (freeStart !== null) {
        const freeStartHour = startHour + Math.floor(freeStart / 2);
        const freeStartMin = (freeStart % 2) * 30;
        freeBlocks.push({
          day: dayIndex,
          start: freeStartHour * 60 + freeStartMin,
          end: endHour * 60, // End at custom end hour
          overlap: 1
        });
      }
    });
    
    return freeBlocks;
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Loading calendar...</p>
      </div>
    );
  }

  const freeTimeBlocks = getFreeTimeBlocks();

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Overlap Summary */}
        {viewMode === 'busy' && (() => {
          const personalOverlaps = timeBlocks.filter(block => {
            const { selfOverlap } = getOverlapLevel(block, timeBlocks);
            return selfOverlap;
          });

          if (personalOverlaps.length > 0) {
            return (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-red-800">⚠ Personal Scheduling Conflicts</span>
                </div>
                <div className="text-xs text-red-700">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-red-400 border-dashed rounded"></div>
                    <span>{personalOverlaps.length} personal conflict{personalOverlaps.length !== 1 ? 's' : ''} found. You have overlapping activities in your schedule.</span>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}

        {/* Header */}
        <div className="grid gap-0 mb-2" style={{ gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
          <div className="text-center text-sm font-medium text-muted-foreground p-2 w-16">
            Time
          </div>
          {DAYS.map((day, index) => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
            {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid gap-0 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm" style={{ gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr 1fr 1fr 1fr' }}>
          {/* Time Column */}
          <div className="bg-slate-50/50 border-r border-slate-200 w-16">
            {TIME_SLOTS.filter(slot => slot.minute === 0).map((timeSlot, index) => (
              <div key={timeSlot.time} className="h-[60px] text-xs text-slate-600 flex items-start justify-end pr-2 border-t border-slate-300 font-medium">
                {timeSlot.minute === 0 && (
                  <div className="text-right text-xs leading-none pt-1">
                    {timeSlot.hour > 12 ? timeSlot.hour - 12 : timeSlot.hour === 0 ? 12 : timeSlot.hour}
                    <span className="text-xs opacity-70">
                      {timeSlot.hour >= 12 ? 'PM' : 'AM'}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {DAYS.map((day, dayIndex) => (
            <div key={day} className="relative border-r border-slate-200 last:border-r-0">
              {/* Time Slot Grid */}
              {TIME_SLOTS.map((timeSlot, index) => (
                <div 
                  key={timeSlot.time} 
                  className={`h-[15px] border-t hover:bg-blue-50/40 transition-colors cursor-pointer group ${
                    timeSlot.minute === 0 ? 'border-t-slate-300' : 
                    timeSlot.minute === 30 ? 'border-t-slate-200' : 
                    'border-t-slate-100 border-dashed'
                  }`}
                  onDoubleClick={(e) => handleTimeSlotClick(dayIndex, timeSlot, e)}
                  title={`Double-click to create event at ${timeSlot.time}`}
                >
                  <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity bg-blue-100/30 rounded-sm m-0.5" />
                </div>
              ))}

              {/* Time Blocks for Busy Mode */}
              {viewMode === 'busy' && calculateBlockPositions(getTimeBlocksForDay(dayIndex)).map((block) => {
                const { top, height } = getBlockPosition(block.start_time, block.end_time);
                const isOwnBlock = block.user_id === user?.id;
                const { selfOverlap } = getOverlapLevel(block, timeBlocks);
                
                // Calculate width and left position for overlapping blocks (Notion Calendar style)
                let blockWidth, leftPosition, zIndex;
                
                if (block.totalColumns > 1) {
                  // For overlapping events, use staggered Notion-style layout with minimum width constraint
                  const offsetPerEvent = Math.min(8, 60 / block.totalColumns); // Reduce offset for many overlaps
                  const maxOffset = (block.totalColumns - 1) * offsetPerEvent;
                  const minWidthPx = Math.max(50, 120 / block.totalColumns); // Ensure minimum 50px or proportional width
                  
                  blockWidth = `max(${minWidthPx}px, calc(100% - ${maxOffset + 8}px))`; // Enforce minimum width
                  leftPosition = `${2 + (block.column * offsetPerEvent)}px`;
                  zIndex = 10 + (block.totalColumns - block.column); // Higher z-index for shorter duration events
                } else {
                  // Single event - full width
                  blockWidth = 'calc(100% - 4px)';
                  leftPosition = '2px';
                  zIndex = 10;
                }
                
                // Get current user color (always use UUID-based color for consistency)
                // Always color by the block owner's chosen color
                const currentUserColor = getUserColorForGroup(block.user_id);
                
                // Only show warning for personal overlaps (same user)
                const showWarning = selfOverlap;
                const borderStyle = showWarning ? 'border-2 border-red-400 border-dashed' : '';
                const isDragging = dragState.blockId === block.id;
              
              return (
                <div
                    key={block.id}
                    className={`absolute rounded-lg text-xs text-white overflow-hidden group shadow-sm ${borderStyle} ${
                      isDragging ? 'opacity-80 shadow-lg z-50' : 'shadow-sm'
                    } ${isOwnBlock ? 'hover:shadow-md transition-all duration-200' : ''}`}
                    style={{
                      top: `${top + 2}px`,
                      height: `${Math.max(height - 4, 26)}px`,
                      left: leftPosition,
                      width: blockWidth,
                      zIndex: zIndex,
                      backgroundColor: currentUserColor,
                      minHeight: '26px',
                      marginLeft: '0px', // Remove margins for Notion-style layout
                      marginRight: '0px',
                      cursor: 'pointer', // All blocks are now clickable to view details
                      border: `1px solid ${currentUserColor}dd`,
                      borderRadius: '6px', // Slightly more rounded for modern look
                      boxShadow: block.totalColumns > 1 ? '0 2px 6px rgba(0,0,0,0.15)' : '0 1px 3px rgba(0,0,0,0.1)',
                      padding: Math.max(height - 4, 26) < 50 ? '3px 6px' : '6px 8px', // Better padding for stacked events
                      transition: 'all 0.2s ease' // Smooth transitions for hover effects
                    }}
                    onClick={() => handleEditBlock(block)}
                  >
                    {/* Drag handle - move entire block */}
                    {isOwnBlock && (
                      <div
                        className="absolute top-1 left-1 w-4 h-4 bg-white/40 opacity-0 group-hover:opacity-100 cursor-move transition-opacity rounded-sm"
                        onMouseDown={(e) => handleMouseDown(block.id, 'move', e)}
                        title="Drag to move block (Ctrl+drag to duplicate)"
                      >
                        <div className="w-full h-full flex items-center justify-center text-black/60 text-xs">⋮⋮</div>
                      </div>
                    )}
                    
                    {/* Drag handle - top */}
                    {isOwnBlock && (
                      <div
                        className="absolute top-0 left-0 right-0 h-1 bg-white/30 opacity-0 group-hover:opacity-100 cursor-n-resize transition-opacity"
                        onMouseDown={(e) => handleMouseDown(block.id, 'top', e)}
                        title="Drag to adjust start time"
                      />
                    )}
                    
                    {(() => {
                      const blockHeight = Math.max(height - 4, 26);
                      const isWide = parseInt(blockWidth.replace(/\D/g, '')) > 80 || blockWidth === 'calc(100% - 4px)';
                      const isOverlapping = block.totalColumns > 1;
                      
                      if (blockHeight >= 50 && isWide) {
                        // Large blocks with activity name and user
                        return (
                          <>
                            <div className="font-medium truncate text-sm leading-tight">{block.label}</div>
                            {block.displayName && (
                              <div className="text-xs opacity-75 truncate">{block.displayName}</div>
                            )}
                          </>
                        );
                      } else if (blockHeight >= 35) {
                        // Medium blocks - activity name only unless wide enough for user
                        return (
                          <>
                            <div className="font-medium truncate text-xs leading-tight">{block.label}</div>
                            {!isOverlapping && isWide && block.displayName && (
                              <div className="text-xs opacity-75 truncate">{block.displayName}</div>
                            )}
                          </>
                        );
                      } else if (blockHeight >= 26) {
                        // Small blocks - truncated activity name
                        const maxLength = blockWidth === 'calc(100% - 4px)' ? 20 : 12;
                        return (
                          <div className="font-medium truncate text-xs leading-tight">
                            {block.label.length > maxLength ? `${block.label.substring(0, maxLength)}...` : block.label}
                          </div>
                        );
                      } else {
                        // Very small blocks - heavily truncated
                        return (
                          <div className="font-medium truncate text-xs leading-none">
                            {block.label.length > 6 ? `${block.label.substring(0, 6)}...` : block.label}
                          </div>
                        );
                      }
                    })()}
                    
                    {/* Drag handle - bottom */}
                    {isOwnBlock && (
                      <div
                        className="absolute bottom-0 left-0 right-0 h-1 bg-white/30 opacity-0 group-hover:opacity-100 cursor-s-resize transition-opacity"
                        onMouseDown={(e) => handleMouseDown(block.id, 'bottom', e)}
                        title="Drag to adjust end time"
                      />
                    )}
                    
                    {/* Warning indicator only for personal overlaps */}
                    {showWarning && (
                      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        <div className="absolute top-0 right-0 w-4 h-4 rounded-bl text-center text-xs font-bold leading-4 bg-red-500 text-white">
                          ⚠
                        </div>
                      </div>
                    )}
                    
                    {/* Edit/Delete buttons for own blocks */}
                    {isOwnBlock && !isDragging && (
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 bg-black/20 hover:bg-black/40 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditBlock(block);
                          }}
                        >
                          <Edit3 className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 bg-black/20 hover:bg-blue-500/80 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateBlock(block);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 bg-black/20 hover:bg-red-500/80 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBlock(block.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Free Time Blocks */}
              {viewMode === 'free' && freeTimeBlocks
                .filter(block => block.day === dayIndex)
                .map((block, index) => {
                  const top = ((block.start - startHour * 60) / 30) * 30;
                  const height = ((block.end - block.start) / 30) * 30;
                  
                  return (
                    <div
                      key={index}
                      className="absolute left-0 right-0 mx-1 rounded text-xs text-white p-1 cursor-pointer hover:opacity-90"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: '#22c55e',
                        opacity: 0.7,
                        minHeight: '20px'
                      }}
                      onClick={() => setSelectedFreeBlock({ day: dayIndex, start: block.start, end: block.end })}
                      title={`${formatMinutesToDisplay(block.start)} - ${formatMinutesToDisplay(block.end)}`}
                    >
                      <div className="font-medium">Free Time</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      </div>

      {/* Free Time Range Dialog */}
      <Dialog open={!!selectedFreeBlock} onOpenChange={(open) => !open && setSelectedFreeBlock(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Free Time</DialogTitle>
            <DialogDescription>
              {selectedFreeBlock && (
                <span>
                  {DAYS[selectedFreeBlock.day]}: {formatMinutesToDisplay(selectedFreeBlock.start)} - {formatMinutesToDisplay(selectedFreeBlock.end)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Edit Time Block Dialog */}
      <Dialog open={!!editingBlock} onOpenChange={(open) => {
        if (!open) {
          // Check if this is a new block with no changes and delete it
          if (editingBlock && editingBlock.label === 'New Event' && 
              editForm.label === originalEditForm.label &&
              editForm.start_time === originalEditForm.start_time &&
              editForm.end_time === originalEditForm.end_time &&
              editForm.tag === originalEditForm.tag) {
            handleDeleteBlock(editingBlock.id);
          }
          setEditingBlock(null);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingBlock?.user_id === user?.id ? 'Edit Activity' : 'View Activity'}
            </DialogTitle>
            <DialogDescription>
              {editingBlock?.user_id === user?.id 
                ? 'Make changes to your activity. Click save when you\'re done.'
                : 'Activity details (read-only)'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-label">Activity Name</Label>
              <Input
                id="edit-label"
                value={editForm.label}
                onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                placeholder="What are you doing?"
                readOnly={editingBlock?.user_id !== user?.id}
                className={editingBlock?.user_id !== user?.id ? 'bg-gray-50' : ''}
              />
            </div>
            {editingBlock?.displayName && (
              <div className="grid gap-2">
                <Label htmlFor="edit-user">User</Label>
                <Input
                  id="edit-user"
                  value={editingBlock.displayName}
                  readOnly={true}
                  className="bg-gray-50"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-start">Start Time</Label>
                <Input
                  id="edit-start"
                  type="time"
                  value={editForm.start_time}
                  onChange={(e) => setEditForm(prev => ({ ...prev, start_time: e.target.value }))}
                  readOnly={editingBlock?.user_id !== user?.id}
                  className={editingBlock?.user_id !== user?.id ? 'bg-gray-50' : ''}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-end">End Time</Label>
                <Input
                  id="edit-end"
                  type="time"
                  value={editForm.end_time}
                  onChange={(e) => setEditForm(prev => ({ ...prev, end_time: e.target.value }))}
                  readOnly={editingBlock?.user_id !== user?.id}
                  className={editingBlock?.user_id !== user?.id ? 'bg-gray-50' : ''}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-tag">Category & Color</Label>
              <div className="flex gap-2">
                <Select 
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, tag: value }))} 
                  value={editForm.tag}
                  disabled={editingBlock?.user_id !== user?.id}
                >
                  <SelectTrigger className={`flex-1 ${editingBlock?.user_id !== user?.id ? 'bg-gray-50' : ''}`}>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(category => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 pt-4">
                {editingBlock?.user_id === user?.id ? (
                  <Button type="button" onClick={handleUpdateBlock} disabled={loading}>
                    {loading ? 'Updating...' : 'Update Block'}
                  </Button>
                ) : null}
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingBlock(null)}
                >
                  {editingBlock?.user_id === user?.id ? 'Cancel' : 'Close'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Event Dialog */}
      <Dialog open={!!duplicatingBlock} onOpenChange={(open) => {
        if (!open) {
          setDuplicatingBlock(null);
          setSelectedDuplicateDays([]);
        }
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Duplicate Event</DialogTitle>
            <DialogDescription>
              Select the days you want to copy "{duplicatingBlock?.label}" to.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Original: {duplicatingBlock && DAYS[getUIDayIndex(duplicatingBlock.day_of_week)]} {duplicatingBlock?.start_time} - {duplicatingBlock?.end_time}
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {DAYS.map((day, index) => {
                const isOriginalDay = duplicatingBlock && getUIDayIndex(duplicatingBlock.day_of_week) === index;
                const isSelected = selectedDuplicateDays.includes(index);
                
                return (
                  <Button
                    key={day}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    disabled={isOriginalDay}
                    onClick={() => toggleDuplicateDay(index)}
                    className={`${isOriginalDay ? 'opacity-50' : ''}`}
                  >
                    {day}
                    {isOriginalDay && ' ✓'}
                  </Button>
                );
              })}
            </div>
            
            {selectedDuplicateDays.length > 0 && (
              <div className="text-sm text-green-600">
                Will create {selectedDuplicateDays.length} new event{selectedDuplicateDays.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          
          <div className="flex gap-2 pt-4">
            <Button 
              onClick={handleConfirmDuplicate} 
              disabled={selectedDuplicateDays.length === 0}
            >
              Duplicate Event{selectedDuplicateDays.length !== 1 ? 's' : ''}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => {
                setDuplicatingBlock(null);
                setSelectedDuplicateDays([]);
              }}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WeeklyCalendar;