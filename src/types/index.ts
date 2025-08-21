// Shared type definitions across the application

export interface User {
  id: string;
  user_id: string;
  username: string;
  first_name?: string;
  last_name?: string;
  password_hash?: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  joined_at: string;
}

export interface TimeBlock {
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
  updated_at: string;
}

export interface UserColors {
  [userId: string]: string;
}

export interface CalendarSettings {
  [groupId: string]: {
    startHour: number;
    endHour: number;
    weekStartDay: 'sunday' | 'monday';
  };
}

export interface GroupMemberWithProfile {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
}

export interface UserGroupColor {
  id: string;
  user_id: string;
  group_id: string;
  color: string;
  user_name: string;
  created_at: string;
  updated_at: string;
}

// Common tag types
export const SCHEDULE_TAGS = [
  { label: 'Class', value: 'class' },
  { label: 'Work', value: 'work' },
  { label: 'Personal', value: 'personal' },
  { label: 'Other', value: 'other' }
] as const;

// Days of week
export const DAYS_OF_WEEK = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
] as const;

// Default color palette
export const DEFAULT_COLORS = [
  '#3b82f6', // Blue
  '#ef4444', // Red  
  '#10b981', // Green
  '#f59e0b', // Amber
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#6366f1', // Indigo
] as const;

// Notepad types
export interface Notepad {
  id: string;
  group_id: string;
  title: string;
  content: string;
  last_updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotepadOperation {
  id: string;
  notepad_id: string;
  user_id: string;
  operation_type: 'insert' | 'delete' | 'retain';
  position: number;
  content?: string;
  length?: number;
  timestamp: string;
  sequence_number: number;
}

export interface NotepadCursor {
  id: string;
  notepad_id: string;
  user_id: string;
  position: number;
  selection_start?: number;
  selection_end?: number;
  updated_at: string;
}

export interface NotepadCollaborator {
  id: string;
  notepad_id: string;
  user_id: string;
  user_name: string;
  user_color: string;
  is_active: boolean;
  last_seen: string;
}
