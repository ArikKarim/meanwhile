import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface TimeBlock {
  id: string;
  user_id: string;
  label: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  color: string;
  tag: string;
  username?: string;
}

interface WeeklyCalendarProps {
  groupId: string;
  viewMode: 'busy' | 'free';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM to 9 PM

const WeeklyCalendar = ({ groupId, viewMode }: WeeklyCalendarProps) => {
  const { user } = useAuth();
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;

    const fetchTimeBlocks = async () => {
      setLoading(true);
      
      // First get time blocks
      const { data: timeBlocksData, error: timeBlocksError } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('group_id', groupId);

      if (timeBlocksError) {
        console.error('Error fetching time blocks:', timeBlocksError);
        setTimeBlocks([]);
        return;
      }

      // Then get user profiles for the blocks
      const userIds = [...new Set(timeBlocksData?.map(block => block.user_id) || [])];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      const profilesMap = new Map(
        profilesData?.map(profile => [profile.user_id, profile.username]) || []
      );

      const blocksWithUsernames = timeBlocksData?.map(block => ({
        ...block,
        username: profilesMap.get(block.user_id) || 'Unknown'
      })) || [];

      setTimeBlocks(blocksWithUsernames);
      
      setLoading(false);
    };

    fetchTimeBlocks();

    // Set up realtime subscription
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

  const timeToMinutes = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const getBlocksForDayAndHour = (dayIndex: number, hour: number) => {
    return timeBlocks.filter(block => {
      const blockStart = timeToMinutes(block.start_time);
      const blockEnd = timeToMinutes(block.end_time);
      const hourStart = hour * 60;
      const hourEnd = (hour + 1) * 60;
      
      return block.day_of_week === dayIndex && 
             blockStart < hourEnd && 
             blockEnd > hourStart;
    });
  };

  const getFreeTimeOverlap = (dayIndex: number, hour: number) => {
    const blocks = getBlocksForDayAndHour(dayIndex, hour);
    const totalUsers = new Set(timeBlocks.map(b => b.user_id)).size;
    const busyUsers = new Set(blocks.map(b => b.user_id)).size;
    
    return totalUsers > 0 ? ((totalUsers - busyUsers) / totalUsers) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-[800px] grid grid-cols-8 gap-1 bg-background">
        {/* Header */}
        <div className="p-2 text-center font-medium text-muted-foreground">Time</div>
        {DAYS.map(day => (
          <div key={day} className="p-2 text-center font-medium text-foreground">
            {day}
          </div>
        ))}
        
        {/* Time slots */}
        {HOURS.map(hour => (
          <div key={hour} className="contents">
            <div className="p-2 text-sm text-muted-foreground border-t">
              {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
            </div>
            {DAYS.map((_, dayIndex) => {
              const blocks = getBlocksForDayAndHour(dayIndex, hour);
              const freePercent = getFreeTimeOverlap(dayIndex, hour);
              
              return (
                <div
                  key={`${hour}-${dayIndex}`}
                  className={`min-h-[60px] border border-border p-1 relative ${
                    viewMode === 'free' 
                      ? freePercent > 50 
                        ? 'bg-green-100 dark:bg-green-900/20' 
                        : 'bg-background'
                      : 'bg-background'
                  }`}
                >
                  {viewMode === 'busy' ? (
                    blocks.map((block, index) => (
                      <div
                        key={block.id}
                        className="text-xs p-1 mb-1 rounded text-white font-medium"
                        style={{ 
                          backgroundColor: block.color,
                          marginTop: `${index * 20}px`
                        }}
                      >
                        <div className="truncate">{block.label}</div>
                        <div className="truncate opacity-80">{block.username}</div>
                      </div>
                    ))
                  ) : (
                    freePercent > 50 && (
                      <div className="text-xs text-green-700 dark:text-green-300 font-medium">
                        {Math.round(freePercent)}% free
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeeklyCalendar;