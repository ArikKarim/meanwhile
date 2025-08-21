import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatTime } from '@/utils/timeUtils';

interface TimeRangeSettingsProps {
  groupId: string;
  currentSettings: { 
    startHour: number; 
    endHour: number; 
    weekStartDay: 'sunday' | 'monday' 
  };
  onUpdate?: (groupId: string, startHour: number, endHour: number, weekStartDay: 'sunday' | 'monday') => void;
  readOnly?: boolean;
}

const TimeRangeSettings: React.FC<TimeRangeSettingsProps> = ({
  groupId,
  currentSettings,
  onUpdate,
  readOnly = false
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
        Current: {formatTime(currentSettings.startHour)} - {formatTime(currentSettings.endHour)}, 
        Week starts on {currentSettings.weekStartDay === 'sunday' ? 'Sunday' : 'Monday'}
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

export default TimeRangeSettings;
