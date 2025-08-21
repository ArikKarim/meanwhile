import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye } from 'lucide-react';
import { getUserColorForGroup, getDisplayName } from '@/utils/colorUtils';
import type { GroupMemberWithProfile, UserColors } from '@/types';

interface UserVisibilityFilterProps {
  selectedGroupId?: string;
  viewMode: 'busy' | 'free';
  groupMembers: GroupMemberWithProfile[];
  visibleUsers: Set<string>;
  groupColors: UserColors;
  currentUserId?: string;
  onToggleUserVisibility: (userId: string) => void;
  onToggleShowMine: () => void;
}

const UserVisibilityFilter: React.FC<UserVisibilityFilterProps> = ({
  selectedGroupId,
  viewMode,
  groupMembers,
  visibleUsers,
  groupColors,
  currentUserId,
  onToggleUserVisibility,
  onToggleShowMine
}) => {
  if (!selectedGroupId || viewMode !== 'busy' || groupMembers.length === 0) {
    return null;
  }

  const isShowingOnlyCurrentUser = visibleUsers.size === 1 && 
    currentUserId && 
    visibleUsers.has(currentUserId);

  return (
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
            onClick={onToggleShowMine}
            className="text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            {isShowingOnlyCurrentUser ? 'Show All' : 'Show Mine'}
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
                onCheckedChange={() => onToggleUserVisibility(member.id)}
              />
              <Label
                htmlFor={`user-${member.id}`}
                className="text-sm font-medium cursor-pointer flex items-center gap-2"
              >
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ 
                    backgroundColor: getUserColorForGroup(member.id, groupColors),
                    opacity: visibleUsers.has(member.id) ? 1 : 0.3
                  }}
                />
                <span className={visibleUsers.has(member.id) ? '' : 'text-muted-foreground'}>
                  {getDisplayName(member)}
                  {member.id === currentUserId && ' (You)'}
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
  );
};

export default UserVisibilityFilter;
