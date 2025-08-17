import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, Calendar, Users, Settings, Palette, Eye, EyeOff, Clock, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import GroupManager from '@/components/GroupManager';
import WeeklyCalendar from '@/components/WeeklyCalendar';

// Group-specific color system
const USER_GROUP_COLORS_KEY = 'meanwhile_user_group_colors';
// Calendar settings system
const CALENDAR_SETTINGS_KEY = 'meanwhile_calendar_settings';

interface UserGroupColors {
  [userIdGroupId: string]: string; // Format: "userId_groupId"
}

interface UserColors {
  [userId: string]: string;
}

interface CalendarSettings {
  [groupId: string]: {
    startHour: number;
    endHour: number;
    weekStartDay: 'sunday' | 'monday';
  };
}

const getUserGroupColors = (): UserGroupColors => {
  try {
    const stored = localStorage.getItem(USER_GROUP_COLORS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveUserGroupColors = (colors: UserGroupColors) => {
  localStorage.setItem(USER_GROUP_COLORS_KEY, JSON.stringify(colors));
};

const getUserColors = (): UserColors => {
  try {
    const stored = localStorage.getItem('meanwhile_user_colors');
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveUserColors = (colors: UserColors) => {
  localStorage.setItem('meanwhile_user_colors', JSON.stringify(colors));
};

const getCalendarSettings = (): CalendarSettings => {
  try {
    const stored = localStorage.getItem(CALENDAR_SETTINGS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveCalendarSettings = (settings: CalendarSettings) => {
  localStorage.setItem(CALENDAR_SETTINGS_KEY, JSON.stringify(settings));
};

const getGroups = () => {
  try {
    const stored = localStorage.getItem('meanwhile_groups');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Predefined color palette for auto-assignment
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

// Simplified group-specific colors using localStorage for now
const getUserColorForGroup = (userId: string, groupId: string): string => {
  const groupColors = getUserGroupColors();
  const key = `${userId}_${groupId}`;
  
  if (groupColors[key]) {
    return groupColors[key];
  }
  
  // Auto-assign a color based on user ID and group ID hash
  const combined = `${userId}${groupId}`;
  const hashCode = combined.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const colorIndex = Math.abs(hashCode) % DEFAULT_COLORS.length;
  return DEFAULT_COLORS[colorIndex];
};

// Synchronous version that uses loaded state
const getUserColorForGroupSync = (userId: string, groupColors: {[userId: string]: string}): string => {
  if (groupColors[userId]) {
    return groupColors[userId];
  }
  return DEFAULT_COLORS[0]; // fallback
};

const setUserColorForGroup = (userId: string, groupId: string, color: string): boolean => {
  try {
    const groupColors = getUserGroupColors();
    const key = `${userId}_${groupId}`;
    groupColors[key] = color;
    saveUserGroupColors(groupColors);
    return true;
  } catch (error) {
    console.error('Error setting user color for group:', error);
    return false;
  }
};

const isColorTakenInGroup = (color: string, groupId: string, excludeUserId?: string): boolean => {
  const groupColors = getUserGroupColors();
  return Object.entries(groupColors).some(([key, userColor]) => {
    const [userId, keyGroupId] = key.split('_');
    return keyGroupId === groupId && 
           userId !== excludeUserId && 
           userColor.toLowerCase() === color.toLowerCase();
  });
};

const getUserColor = (userId: string): string => {
  const userColors = getUserColors();
  if (userColors[userId]) {
    return userColors[userId];
  }
  
  // Auto-assign a color based on user ID hash
  const hashCode = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const colorIndex = Math.abs(hashCode) % DEFAULT_COLORS.length;
  return DEFAULT_COLORS[colorIndex];
};

const isColorTaken = (color: string, excludeUserId?: string): boolean => {
  const userColors = getUserColors();
  return Object.entries(userColors).some(([userId, userColor]) => 
    userId !== excludeUserId && userColor.toLowerCase() === color.toLowerCase()
  );
};

// Time Range Form Component
const TimeRangeForm = ({ groupId, currentSettings, onUpdate, readOnly = false }: {
  groupId: string;
  currentSettings: { startHour: number; endHour: number; weekStartDay: 'sunday' | 'monday' };
  onUpdate?: (groupId: string, startHour: number, endHour: number, weekStartDay: 'sunday' | 'monday') => void;
  readOnly?: boolean;
}) => {
  const [startHour, setStartHour] = useState(currentSettings.startHour);
  const [endHour, setEndHour] = useState(currentSettings.endHour);
  const [weekStartDay, setWeekStartDay] = useState(currentSettings.weekStartDay);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (startHour >= endHour) {
      alert('Start time must be before end time');
      return;
    }
    if (endHour - startHour < 3) {
      alert('Calendar must span at least 3 hours');
      return;
    }
    if (!readOnly && onUpdate) {
      onUpdate(groupId, startHour, endHour, weekStartDay);
    }
  };

  const formatTime = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return '12 PM';
    return `${hour - 12} PM`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start-hour">Start Time</Label>
          <select
            id="start-hour"
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            disabled={readOnly}
            className="w-full p-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {formatTime(i)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-hour">End Time</Label>
          <select
            id="end-hour"
            value={endHour}
            onChange={(e) => setEndHour(Number(e.target.value))}
            disabled={readOnly}
            className="w-full p-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {formatTime(i)}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="week-start-day">Week Starts On</Label>
        <select
          id="week-start-day"
          value={weekStartDay}
          onChange={(e) => setWeekStartDay(e.target.value as 'sunday' | 'monday')}
          disabled={readOnly}
          className="w-full p-2 border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="sunday">Sunday</option>
          <option value="monday">Monday</option>
        </select>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Current: {formatTime(currentSettings.startHour)} - {formatTime(currentSettings.endHour)}, Week starts on {currentSettings.weekStartDay === 'sunday' ? 'Sunday' : 'Monday'}
      </div>
      {!readOnly && (
        <div className="flex gap-2 pt-4">
          <Button type="submit">Update Time Range</Button>
          <Button type="button" variant="outline" onClick={() => {}}>
            Cancel
          </Button>
        </div>
      )}
    </form>
  );
};

const Index = () => {
  const { user, signOut, loading } = useAuth();
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [viewMode, setViewMode] = useState<'busy' | 'free'>('busy');
  // Removed refreshKey - calendar updates automatically without forced refreshes
  const [visibleUsers, setVisibleUsers] = useState<Set<string>>(new Set());
  const [groupMembers, setGroupMembers] = useState<Array<{id: string, username: string, firstName?: string, lastName?: string}>>([]);
  const [userColor, setUserColor] = useState('#3b82f6');
  const [userColors, setUserColors] = useState<UserColors>({});
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>({});
  const [showTimeSettings, setShowTimeSettings] = useState(false);
  const [showCopySchedule, setShowCopySchedule] = useState(false);
  const [sourceGroupId, setSourceGroupId] = useState<string>('');
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [copyLoading, setCopyLoading] = useState(false);
  const [userGroups, setUserGroups] = useState<Array<{id: string, name: string}>>([]);
  const [groupMembersList, setGroupMembersList] = useState<Array<{id: string, username: string, firstName?: string, lastName?: string}>>([]);
  const [groupColors, setGroupColors] = useState<{[userId: string]: string}>({});
  const [isAdmin, setIsAdmin] = useState(false);
  // Realtime color updates
  const [colorChannelActive, setColorChannelActive] = useState(false);

  // Initialize user color and load from database/localStorage
  useEffect(() => {
    const loadColors = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('color')
            .eq('user_id', user.id)
            .single();
          const dbColor = data?.color;
          const effectiveColor = (typeof dbColor === 'string' && dbColor.length > 0) ? dbColor : getUserColor(user.id);
          setUserColor(effectiveColor);
          setUserColors(prev => ({ ...prev, [user.id!]: effectiveColor }));
        } catch {
          // Fallback to local storage
          setUserColor(getUserColor(user.id));
        }
      }
      // Do not override member map with local storage; only use local for unknown users
    };
    loadColors();
  }, [user?.id]);

  // Listen for user color changes and update the state
  useEffect(() => {
    const handleColorChange = () => {
      if (user?.id) {
        const updated = getUserColor(user.id);
        setUserColor(updated);
        // Only update the current user's color in the map to avoid wiping others
        setUserColors(prev => ({ ...prev, [user.id]: updated }));
      }
    };

    window.addEventListener('userColorChanged', handleColorChange);
    return () => window.removeEventListener('userColorChanged', handleColorChange);
  }, [user?.id]);

  // Load user groups for copy functionality
  useEffect(() => {
    const fetchUserGroups = async () => {
      if (!user?.id) return;
      
      try {
        const { data: memberData, error } = await supabase
          .from('group_members')
          .select(`
            group_id,
            groups!inner(id, name)
          `)
          .eq('user_id', user.id);
        
        if (error) throw error;
        
        const groups = memberData?.map((m: any) => ({
          id: m.groups.id,
          name: m.groups.name
        })) || [];
        
        console.log('Fetched user groups:', groups);
        
        setUserGroups(groups);
      } catch (error) {
        console.error('Error fetching user groups:', error);
      }
    };
    
    fetchUserGroups();
  }, [user?.id]);

  // Fetch group members when selectedGroupId changes
  useEffect(() => {
    const fetchGroupMembers = async () => {
      if (!selectedGroupId || !user?.id) {
        setGroupMembersList([]);
        setVisibleUsers(new Set());
        return;
      }

      try {
        const { data: memberData, error } = await supabase
          .from('group_members')
          .select(`
            user_id,
            profiles!inner(user_id, username, first_name, last_name)
          `)
          .eq('group_id', selectedGroupId);
        
        if (error) throw error;
        
        const members = memberData?.map((m: any) => ({
          id: m.profiles.user_id,
          username: m.profiles.username || 'Unknown',
          firstName: m.profiles.first_name || '',
          lastName: m.profiles.last_name || ''
        })) || [];
        
        setGroupMembersList(members);
        // Initially show all users
        setVisibleUsers(new Set(members.map(m => m.id)));
        setGroupMembers(members);

        // Generate group-specific colors for all members
        const updatedColors: UserColors = {};
        const groupColors: {[userId: string]: string} = {};
        
        members.forEach(member => {
          const groupColor = getUserColorForGroup(member.id, selectedGroupId);
          updatedColors[member.id] = groupColor;
          groupColors[member.id] = groupColor;
        });
        
        setUserColors(updatedColors);
        setGroupColors(groupColors);
        
      } catch (error) {
        console.error('Error fetching group members:', error);
        setGroupMembersList([]);
        setVisibleUsers(new Set());
      }
    };

    fetchGroupMembers();
  }, [selectedGroupId, user?.id]);

  // Load calendar settings
  useEffect(() => {
    setCalendarSettings(getCalendarSettings());
  }, []);

  // Check if current user is group admin (creator)
  const isGroupAdmin = async (groupId: string): Promise<boolean> => {
    if (!user?.id || !groupId) return false;
    
    try {
      const { data: group, error } = await supabase
        .from('groups')
        .select('created_by')
        .eq('id', groupId)
        .single();
      
      if (error) return false;
      return group?.created_by === user.id;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  };

  // Get calendar time settings for current group
  const getGroupTimeSettings = (groupId: string) => {
    return calendarSettings[groupId] || { startHour: 7, endHour: 21, weekStartDay: 'sunday' as const };
  };

  // Update calendar time settings
  const updateTimeSettings = (groupId: string, startHour: number, endHour: number, weekStartDay: 'sunday' | 'monday') => {
    const newSettings = {
      ...calendarSettings,
      [groupId]: { startHour, endHour, weekStartDay }
    };
    setCalendarSettings(newSettings);
    saveCalendarSettings(newSettings);
    setShowTimeSettings(false);
    // Calendar will automatically re-render due to props change - no need to force refresh
    toast({
      title: "Calendar Updated",
      description: `Calendar time range set to ${startHour < 12 ? startHour : startHour === 12 ? 12 : startHour - 12}${startHour < 12 ? 'AM' : 'PM'} - ${endHour < 12 ? endHour : endHour === 12 ? 12 : endHour - 12}${endHour < 12 ? 'AM' : 'PM'}, Week starts on ${weekStartDay === 'sunday' ? 'Sunday' : 'Monday'}`,
    });
  };

  const updateUserColor = (newColor: string) => {
    if (!user?.id || !selectedGroupId) return;
    
    // Check if color is taken in this group
    const colorTaken = isColorTakenInGroup(newColor, selectedGroupId, user.id);
    if (colorTaken) {
      toast({
        title: "Color already taken",
        description: "Another user is already using this color in this group. Please choose a different one.",
        variant: "destructive"
      });
      return;
    }

    // Update group-specific color in localStorage
    const success = setUserColorForGroup(user.id, selectedGroupId, newColor);
    if (!success) {
      toast({
        title: "Error updating color",
        description: "Failed to save color. Please try again.",
        variant: "destructive"
      });
      return;
    }

    // Update local state
    setUserColor(newColor);
    setUserColors(prev => ({ ...prev, [user.id]: newColor }));
    setGroupColors(prev => ({ ...prev, [user.id]: newColor }));
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('userColorChanged'));
    
    toast({
      title: "Color updated",
      description: "Your color for this group has been successfully updated!"
    });
  };

  // Helper function to convert time to minutes for overlap detection
  const timeToMinutes = (timeString: string): number => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Copy schedule functionality
  const copyScheduleToGroup = async (sourceGroupId: string, targetGroupId: string, userId: string): Promise<boolean> => {
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

  const handleCopySchedule = async () => {
    if (!user || !sourceGroupId || !targetGroupId) return;

    if (sourceGroupId === targetGroupId) {
      toast({
        title: "Invalid selection",
        description: "Source and target groups must be different.",
        variant: "destructive",
      });
      return;
    }

    setCopyLoading(true);
    try {
      await copyScheduleToGroup(sourceGroupId, targetGroupId, user.id);
      
      const sourceGroup = userGroups.find(g => g.id === sourceGroupId);
      const targetGroup = userGroups.find(g => g.id === targetGroupId);
      
      toast({
        title: "Schedule copied!",
        description: `Successfully copied your schedule from "${sourceGroup?.name}" to "${targetGroup?.name}".`,
      });

      setShowCopySchedule(false);
      setSourceGroupId('');
      setTargetGroupId('');
    } catch (error: any) {
      toast({
        title: "Error copying schedule",
        description: error.message || "Failed to copy schedule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCopyLoading(false);
    }
  };

  // Realtime subscription: reflect profile color changes immediately
  useEffect(() => {
    // Only when we have a group selected and some members loaded
    if (!selectedGroupId || groupMembers.length === 0) return;

    // Avoid duplicate subscriptions
    if (colorChannelActive) return;

    const channel = supabase
      .channel('profiles-color-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
        const newUserId = payload?.new?.user_id;
        const newColor = payload?.new?.color;
        if (!newUserId || typeof newColor !== 'string') return;
        // Only update if this user is part of current group
        const isMember = groupMembers.some((m: any) => m.id === newUserId);
        if (!isMember) return;
        setUserColors(prev => ({ ...prev, [newUserId]: newColor }));
        if (user?.id === newUserId) setUserColor(newColor);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setColorChannelActive(true);
      });

    return () => {
      supabase.removeChannel(channel);
      setColorChannelActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId, groupMembers.map((m: any) => m.id).join(','), user?.id]);

  // Check admin status when group changes
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (selectedGroupId) {
        const adminStatus = await isGroupAdmin(selectedGroupId);
        setIsAdmin(adminStatus);
      } else {
        setIsAdmin(false);
      }
    };
    
    checkAdminStatus();
  }, [selectedGroupId, user?.id]);

  const toggleUserVisibility = (userId: string) => {
    setVisibleUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const toggleShowMine = () => {
    if (user?.id) {
      // If currently showing only the user, show everyone
      if (visibleUsers.size === 1 && visibleUsers.has(user.id)) {
        setVisibleUsers(new Set(groupMembers.map(member => member.id)));
      } else {
        // Otherwise, show only the current user
        setVisibleUsers(new Set([user.id]));
      }
    }
  };

  const getDisplayName = (member: any) => {
    if (member.firstName && member.lastName) {
      return `${member.firstName} ${member.lastName.charAt(0)}`;
    }
    return member.username;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleScheduleAdded = () => {
    // The calendar will automatically update through optimistic updates or realtime subscriptions
    // No need to force refresh the entire component
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Meanwhile</h1>
              <p className="text-sm text-muted-foreground">
                Shared weekly calendars for friends
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.username}!
            </span>
            <Button 
              onClick={signOut}
              variant="outline"
              className="font-body"
            >
              Log Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <GroupManager 
              onGroupSelect={setSelectedGroupId}
              selectedGroupId={selectedGroupId}
            />
            
            {/* User Filter for Who's Busy mode */}
            {selectedGroupId && viewMode === 'busy' && groupMembers.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Users
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleShowMine}
                      className="text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      {visibleUsers.size === 1 && user?.id && visibleUsers.has(user.id) 
                        ? 'Show All' 
                        : 'Show Mine'
                      }
                    </Button>
                  </div>
                  <CardDescription>
                    Uncheck users to hide their schedules
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
                    {groupMembers.map((member) => (
                      <div key={member.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`user-${member.id}`}
                          checked={visibleUsers.has(member.id)}
                          onCheckedChange={() => toggleUserVisibility(member.id)}
                        />
                        <Label
                          htmlFor={`user-${member.id}`}
                          className="text-sm font-medium cursor-pointer flex items-center gap-2"
                        >
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ 
                              backgroundColor: getUserColorForGroupSync(member.id, groupColors),
                              opacity: visibleUsers.has(member.id) ? 1 : 0.3
                            }}
                          />
                          <span className={visibleUsers.has(member.id) ? '' : 'text-muted-foreground'}>
                            {getDisplayName(member)}
                            {member.id === user?.id && ' (You)'}
                          </span>
                        </Label>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                    Showing {visibleUsers.size} of {groupMembers.length} users
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* User Color Settings */}
            {user && (
              <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Your Color
                    </CardTitle>
                  <CardDescription>
                    Choose a unique color for your events in this group
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 items-center">
                    <div 
                      className="w-12 h-12 rounded-lg border-2 border-gray-200 cursor-pointer relative overflow-hidden shadow-sm"
                      title="Click to change your color"
                    >
                      <input
                        type="color"
                        value={selectedGroupId && user?.id ? getUserColorForGroupSync(user.id, groupColors) : userColor}
                        onChange={(e) => updateUserColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div 
                        className="w-full h-full rounded-lg"
                        style={{ backgroundColor: selectedGroupId && user?.id ? getUserColorForGroupSync(user.id, groupColors) : userColor }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {(selectedGroupId && user?.id ? getUserColorForGroupSync(user.id, groupColors) : userColor).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Each user must have a unique color in this group
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedGroupId ? (
              <div className="space-y-6">
                {/* Calendar */}
                <div className="bg-white rounded-lg border shadow-sm">
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold flex items-center gap-2 font-heading">
                        <Calendar className="h-4 w-4" />
                        Group Schedule
                      </h3>
                      <div className="flex items-center gap-3">
                        {/* Copy Schedule Button */}
                        {selectedGroupId && userGroups.length >= 1 && (
                          <Dialog open={showCopySchedule} onOpenChange={setShowCopySchedule}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8">
                                <CalendarDays className="h-3 w-3 mr-1" />
                                Copy Schedule
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Copy Schedule Between Groups</DialogTitle>
                                <DialogDescription>
                                  Copy your schedule from one group to another. This will duplicate all your time blocks.
                                </DialogDescription>
                              </DialogHeader>
                              
                              <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                  <Label htmlFor="sourceGroup">Copy From (Source Group)</Label>
                                  <Select value={sourceGroupId} onValueChange={setSourceGroupId}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select source group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {userGroups.map((group) => (
                                        <SelectItem key={group.id} value={group.id}>
                                          {group.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="targetGroup">Copy To (Target Group)</Label>
                                  <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select target group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {userGroups
                                        .filter(group => group.id !== sourceGroupId)
                                        .map((group) => (
                                          <SelectItem key={group.id} value={group.id}>
                                            {group.name}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                                  <div className="font-medium text-yellow-800 mb-1">⚠️ Important Notes:</div>
                                  <ul className="text-yellow-700 space-y-1 list-disc list-inside">
                                    <li>This will copy ALL your time blocks from the source group</li>
                                    <li>The copy will fail if any time conflicts are detected</li>
                                    <li>Your color preferences will be maintained</li>
                                  </ul>
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setShowCopySchedule(false)} className="flex-1">
                                  Cancel
                                </Button>
                                <Button 
                                  onClick={handleCopySchedule}
                                  disabled={copyLoading || !sourceGroupId || !targetGroupId}
                                  className="flex-1"
                                >
                                  {copyLoading ? 'Copying...' : 'Copy Schedule'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        {/* Time Settings Button */}
                        {selectedGroupId && (
                          <Dialog open={showTimeSettings} onOpenChange={setShowTimeSettings}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-8">
                                <Clock className="h-3 w-3 mr-1" />
                                Time Settings
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle>Calendar Time Range</DialogTitle>
                                <DialogDescription>
                                  {isAdmin 
                                    ? "Set the calendar time range for all group members."
                                    : "View the current calendar time range settings."
                                  }
                                </DialogDescription>
                              </DialogHeader>
                              <TimeRangeForm 
                                groupId={selectedGroupId}
                                currentSettings={getGroupTimeSettings(selectedGroupId)}
                                onUpdate={isAdmin ? updateTimeSettings : undefined}
                                readOnly={!isAdmin}
                              />
                            </DialogContent>
                          </Dialog>
                        )}
                        
                        {/* Who's Busy/Free Toggle */}
                        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'busy' | 'free')}>
                          <TabsList className="h-8">
                            <TabsTrigger value="busy" className="text-xs px-3">Who's Busy</TabsTrigger>
                            <TabsTrigger value="free" className="text-xs px-3">Who's Free</TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <WeeklyCalendar 
                      key={selectedGroupId} // Only re-render when group changes
                      groupId={selectedGroupId} 
                      viewMode={viewMode}
                      visibleUsers={viewMode === 'busy' ? visibleUsers : undefined}
                      startHour={getGroupTimeSettings(selectedGroupId).startHour}
                      endHour={getGroupTimeSettings(selectedGroupId).endHour}
                      weekStartDay={getGroupTimeSettings(selectedGroupId).weekStartDay}
                      userColors={userColors}
                      groupColors={groupColors}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">No Group Selected</h2>
                <p className="text-muted-foreground">
                  Create or join a group to start sharing schedules with friends
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

