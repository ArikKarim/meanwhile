// Local storage utility functions

import type { CalendarSettings } from '@/types';

// Calendar settings storage
const CALENDAR_SETTINGS_KEY = 'meanwhile_calendar_settings';

export const getCalendarSettings = (): CalendarSettings => {
  try {
    const stored = localStorage.getItem(CALENDAR_SETTINGS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

export const saveCalendarSettings = (settings: CalendarSettings): void => {
  try {
    localStorage.setItem(CALENDAR_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save calendar settings:', error);
  }
};

export const getGroupTimeSettings = (groupId: string, calendarSettings: CalendarSettings) => {
  return calendarSettings[groupId] || { 
    startHour: 7, 
    endHour: 21, 
    weekStartDay: 'sunday' as const 
  };
};
