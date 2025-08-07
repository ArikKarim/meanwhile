import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ScheduleFormProps {
  groupId: string;
  onScheduleAdded: () => void;
}

// User color preferences storage
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

const saveUserColors = (colors: UserColors) => {
  localStorage.setItem(USER_COLORS_KEY, JSON.stringify(colors));
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

// Simple localStorage-based time block management
const TIME_BLOCKS_KEY = 'meanwhile_time_blocks';

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

const saveTimeBlocks = async (timeBlocks: Omit<TimeBlock, 'id' | 'created_at'>[]): Promise<TimeBlock[]> => {
  try {
    const { data, error } = await supabase
      .from('time_blocks')
      .insert(timeBlocks)
      .select();
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error saving time blocks:', error);
    return [];
  }
};

// Overlap detection utilities
const timeToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
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

const findOverlappingBlocks = (
  newBlocks: TimeBlock[], 
  existingBlocks: TimeBlock[], 
  userId?: string
): { userOverlaps: TimeBlock[], otherUserOverlaps: TimeBlock[] } => {
  const userOverlaps: TimeBlock[] = [];
  const otherUserOverlaps: TimeBlock[] = [];
  
  newBlocks.forEach(newBlock => {
    existingBlocks.forEach(existingBlock => {
      if (doTimeBlocksOverlap(newBlock, existingBlock)) {
        if (!userId || existingBlock.user_id === userId) {
          userOverlaps.push(existingBlock);
        } else {
          otherUserOverlaps.push(existingBlock);
        }
      }
    });
  });
  
  return { userOverlaps, otherUserOverlaps };
};

const DAYS = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
];

const TAGS = [
  { label: 'Class', value: 'class' },
  { label: 'Work', value: 'work' },
  { label: 'Personal', value: 'personal' },
  { label: 'Other', value: 'other' }
];

const ScheduleForm: React.FC<ScheduleFormProps> = ({ groupId, onScheduleAdded }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [customColor, setCustomColor] = useState('');

  const [formData, setFormData] = useState({
    label: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    tag: 'class',
    selectedDays: [] as number[]
  });

  const [userColor, setUserColor] = useState('#3b82f6');

  useEffect(() => {
    if (user?.id) {
      setUserColor(getUserColor(user.id));
    }
  }, [user?.id]);

  const getCurrentColor = () => {
    return customColor || userColor;
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
  };

  const handleDayToggle = (dayValue: number) => {
    setFormData(prev => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(dayValue)
        ? prev.selectedDays.filter(d => d !== dayValue)
        : [...prev.selectedDays, dayValue]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || formData.selectedDays.length === 0) return;

    setLoading(true);

    try {
      const newTimeBlocks: TimeBlock[] = [];
      formData.selectedDays.forEach(day => {
        const newTimeBlock: TimeBlock = {
          id: `tb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          user_id: user.id,
          group_id: groupId,
          label: formData.label,
          day_of_week: day,
          start_time: formData.start_time,
          end_time: formData.end_time,
          color: getCurrentColor(),
          tag: formData.tag,
          created_at: new Date().toISOString()
        };

        newTimeBlocks.push(newTimeBlock);
      });

      const allTimeBlocks = await getTimeBlocks();
      const { userOverlaps, otherUserOverlaps } = findOverlappingBlocks(newTimeBlocks, allTimeBlocks, user?.id);

      if (userOverlaps.length > 0) {
        toast({
          title: "Personal Overlap Detected",
          description: `You already have activities scheduled at this time. Please adjust.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Allow overlaps with other users - just show info toast
      if (otherUserOverlaps.length > 0) {
        toast({
          title: "Note: Time Overlap", 
          description: `This time overlaps with ${otherUserOverlaps.length} other group member${otherUserOverlaps.length !== 1 ? 's' : ''}.`,
        });
      }

      const savedBlocks = await saveTimeBlocks(newTimeBlocks);
      
      if (savedBlocks.length === 0) {
        toast({
          title: "Error saving schedule",
          description: "Failed to save your schedule. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Reset form
      setFormData({
        label: '',
        day_of_week: '',
        start_time: '',
        end_time: '',
        tag: 'class',
        selectedDays: []
      });
      setCustomColor('');

      toast({
        title: "Schedule added!",
        description: `Added "${formData.label}" to your schedule`,
      });

      onScheduleAdded();
    } catch (error) {
      console.error('Error adding schedule:', error);
      toast({
        title: "Error",
        description: "Failed to add schedule. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Schedule</CardTitle>
        <CardDescription>
          Add your busy times to share with the group
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Activity Name</Label>
            <Input
              id="label"
              value={formData.label}
              onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
              placeholder="e.g., Math Class, Work Meeting"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Days of Week</Label>
            <div className="grid grid-cols-2 gap-2">
              {DAYS.map((day) => (
                <div key={day.value} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`day-${day.value}`}
                    checked={formData.selectedDays.includes(day.value)}
                    onChange={() => handleDayToggle(day.value)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <Label htmlFor={`day-${day.value}`} className="text-sm">
                    {day.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tag">Category & Color</Label>
            <div className="flex gap-2">
              <Select value={formData.tag} onValueChange={(value) => {
                setFormData(prev => ({ ...prev, tag: value }));
                setCustomColor(''); // Reset custom color when category changes
              }}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAGS.map((tag) => (
                    <SelectItem key={tag.value} value={tag.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ 
                            backgroundColor: formData.tag === tag.value 
                              ? getCurrentColor() 
                              : '#ccc' // Default for other tags
                          }}
                        />
                        {tag.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <input
                  type="color"
                  value={getCurrentColor()}
                  onChange={(e) => updateUserColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Custom color override"
                />
                <div 
                  className="w-12 h-10 rounded border cursor-pointer flex-shrink-0"
                  style={{ backgroundColor: getCurrentColor() }}
                />
              </div>
            </div>
            {customColor && (
              <p className="text-xs text-muted-foreground">Using custom color override</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Your Color</Label>
            <div className="flex gap-2 items-center">
              <div 
                className="w-10 h-10 rounded border-2 border-gray-200 cursor-pointer relative overflow-hidden"
                title="Click to change your color"
              >
                <input
                  type="color"
                  value={userColor}
                  onChange={(e) => updateUserColor(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div 
                  className="w-full h-full rounded"
                  style={{ backgroundColor: userColor }}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                <p>This color will be used for all your events</p>
                <p className="text-xs">Each user must have a unique color</p>
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Adding...' : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add to Schedule
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ScheduleForm;