import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, CalendarDays, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import GroupManager from '@/components/GroupManager';
import WeeklyCalendar from '@/components/WeeklyCalendar';
import UserColorPicker from '@/components/UserColorPicker';
import UserVisibilityFilter from '@/components/UserVisibilityFilter';
import TimeRangeSettings from '@/components/TimeRangeSettings';
import CollaborativeNotepad from '@/components/CollaborativeNotepad';

// Import types and utilities
import type { UserColors, CalendarSettings, GroupMemberWithProfile } from '@/types';
import { getUserColorFromId, getUserColorForGroup, getDisplayName } from '@/utils/colorUtils';
import { getCalendarSettings, saveCalendarSettings, getGroupTimeSettings } from '@/utils/storageUtils';
import { formatTime } from '@/utils/timeUtils';
import { debounce } from '@/utils/debounce';
import { fetchGroupColors, setUserColorForGroup } from '@/services/groupColorService';
import { copyScheduleToGroup } from '@/services/scheduleService';



// Removed helper functions - moved to utilities

// Removed - moved to services

// Removed - moved to services

// Removed color management functions - moved to services



// Removed TimeRangeForm - moved to separate component

const Index = () => {
  const { user, signOut, loading } = useAuth();
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [viewMode, setViewMode] = useState<'busy' | 'free'>('busy');
  // Removed refreshKey - calendar updates automatically without forced refreshes
  const [visibleUsers, setVisibleUsers] = useState<Set<string>>(new Set());
  const [groupMembers, setGroupMembers] = useState<GroupMemberWithProfile[]>([]);
  const [userColor, setUserColor] = useState('#3b82f6');
  const [userColors, setUserColors] = useState<UserColors>({});
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>({});
  const [showTimeSettings, setShowTimeSettings] = useState(false);
  const [showCopySchedule, setShowCopySchedule] = useState(false);
  const [sourceGroupId, setSourceGroupId] = useState<string>('');
  const [targetGroupId, setTargetGroupId] = useState<string>('');
  const [copyLoading, setCopyLoading] = useState(false);
  const [userGroups, setUserGroups] = useState<Array<{id: string, name: string}>>([]);
  const [groupMembersList, setGroupMembersList] = useState<GroupMemberWithProfile[]>([]);
  const [groupColors, setGroupColors] = useState<UserColors>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [showNotepad, setShowNotepad] = useState(false);

  // Initialize user color
  useEffect(() => {
    const loadColors = async () => {
      if (user?.id) {
        // Set default user color for fallback
        setUserColor(getUserColorFromId(user.id));
        setUserColors(prev => ({ ...prev, [user.id!]: getUserColorFromId(user.id) }));
      }
    };
    loadColors();
  }, [user?.id]);

  // Listen for user color changes and update the state
  useEffect(() => {
    const handleColorChange = () => {
      if (user?.id) {
        const updated = getUserColorFromId(user.id);
        setUserColor(updated);
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

        // Fetch group-specific colors from database
        const groupColorsFromDB = await fetchGroupColors(selectedGroupId);
        
        // Use existing colors from database, fallback to consistent hash-based colors
        const updatedColors: UserColors = {};
        const finalGroupColors: {[userId: string]: string} = {};
        
        for (const member of members) {
          let memberColor = groupColorsFromDB[member.id];
          if (!memberColor) {
            // Use consistent hash-based color instead of random assignment
            memberColor = getUserColorFromId(member.id);
          }
          updatedColors[member.id] = memberColor;
          finalGroupColors[member.id] = memberColor;
        }
        
        setUserColors(updatedColors);
        setGroupColors(finalGroupColors);
        
      } catch (error) {
        console.error('Error fetching group members:', error);
        setGroupMembersList([]);
        setVisibleUsers(new Set());
      }
    };

    fetchGroupMembers();
  }, [selectedGroupId, user?.id]);

  // Real-time subscription for group color changes
  useEffect(() => {
    if (!selectedGroupId) return;

    const subscription = supabase
      .channel(`group_colors:${selectedGroupId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_group_colors',
          filter: `group_id=eq.${selectedGroupId}`
        },
        async (payload) => {
          console.log('Color change detected:', payload);
          
          try {
            // Refresh group colors when any color changes in this group
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
              const updatedGroupColors = await fetchGroupColors(selectedGroupId);
              setGroupColors(updatedGroupColors);
              setUserColors(updatedGroupColors);
              
              // Update current user's color state if it changed
              if (user?.id && updatedGroupColors[user.id]) {
                setUserColor(updatedGroupColors[user.id]);
              }
              
              console.log('Group colors updated from real-time event:', updatedGroupColors);
            }
          } catch (error) {
            console.error('Error handling real-time color update:', error);
          }
        }
      )
      .subscribe((status) => {
        console.log('Color subscription status:', status);
      });

    return () => {
      subscription.unsubscribe();
    };
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

  // Get calendar time settings for current group - using utility function
  const getCurrentGroupTimeSettings = (groupId: string) => {
    return getGroupTimeSettings(groupId, calendarSettings);
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
    toast({
      title: "Calendar Updated",
      description: `Calendar time range set to ${formatTime(startHour)} - ${formatTime(endHour)}, Week starts on ${weekStartDay === 'sunday' ? 'Sunday' : 'Monday'}`,
    });
  };

  // Debounced version that only shows toast after user stops dragging
  const debouncedUpdateUserColor = useCallback(
    debounce(async (newColor: string) => {
      if (!user?.id || !selectedGroupId) {
        console.error('Missing user ID or group ID for color update');
        return;
      }
      
      const normalizedColor = (newColor || '').toLowerCase();
      console.log('Starting debounced color update:', { userId: user.id, groupId: selectedGroupId, newColor: normalizedColor });
      
      try {
        // Update group-specific color using the atomic RPC
        console.log('Saving color to database via RPC...');
        const result = await setUserColorForGroup(user.id, selectedGroupId, normalizedColor);
        
        if (!result.success) {
          console.error('Failed to save color to database:', result.error);
          
          // Handle specific error cases
          if (result.error === 'color_taken') {
            toast({
              title: "Color already taken",
              description: "Another user is already using this color in this group. Please choose a different one.",
              variant: "destructive"
            });
            return;
          }
          
          if (result.error === 'not_group_member') {
            toast({
              title: "Access denied",
              description: "You must be a member of this group to change colors.",
              variant: "destructive"
            });
            return;
          }
          
          // Generic error
          toast({
            title: "Error updating color",
            description: `Failed to save color: ${result.error}`,
            variant: "destructive"
          });
          return;
        }

        console.log('Color saved successfully, updating UI...');
        
        // Refresh group colors from database to ensure consistency
        try {
          const updatedGroupColors = await fetchGroupColors(selectedGroupId);
          setGroupColors(updatedGroupColors);
          setUserColors(updatedGroupColors);
        } catch (fetchError) {
          console.warn('Could not refresh group colors, but color update succeeded:', fetchError);
        }
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('userColorChanged'));
        
        console.log('Color update completed successfully');
        toast({
          title: "Color updated",
          description: "Your color has been updated successfully!"
        });
      } catch (error) {
        console.error('Error in updateUserColor:', error);
        toast({
          title: "Error updating color",
          description: `An unexpected error occurred: ${error instanceof Error ? error.message : 'Unknown error'}. Check browser console for details.`,
          variant: "destructive"
        });
      }
    }, 1000), // Wait 1 second after user stops dragging
    [user?.id, selectedGroupId]
  );

  // Immediate UI update function (no toast, no database save)
  const updateUserColorImmediate = (newColor: string) => {
    if (!user?.id) return;
    
    const normalizedColor = (newColor || '').toLowerCase();
    
    // Update local state immediately for smooth UI experience
    setUserColor(normalizedColor);
    setUserColors(prev => ({ ...prev, [user.id]: normalizedColor }));
    setGroupColors(prev => ({ ...prev, [user.id]: normalizedColor }));
    
    // Trigger debounced database save
    debouncedUpdateUserColor(normalizedColor);
  };

  // Copy schedule functionality - moved to service

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
            <UserVisibilityFilter
              selectedGroupId={selectedGroupId}
              viewMode={viewMode}
              groupMembers={groupMembers}
              visibleUsers={visibleUsers}
              groupColors={groupColors}
              currentUserId={user?.id}
              onToggleUserVisibility={toggleUserVisibility}
              onToggleShowMine={toggleShowMine}
            />
            
            {/* User Color Settings */}
            {user && (
              <UserColorPicker
                user={user}
                selectedGroupId={selectedGroupId}
                groupColors={groupColors}
                userColor={userColor}
                onColorChange={updateUserColorImmediate}
              />
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedGroupId ? (
              <Tabs defaultValue="calendar" className="space-y-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="calendar" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Schedule
                  </TabsTrigger>
                  <TabsTrigger value="notepad" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notepad
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="calendar">
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
                              <TimeRangeSettings 
                                groupId={selectedGroupId}
                                currentSettings={getCurrentGroupTimeSettings(selectedGroupId)}
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
                      startHour={getCurrentGroupTimeSettings(selectedGroupId).startHour}
                      endHour={getCurrentGroupTimeSettings(selectedGroupId).endHour}
                      weekStartDay={getCurrentGroupTimeSettings(selectedGroupId).weekStartDay}
                      userColors={userColors}
                      groupColors={groupColors}
                    />
                  </div>
                </div>
                </TabsContent>
                
                <TabsContent value="notepad">
                  {/* Notepad */}
                  <CollaborativeNotepad groupId={selectedGroupId} />
                </TabsContent>
              </Tabs>
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

