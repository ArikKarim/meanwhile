import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Users, Copy, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Group {
  id: string;
  name: string;
  code: string;
  created_by: string;
}

interface GroupManagerProps {
  onGroupSelect: (groupId: string) => void;
  selectedGroupId?: string;
}

// Supabase database functions
interface StoredGroup {
  id: string;
  name: string;
  code: string;
  created_by: string;
  created_at: string;
}

interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
}

interface TimeBlock {
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

const getStoredGroups = async (): Promise<StoredGroup[]> => {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching groups:', error);
    return [];
  }
};

const saveStoredGroup = async (group: Omit<StoredGroup, 'id' | 'created_at'>): Promise<StoredGroup | null> => {
  try {
    const { data, error } = await supabase
      .from('groups')
      .insert([group])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving group:', error);
    return null;
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

const saveGroupMember = async (member: Omit<GroupMember, 'id' | 'joined_at'>): Promise<GroupMember | null> => {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .insert([member])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error saving group member:', error);
    return null;
  }
};

const getTimeBlocks = async (): Promise<TimeBlock[]> => {
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

const deleteGroupById = async (groupId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('groups')
      .delete()
      .eq('id', groupId);
    
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting group:', error);
    return false;
  }
};

const generateGroupCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const GroupManager = ({ onGroupSelect, selectedGroupId }: GroupManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLoading, setCreateLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user]);

  const fetchGroups = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const allGroups = await getStoredGroups();
      const allMembers = await getGroupMembers();
      
      // Get groups where user is a member
      const userMemberGroups = allMembers
        .filter(member => member.user_id === user.id)
        .map(member => member.group_id);
      
      const userGroups = allGroups.filter(group => userMemberGroups.includes(group.id));
      
      setGroups(userGroups);
      
      // Auto-select first group if none selected and current selection is invalid
      if (userGroups.length > 0 && (!selectedGroupId || !userGroups.find(g => g.id === selectedGroupId))) {
        onGroupSelect(userGroups[0].id);
      } else if (userGroups.length === 0) {
        // If no groups left, clear selection
        onGroupSelect('');
      }
    } catch (error: any) {
      toast({
        title: "Error loading groups",
        description: error?.message || 'Failed to load groups',
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setCreateLoading(true);
    const formData = new FormData(e.currentTarget);
    const name = formData.get('groupName') as string;

    try {
      const allGroups = await getStoredGroups();
      
      // Generate unique code
      let code = '';
      let isUnique = false;
      let attempts = 0;
      
      while (!isUnique && attempts < 10) {
        code = generateGroupCode();
        isUnique = !allGroups.find(g => g.code === code);
        attempts++;
      }
      
      if (!isUnique) {
        throw new Error('Failed to generate unique group code. Please try again.');
      }

      // Create the group in database
      const newGroup = await saveStoredGroup({
        name: name.trim(),
        code,
        created_by: user.id
      });

      if (!newGroup) {
        throw new Error('Failed to create group. Please try again.');
      }

      // Add creator as member
      const newMember = await saveGroupMember({
        group_id: newGroup.id,
        user_id: user.id
      });

      if (!newMember) {
        // If member creation fails, we should clean up the group
        await deleteGroupById(newGroup.id);
        throw new Error('Failed to add you as group member. Please try again.');
      }

      toast({
        title: "Group created!",
        description: `Share code "${code}" with friends to invite them.`,
      });

      (e.target as HTMLFormElement).reset();
      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error creating group",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const joinGroup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    setJoinLoading(true);
    const formData = new FormData(e.currentTarget);
    const code = formData.get('groupCode') as string;

    try {
      const allGroups = await getStoredGroups();
      const group = allGroups.find(g => g.code.toUpperCase() === code.toUpperCase());

      if (!group) {
        throw new Error('Group not found. Please check the code and try again.');
      }

      // Check if user is already a member
      const allMembers = await getGroupMembers();
      const existingMember = allMembers.find(m => 
        m.group_id === group.id && m.user_id === user.id
      );

      if (existingMember) {
        throw new Error('You are already a member of this group.');
      }

      // Add user as member
      const newMember = await saveGroupMember({
        group_id: group.id,
        user_id: user.id
      });

      if (!newMember) {
        throw new Error('Failed to join group. Please try again.');
      }

      toast({
        title: "Joined group!",
        description: `You've successfully joined "${group.name}".`,
      });

      (e.target as HTMLFormElement).reset();
      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error joining group",
        description: error?.message || 'Failed to join group',
        variant: "destructive",
      });
    } finally {
      setJoinLoading(false);
    }
  };

  const deleteGroup = async (groupId: string, groupName: string) => {
    if (!user) return;

    try {
      // Get current data
      const allGroups = await getStoredGroups();
      const group = allGroups.find(g => g.id === groupId);
      
      if (!group) {
        throw new Error('Group not found.');
      }

      // Only allow creator to delete the group
      if (group.created_by !== user.id) {
        throw new Error('Only the group creator can delete this group.');
      }

      // Delete the group (this will cascade delete members and time blocks due to foreign key constraints)
      const success = await deleteGroupById(groupId);
      
      if (!success) {
        throw new Error('Failed to delete group. Please try again.');
      }

      toast({
        title: "Group deleted",
        description: `"${groupName}" and all its data have been deleted.`,
      });

      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error deleting group",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const copyGroupCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copied!",
      description: "Group code copied to clipboard.",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading groups...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Groups
        </CardTitle>
        <CardDescription>
          Create a new group or join an existing one
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="groups" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="groups">My Groups</TabsTrigger>
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="join">Join</TabsTrigger>
          </TabsList>
          
          <TabsContent value="groups" className="mt-4">
            <div className="space-y-2">
              {groups.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  No groups yet. Create or join one to get started!
                </p>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedGroupId === group.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => onGroupSelect(group.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold font-body text-base truncate">{group.name}</h4>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {group.code}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyGroupCode(group.code);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {group.created_by === user?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                className="text-destructive hover:text-destructive h-8 w-8 p-0"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Group</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{group.name}"? This will permanently delete the group, remove all members, and delete all schedules. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteGroup(group.id, group.name)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete Group
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="create" className="mt-4">
            <form onSubmit={createGroup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groupName">Group Name</Label>
                <Input
                  id="groupName"
                  name="groupName"
                  placeholder="e.g., Study Group, Friend Circle"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={createLoading}>
                {createLoading ? 'Creating...' : 'Create Group'}
              </Button>
            </form>
          </TabsContent>
          
          <TabsContent value="join" className="mt-4">
            <form onSubmit={joinGroup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="groupCode">Group Code</Label>
                <Input
                  id="groupCode"
                  name="groupCode"
                  placeholder="Enter 6-character code"
                  maxLength={6}
                  style={{ textTransform: 'uppercase' }}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={joinLoading}>
                {joinLoading ? 'Joining...' : 'Join Group'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default GroupManager;