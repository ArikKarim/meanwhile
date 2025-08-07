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
import { Users, Copy, Trash2, Crown, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Group {
  id: string;
  name: string;
  code: string;
  created_by: string;
  member_count?: number;
}

interface GroupManagerProps {
  onGroupSelect: (groupId: string) => void;
  selectedGroupId?: string;
}


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
      // Get groups where user is a member
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select(`
          *,
          group_members!inner(user_id)
        `)
        .eq('group_members.user_id', user.id);

      if (groupsError) throw groupsError;

      // Get member counts for each group
      const groupsWithCounts = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          
          return {
            ...group,
            member_count: count || 0
          };
        })
      );

      setGroups(groupsWithCounts);
      
      // Auto-select first group if none selected and current selection is invalid
      if (groupsWithCounts.length > 0 && (!selectedGroupId || !groupsWithCounts.find(g => g.id === selectedGroupId))) {
        onGroupSelect(groupsWithCounts[0].id);
      } else if (groupsWithCounts.length === 0) {
        // If no groups left, clear selection
        onGroupSelect('');
      }
    } catch (error: any) {
      toast({
        title: "Error loading groups",
        description: error.message,
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
      // Use Supabase function to generate unique code
      const { data: codeResult, error: codeError } = await supabase.rpc('generate_group_code');
      if (codeError) throw codeError;

      // Create group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: name.trim(),
          code: codeResult,
          created_by: user.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id
        });

      if (memberError) throw memberError;

      toast({
        title: "Group created!",
        description: `Share code "${codeResult}" with friends to invite them.`,
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
      // Find group by code
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .ilike('code', code.toUpperCase())
        .single();

      if (groupError || !groupData) {
        throw new Error('Group not found. Please check the code and try again.');
      }

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupData.id)
        .eq('user_id', user.id)
        .single();

      if (existingMember) {
        throw new Error('You are already a member of this group.');
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id
        });

      if (memberError) throw memberError;

      toast({
        title: "Joined group!",
        description: `You've successfully joined "${groupData.name}".`,
      });

      (e.target as HTMLFormElement).reset();
      fetchGroups();
    } catch (error: any) {
      toast({
        title: "Error joining group",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setJoinLoading(false);
    }
  };

  const deleteGroup = async (groupId: string, groupName: string) => {
    if (!user) return;

    try {
      // Find the group to check if user is the creator
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError || !groupData) {
        throw new Error('Group not found.');
      }

      // Only allow creator to delete the group
      if (groupData.created_by !== user.id) {
        throw new Error('Only the group creator can delete this group.');
      }

      // Delete all time blocks for this group
      await supabase
        .from('time_blocks')
        .delete()
        .eq('group_id', groupId);

      // Delete all members from the group
      await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId);

      // Delete group settings
      await supabase
        .from('group_settings')
        .delete()
        .eq('group_id', groupId);

      // Delete the group
      const { error: deleteError } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

      if (deleteError) throw deleteError;

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
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
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
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
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
                          <span className="text-xs text-muted-foreground">
                            {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                          </span>
                          {group.created_by === user?.id ? (
                            <Crown className="h-4 w-4 text-yellow-600" />
                          ) : (
                            <User className="h-4 w-4 text-blue-600" />
                          )}
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