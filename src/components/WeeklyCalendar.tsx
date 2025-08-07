import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Edit3, Trash2 } from 'lucide-react';
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
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


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

interface ProfileData {
  id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  color: string;
}

const getDisplayName = (profile: ProfileData | undefined): string => {
  if (!profile) return 'Unknown User';
  if (!profile.first_name && !profile.last_name) return profile.username;
  
  const firstName = profile.first_name?.trim() || '';
  const lastInitial = profile.last_name?.trim()?.charAt(0)?.toUpperCase() || '';
  
  if (firstName && lastInitial) {
    return `${firstName} ${lastInitial}`;
  } else if (firstName) {
    return firstName;
  } else if (profile.last_name) {
    return profile.last_name;
  }
  
  return profile.username;
};

const WeeklyCalendar = ({ groupId, viewMode, visibleUsers, startHour = 7, endHour = 21 }: WeeklyCalendarProps) => {
  // Generate dynamic time slots based on customizable range
  const TIME_SLOTS = Array.from({ length: (endHour - startHour) * 2 }, (_, i) => {
    const hour = Math.floor(i / 2) + startHour;
    const minute = (i % 2) * 30;
    return { hour, minute, time: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` };
  });

  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<{[userId: string]: ProfileData}>({});
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
    dragType: 'top' | 'bottom' | null;
    startY: number;
    originalStart: string;
    originalEnd: string;
  }>({
    blockId: null,
    dragType: null,
    startY: 0,
    originalStart: '',
    originalEnd: ''
  });
  
  const [showQuickCreate, setShowQuickCreate] = useState<{
    day: number;
    hour: number;
    show: boolean;
  }>({ day: 0, hour: 0, show: false });
  
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
      const { error } = await supabase
        .from('time_blocks')
        .update({
          ...editForm,
          color: profiles[user.id]?.color || '#3b82f6'
        })
        .eq('id', editingBlock.id);

      if (error) throw error;

      setEditingBlock(null);
      
      // Refresh the display
      fetchTimeBlocks();
    } catch (error) {
      console.error('Error updating time block:', error);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('time_blocks')
        .delete()
        .eq('id', blockId);

      if (error) throw error;
      
      // Refresh the display
      fetchTimeBlocks();
    } catch (error) {
      console.error('Error deleting time block:', error);
    }
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
    
    try {
      // Create quick event in database
      const { data: newBlock, error } = await supabase
        .from('time_blocks')
        .insert({
          user_id: user.id,
          group_id: groupId,
          label: 'New Event',
          day_of_week: dayIndex,
          start_time: startTime,
          end_time: endTime,
          color: profiles[user.id]?.color || '#3b82f6',
          tag: 'class'
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh display
      fetchTimeBlocks();
      
      // Open edit dialog immediately
      const profile = profiles[user.id];
      const blockWithDisplay = {
        ...newBlock,
        displayName: getDisplayName(profile)
      };
      setEditingBlock(blockWithDisplay);
      const formData = {
        label: newBlock.label,
        start_time: newBlock.start_time,
        end_time: newBlock.end_time,
        tag: newBlock.tag
      };
      setEditForm(formData);
      setOriginalEditForm(formData); // Store original values for new blocks
    } catch (error) {
      console.error('Error creating time block:', error);
    }
  };

  const handleMouseDown = (blockId: string, dragType: 'top' | 'bottom', event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    const block = timeBlocks.find(b => b.id === blockId);
    if (!block || block.user_id !== user?.id) return;
    
    setDragState({
      blockId,
      dragType,
      startY: event.clientY,
      originalStart: block.start_time,
      originalEnd: block.end_time
    });
  };

  const handleMouseMove = (event: MouseEvent) => {
    if (!dragState.blockId || !dragState.dragType) return;
    
    const deltaY = event.clientY - dragState.startY;
    const deltaMinutes = Math.round((deltaY / 30) * 30); // 30px = 30 minutes
    
    // Snap to 30-minute increments (simpler and more predictable)
    const snappedDeltaMinutes = Math.round(deltaMinutes / 30) * 30;
    
    const block = timeBlocks.find(b => b.id === dragState.blockId);
    if (!block) return;
    
    let newStart = timeToMinutes(dragState.originalStart);
    let newEnd = timeToMinutes(dragState.originalEnd);
    
    if (dragState.dragType === 'top') {
      newStart = Math.max(startHour * 60, Math.min(newStart + snappedDeltaMinutes, newEnd - 30)); // Min 30 min duration
    } else {
      newEnd = Math.min(endHour * 60, Math.max(newEnd + snappedDeltaMinutes, newStart + 30)); // Min 30 min duration
    }
    
    // Update the time block temporarily (visual feedback)
    setTimeBlocks(prev => prev.map(b => 
      b.id === dragState.blockId 
        ? { ...b, start_time: minutesToTime(newStart), end_time: minutesToTime(newEnd) }
        : b
    ));
  };

  const handleMouseUp = async () => {
    if (!dragState.blockId) return;
    
    // Save the changes permanently
    const block = timeBlocks.find(b => b.id === dragState.blockId);
    if (block && block.user_id === user?.id) {
      try {
        const { error } = await supabase
          .from('time_blocks')
          .update({
            start_time: block.start_time,
            end_time: block.end_time
          })
          .eq('id', dragState.blockId);

        if (error) throw error;
      } catch (error) {
        console.error('Error updating time block:', error);
      }
    }
    
    setDragState({
      blockId: null,
      dragType: null,
      startY: 0,
      originalStart: '',
      originalEnd: ''
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
      
      // Get time blocks for this group first
      const { data: timeBlocksData, error: timeBlocksError } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('group_id', groupId);

      if (timeBlocksError) throw timeBlocksError;

      // Get profiles for the users with time blocks
      const userIds = [...new Set((timeBlocksData || []).map(block => block.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, first_name, last_name, color')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Apply user visibility filter for busy mode
      let filteredBlocks = timeBlocksData || [];
      if (viewMode === 'busy' && visibleUsers && visibleUsers.size > 0) {
        filteredBlocks = filteredBlocks.filter(block => 
          visibleUsers.has(block.user_id)
        );
      }
      
      // Create profiles map
      const profilesMap: {[userId: string]: ProfileData} = {};
      (profilesData || []).forEach(profile => {
        profilesMap[profile.user_id] = {
          id: profile.user_id,
          username: profile.username,
          first_name: profile.first_name,
          last_name: profile.last_name,
          color: profile.color
        };
      });
      
      // Add display names to time blocks
      const blocksWithDisplayNames = filteredBlocks.map(block => {
        const profile = profilesMap[block.user_id];
        return {
          ...block,
          displayName: getDisplayName(profile)
        };
      });

      setProfiles(profilesMap);
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

    // Set up polling to refresh data every 5 seconds
    const interval = setInterval(fetchTimeBlocks, 5000);
    
    return () => clearInterval(interval);
  }, [groupId, visibleUsers]); // Added visibleUsers as dependency

  // Set up realtime subscription for time blocks
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel('time_blocks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_blocks',
          filter: `group_id=eq.${groupId}`
        },
        () => fetchTimeBlocks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId]);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const getTimeBlocksForDay = (dayIndex: number) => {
    return timeBlocks.filter(block => block.day_of_week === dayIndex);
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
    
    const top = (startMinutes / 30) * 30; // 30px per 30-minute slot
    const height = ((endMinutes - startMinutes) / 30) * 30; // 30px per 30-minute slot
    
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
            {TIME_SLOTS.map((timeSlot, index) => (
              <div key={timeSlot.time} className={`h-[30px] text-xs text-slate-600 flex items-center justify-end pr-2 ${
                timeSlot.minute === 0 ? 'border-t border-slate-300 font-medium' : 'border-t border-slate-100'
              }`}>
                {timeSlot.minute === 0 && (
                  <div className="text-right text-xs leading-none">
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
                  className={`h-[30px] border-t border-slate-100 hover:bg-blue-50/40 transition-colors cursor-pointer group ${
                    timeSlot.minute === 0 ? 'border-t-slate-200' : ''
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
                const currentUserColor = profiles[block.user_id]?.color || block.color || '#3b82f6';
                
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
    </div>
  );
};

export default WeeklyCalendar;