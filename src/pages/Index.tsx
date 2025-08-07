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
import { LogOut, Calendar, Users, Settings, Palette, Eye, EyeOff, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import GroupManager from '@/components/GroupManager';
import WeeklyCalendar from '@/components/WeeklyCalendar';

// User color system
const USER_COLORS_KEY = 'meanwhile_user_colors';
// Calendar settings system
const CALENDAR_SETTINGS_KEY = 'meanwhile_calendar_settings';

interface UserColors {
  [userId: string]: string;
}

interface CalendarSettings {
  [groupId: string]: {
    startHour: number;
    endHour: number;
  };
}

const getUserColors = (): UserColors => {
  try {
    const stored = localStorage.getItem(USER_COLORS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveUserColors = (colors: UserColors) => {
  localStorage.setItem(USER_COLORS_KEY, JSON.stringify(colors));
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

const getUserColor = (userId: string): string => {
  const userColors = getUserColors();
  return userColors[userId] || '#3b82f6'; // Default blue if no color set
};

const isColorTaken = (color: string, excludeUserId?: string): boolean => {
  const userColors = getUserColors();
  return Object.entries(userColors).some(([userId, userColor]) => 
    userId !== excludeUserId && userColor.toLowerCase() === color.toLowerCase()
  );
};

// Time Range Form Component
const TimeRangeForm = ({ groupId, currentSettings, onUpdate }: {
  groupId: string;
  currentSettings: { startHour: number; endHour: number };
  onUpdate: (groupId: string, startHour: number, endHour: number) => void;
}) => {
  const [startHour, setStartHour] = useState(currentSettings.startHour);
  const [endHour, setEndHour] = useState(currentSettings.endHour);

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
    onUpdate(groupId, startHour, endHour);
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
            className="w-full p-2 border border-gray-300 rounded-md"
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
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {formatTime(i)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="text-sm text-muted-foreground">
        Current: {formatTime(currentSettings.startHour)} - {formatTime(currentSettings.endHour)}
      </div>
      <div className="flex gap-2 pt-4">
        <Button type="submit">Update Time Range</Button>
        <Button type="button" variant="outline" onClick={() => {}}>
          Cancel
        </Button>
      </div>
    </form>
  );
};

const Index = () => {
  const { user, signOut, loading } = useAuth();
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const [viewMode, setViewMode] = useState<'busy' | 'free'>('busy');
  const [refreshKey, setRefreshKey] = useState(0);
  const [visibleUsers, setVisibleUsers] = useState<Set<string>>(new Set());
  const [groupMembers, setGroupMembers] = useState<Array<{id: string, username: string, firstName?: string, lastName?: string}>>([]);
  const [userColor, setUserColor] = useState('#3b82f6');
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>({});
  const [showTimeSettings, setShowTimeSettings] = useState(false);

  // Initialize user color
  useEffect(() => {
    if (user?.id) {
      setUserColor(getUserColor(user.id));
    }
  }, [user?.id]);

  // Load calendar settings
  useEffect(() => {
    setCalendarSettings(getCalendarSettings());
  }, []);

  // Check if current user is group admin (creator)
  const isGroupAdmin = (groupId: string): boolean => {
    const groups = getGroups();
    const group = groups.find(g => g.id === groupId);
    return group?.created_by === user?.id;
  };

  // Get calendar time settings for current group
  const getGroupTimeSettings = (groupId: string) => {
    return calendarSettings[groupId] || { startHour: 7, endHour: 21 };
  };

  // Update calendar time settings
  const updateTimeSettings = (groupId: string, startHour: number, endHour: number) => {
    const newSettings = {
      ...calendarSettings,
      [groupId]: { startHour, endHour }
    };
    setCalendarSettings(newSettings);
    saveCalendarSettings(newSettings);
    setShowTimeSettings(false);
    setRefreshKey(prev => prev + 1); // Force calendar refresh
    toast({
      title: "Calendar Updated",
      description: `Calendar time range set to ${startHour < 12 ? startHour : startHour === 12 ? 12 : startHour - 12}${startHour < 12 ? 'AM' : 'PM'} - ${endHour < 12 ? endHour : endHour === 12 ? 12 : endHour - 12}${endHour < 12 ? 'AM' : 'PM'}`,
    });
  };

  const updateUserColor = (newColor: string) => {
    if (!user?.id) return;
    
    if (isColorTaken(newColor, user.id)) {
      toast({
        title: "Color already taken",
        description: "Another user is already using this color. Please choose a different one.",
        variant: "destructive"
      });
      return;
    }

    const userColors = getUserColors();
    userColors[user.id] = newColor;
    saveUserColors(userColors);
    setUserColor(newColor);
    
    // Dispatch custom event to notify other components
    window.dispatchEvent(new CustomEvent('userColorChanged'));
    
    toast({
      title: "Color updated",
      description: "Your color has been successfully updated!"
    });
  };

  // Get group members for user filtering
  const fetchGroupMembers = async (groupId: string) => {
    try {
      const storedMembers = localStorage.getItem('meanwhile_group_members');
      const storedUsers = localStorage.getItem('meanwhile_users');
      
      if (!storedMembers || !storedUsers) return;
      
      const allMembers = JSON.parse(storedMembers);
      const allUsers = JSON.parse(storedUsers);
      
      const groupMemberData = allMembers
        .filter((member: any) => member.group_id === groupId)
        .map((member: any) => {
          const userData = allUsers.find((u: any) => u.id === member.user_id);
          return {
            id: member.user_id,
            username: userData?.username || 'Unknown',
            firstName: userData?.firstName,
            lastName: userData?.lastName
          };
        });
      
      setGroupMembers(groupMemberData);
      // Initially show all users
      setVisibleUsers(new Set(groupMemberData.map((member: any) => member.id)));
    } catch (error) {
      console.error('Error fetching group members:', error);
    }
  };

  // Update group members when selectedGroupId changes
  useEffect(() => {
    if (selectedGroupId) {
      fetchGroupMembers(selectedGroupId);
    } else {
      setGroupMembers([]);
      setVisibleUsers(new Set());
    }
  }, [selectedGroupId]);

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

  const toggleAllUsers = () => {
    if (visibleUsers.size === groupMembers.length) {
      // Hide all
      setVisibleUsers(new Set());
    } else {
      // Show all
      setVisibleUsers(new Set(groupMembers.map(member => member.id)));
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
    setRefreshKey(prev => prev + 1);
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
                      Show/Hide Users
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleAllUsers}
                      className="text-xs"
                    >
                      {visibleUsers.size === groupMembers.length ? (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" />
                          Hide All
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3 mr-1" />
                          Show All
                        </>
                      )}
                    </Button>
                  </div>
                  <CardDescription>
                    Toggle visibility of individual users' schedules
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
                              backgroundColor: member.id === user?.id ? '#3b82f6' : '#64748b',
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
                    Choose a unique color for all your events
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
                        value={userColor}
                        onChange={(e) => updateUserColor(e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div 
                        className="w-full h-full rounded-lg"
                        style={{ backgroundColor: userColor }}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {userColor.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Each user must have a unique color
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
                      <h3 className="font-medium text-base font-body">
                        Group Schedule
                      </h3>
                      <div className="flex items-center gap-3">
                        {/* Time Settings Button (for admin) */}
                        {isGroupAdmin(selectedGroupId) && (
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
                                  Set the calendar time range for all group members.
                                </DialogDescription>
                              </DialogHeader>
                              <TimeRangeForm 
                                groupId={selectedGroupId}
                                currentSettings={getGroupTimeSettings(selectedGroupId)}
                                onUpdate={updateTimeSettings}
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
                      key={`${selectedGroupId}-${refreshKey}`}
                      groupId={selectedGroupId} 
                      viewMode={viewMode}
                      visibleUsers={viewMode === 'busy' ? visibleUsers : undefined}
                      startHour={getGroupTimeSettings(selectedGroupId).startHour}
                      endHour={getGroupTimeSettings(selectedGroupId).endHour}
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
