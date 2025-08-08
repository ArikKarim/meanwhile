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
}

const DAYS_SUNDAY_START = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_MONDAY_START = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// User color system (replaces category-based colors)
const USER_COLORS_KEY = 'meanwhile_user_colors';

interface UserColors {
  [userId: string]: string;
}

const getUserColors = (): UserColors => {
  try {
    const stored = localStorage.getItem(USER_COLORS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const getUserColor = (userId: string): string => {
  const userColors = getUserColors();
  return userColors[userId] || '#3b82f6'; // Default blue if no color set
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

const getUsers = (): StoredUser[] => {
  try {
    const stored = localStorage.getItem(USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
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

const WeeklyCalendar = ({ groupId, viewMode, visibleUsers, startHour = 7, endHour = 21, weekStartDay = 'sunday' }: WeeklyCalendarProps) => {
  // Get the correct days array based on week start preference
  const DAYS = weekStartDay === 'monday' ? DAYS_MONDAY_START : DAYS_SUNDAY_START;
  
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
  const [userColors, setUserColors] = useState<{[userId: string]: string}>({});
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
        color: userColors[user?.id || ''] || getUserColor(user?.id || '') // Set color based on current user color
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
      color: userColors[user.id] || getUserColor(user.id),
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
      const allUsers = getUsers();
      const groupMembers = await getGroupMembers();
      
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
      
      // Apply user visibility filter for busy mode
      if (viewMode === 'busy' && visibleUsers && visibleUsers.size > 0) {
        memberTimeBlocks = memberTimeBlocks.filter(block => 
          visibleUsers.has(block.user_id)
        );
      }
      
      // Add display names to time blocks
      const blocksWithDisplayNames = memberTimeBlocks.map(block => {
        const blockUser = allUsers.find(u => u.id === block.user_id);
        return {
          ...block,
          displayName: getDisplayName(blockUser)
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
  }, [groupId]); // Removed visibleUsers dependency to prevent unnecessary refetches

  // Monitor user color changes and update state
  useEffect(() => {
    const loadUserColors = () => {
      setUserColors(getUserColors());
    };

    // Load initial colors
    loadUserColors();

    // Listen for storage changes (when user colors are updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === USER_COLORS_KEY) {
        loadUserColors();
      }
    };

    // Listen for custom events from the color picker
    const handleColorChange = () => {
      loadUserColors();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userColorChanged', handleColorChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userColorChanged', handleColorChange);
    };
  }, []);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTimeBlocksForDay = (uiDayIndex: number) => {
    const storageDayIndex = getStorageDayIndex(uiDayIndex);
    return timeBlocks.filter(block => block.day_of_week === storageDayIndex);
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
      
      // Sort by user_id to ensure consistent positioning
      overlapGroup.sort((a, b) => a.user_id.localeCompare(b.user_id));
      
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
            {TIME_SLOTS.filter(slot => slot.minute === 0 || slot.minute === 30).map((timeSlot, index) => (
              <div key={timeSlot.time} className={`h-[30px] text-xs text-slate-600 flex items-start justify-end pr-2 ${
                timeSlot.minute === 0 ? 'border-t border-slate-300 font-medium' : 
                'border-t border-slate-200'
              }`}>
                {timeSlot.minute === 0 && (
                  <div className="text-right text-xs leading-none -mt-2">
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
                  onClick={(e) => handleTimeSlotClick(dayIndex, timeSlot, e)}
                  title={`Click to create event at ${timeSlot.time}`}
                >
                  <div className="w-full h-full opacity-0 group-hover:opacity-100 transition-opacity bg-blue-100/30 rounded-sm m-0.5" />
                </div>
              ))}

              {/* Time Blocks for Busy Mode */}
              {viewMode === 'busy' && calculateBlockPositions(getTimeBlocksForDay(dayIndex)).map((block) => {
                const { top, height } = getBlockPosition(block.start_time, block.end_time);
                const isOwnBlock = block.user_id === user?.id;
                const { selfOverlap } = getOverlapLevel(block, timeBlocks);
                
                // Calculate width and left position for overlapping blocks
                const blockWidth = block.totalColumns > 1 ? `${100 / block.totalColumns}%` : '100%';
                const leftPosition = block.totalColumns > 1 ? `${(block.column * 100) / block.totalColumns}%` : '0%';
                
                // Get current user color (dynamic)
                const currentUserColor = userColors[block.user_id] || block.color || '#3b82f6';
                
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
                      backgroundColor: currentUserColor,
                      minHeight: '26px',
                      marginLeft: block.totalColumns > 1 ? '2px' : '4px',
                      marginRight: block.totalColumns > 1 ? '2px' : '4px',
                      cursor: isOwnBlock ? 'pointer' : 'default',
                      border: `1px solid ${currentUserColor}dd`,
                      padding: Math.max(height - 4, 26) < 50 ? '2px 4px' : '4px 6px', // Responsive padding
                      transition: 'background-color 0.3s ease, border-color 0.3s ease' // Smooth color transitions
                    }}
                    onClick={() => isOwnBlock && handleEditBlock(block)}
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
                    
                    {Math.max(height - 4, 26) >= 50 ? (
                      // Full content for larger blocks
                      <>
                        <div className="font-medium truncate">{block.label}</div>
                        <div className="text-xs opacity-90">
                          {formatTime(block.start_time)} - {formatTime(block.end_time)}
                        </div>
                        {block.displayName && (
                          <div className="text-xs opacity-75">{block.displayName}</div>
                        )}
                      </>
                    ) : (
                      // Compact content for smaller blocks
                      <div className="font-medium truncate text-xs leading-tight">{block.label}</div>
                    )}
                    
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
                      className="absolute left-0 right-0 mx-1 rounded text-xs text-white p-1"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: '#22c55e',
                        opacity: 0.7,
                        minHeight: '20px'
                      }}
                    >
                      <div className="font-medium">Free Time</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      </div>

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
            <DialogTitle>Edit Activity</DialogTitle>
            <DialogDescription>
              Make changes to your activity. Click save when you're done.
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
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-start">Start Time</Label>
                <Input
                  id="edit-start"
                  type="time"
                  value={editForm.start_time}
                  onChange={(e) => setEditForm(prev => ({ ...prev, start_time: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-end">End Time</Label>
                <Input
                  id="edit-end"
                  type="time"
                  value={editForm.end_time}
                  onChange={(e) => setEditForm(prev => ({ ...prev, end_time: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-tag">Category & Color</Label>
              <div className="flex gap-2">
                <Select onValueChange={(value) => setEditForm(prev => ({ ...prev, tag: value }))} value={editForm.tag}>
                  <SelectTrigger className="flex-1">
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
                <Button type="button" onClick={handleUpdateBlock} disabled={loading}>
                  {loading ? 'Updating...' : 'Update Block'}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingBlock(null)}
                >
                  Cancel
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