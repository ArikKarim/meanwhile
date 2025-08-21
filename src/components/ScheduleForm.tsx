import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { TimeBlock } from '@/types';
import { DAYS_OF_WEEK, SCHEDULE_TAGS } from '@/types';
import { getUserColorFromId } from '@/utils/colorUtils';
import { findOverlappingBlocks } from '@/utils/timeUtils';
import { getTimeBlocks, saveTimeBlocks } from '@/services/scheduleService';

interface ScheduleFormProps {
  groupId: string;
  onScheduleAdded: () => void;
}

// Removed utility functions - moved to separate modules

const ScheduleForm: React.FC<ScheduleFormProps> = ({ groupId, onScheduleAdded }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);


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
      setUserColor(getUserColorFromId(user.id));
    }
  }, [user?.id]);

  // Listen for user color changes from other components
  useEffect(() => {
    const handleColorChange = () => {
      if (user?.id) {
        setUserColor(getUserColorFromId(user.id));
      }
    };

    window.addEventListener('userColorChanged', handleColorChange);
    return () => window.removeEventListener('userColorChanged', handleColorChange);
  }, [user?.id]);

  const getCurrentColor = () => {
    return userColor;
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
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
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
              {DAYS_OF_WEEK.map((day) => (
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
              }}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_TAGS.map((tag) => (
                    <SelectItem key={tag.value} value={tag.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ 
                            backgroundColor: formData.tag === tag.value 
                              ? getCurrentColor() 
                              : '#ccc'
                          }}
                        />
                        {tag.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative">
                <div 
                  className="w-12 h-10 rounded border cursor-pointer flex-shrink-0"
                  style={{ backgroundColor: getCurrentColor() }}
                  title="Color determined by your user profile"
                />
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