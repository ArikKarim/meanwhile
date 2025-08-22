import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette } from 'lucide-react';
import { getUserColorForGroup } from '@/utils/colorUtils';
import type { UserColors } from '@/types';

interface UserColorPickerProps {
  user: { id: string; username: string };
  selectedGroupId?: string;
  groupColors: UserColors;
  userColor: string;
  onColorChange: (color: string) => void;
}

const UserColorPicker: React.FC<UserColorPickerProps> = ({
  user,
  selectedGroupId,
  groupColors,
  userColor,
  onColorChange
}) => {
  const currentColor = selectedGroupId && user?.id 
    ? getUserColorForGroup(user.id, groupColors) 
    : userColor;
  
  // State to track the color during dragging for real-time hex display
  const [displayColor, setDisplayColor] = useState(currentColor);
  
  // Update display color when the actual color changes
  useEffect(() => {
    setDisplayColor(currentColor);
  }, [currentColor]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Your Color
        </CardTitle>
        <CardDescription>
          Choose a unique color for your events in this group
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
              value={currentColor}
              onInput={(e) => {
                // Update display color immediately during dragging
                const target = e.target as HTMLInputElement;
                setDisplayColor(target.value);
              }}
              onChange={(e) => {
                // Update the actual color when user finishes selecting
                onColorChange(e.target.value);
                setDisplayColor(e.target.value);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div 
              className="w-full h-full rounded-lg"
              style={{ backgroundColor: displayColor }}
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {displayColor.toUpperCase()}
            </p>
            <p className="text-xs text-muted-foreground">
              Each user must have a unique color in this group
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserColorPicker;
