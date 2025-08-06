import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Users, Copy, LogOut } from 'lucide-react';

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
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          group_members!inner(user_id)
        `)
        .eq('group_members.user_id', user.id);

      if (error) throw error;

      // Get member counts
      const groupsWithCounts = await Promise.all(
        (data || []).map(async (group) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);
          
          return { ...group, member_count: count || 0 };
        })
      );

      setGroups(groupsWithCounts);
      
      // Auto-select first group if none selected
      if (groupsWithCounts.length > 0 && !selectedGroupId) {
        onGroupSelect(groupsWithCounts[0].id);
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
      // Generate unique code
      let code = '';
      let isUnique = false;
      while (!isUnique) {
        const { data: codeData, error: codeError } = await supabase
          .rpc('generate_group_code');
        
        if (codeError) throw codeError;
        code = codeData;

        const { count } = await supabase
          .from('groups')
          .select('*', { count: 'exact', head: true })
          .eq('code', code);
        
        isUnique = count === 0;
      }

      // Create group
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert([{
          name,
          code,
          created_by: user.id
        }])
        .select()
        .single();

      if (groupError) throw groupError;

      // Add creator as member
      const { error: memberError } = await supabase
        .from('group_members')
        .insert([{
          group_id: group.id,
          user_id: user.id
        }]);

      if (memberError) throw memberError;

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
      // Find group by code
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (groupError) {
        toast({
          title: "Group not found",
          description: "Please check the code and try again.",
          variant: "destructive",
        });
        return;
      }

      // Check if already a member
      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id)
        .eq('user_id', user.id);

      if (count && count > 0) {
        toast({
          title: "Already a member",
          description: "You're already part of this group.",
          variant: "destructive",
        });
        return;
      }

      // Join group
      const { error: memberError } = await supabase
        .from('group_members')
        .insert([{
          group_id: group.id,
          user_id: user.id
        }]);

      if (memberError) throw memberError;

      toast({
        title: "Joined group!",
        description: `Welcome to "${group.name}".`,
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

  const copyGroupCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copied!",
      description: "Share this code with friends to invite them.",
    });
  };

  const leaveGroup = async (groupId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Left group",
        description: "You have left the group.",
      });

      fetchGroups();
      
      if (selectedGroupId === groupId) {
        const remainingGroups = groups.filter(g => g.id !== groupId);
        if (remainingGroups.length > 0) {
          onGroupSelect(remainingGroups[0].id);
        }
      }
    } catch (error: any) {
      toast({
        title: "Error leaving group",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Groups & Teams</CardTitle>
          <CardDescription>
            Create or join groups to share schedules with friends
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="my-groups" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="my-groups">My Groups</TabsTrigger>
              <TabsTrigger value="create">Create</TabsTrigger>
              <TabsTrigger value="join">Join</TabsTrigger>
            </TabsList>
            
            <TabsContent value="my-groups" className="space-y-4">
              {groups.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No groups yet. Create or join one to get started!
                </p>
              ) : (
                groups.map(group => (
                  <div
                    key={group.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedGroupId === group.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => onGroupSelect(group.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{group.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {group.code}
                          </Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            copyGroupCode(group.code);
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            leaveGroup(group.id);
                          }}
                        >
                          <LogOut className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
            
            <TabsContent value="create">
              <form onSubmit={createGroup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="groupName">Group Name</Label>
                  <Input
                    id="groupName"
                    name="groupName"
                    placeholder="e.g., Roommates Fall 2025"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createLoading}>
                  {createLoading ? 'Creating...' : 'Create Group'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="join">
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
    </div>
  );
};

export default GroupManager;