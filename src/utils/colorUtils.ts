// Color utility functions for user and group color management

import { DEFAULT_COLORS, type UserColors } from '@/types';

/**
 * Generate a consistent color for a user based on their ID hash
 */
export const getUserColorFromId = (userId: string): string => {
  const hashCode = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  const colorIndex = Math.abs(hashCode) % DEFAULT_COLORS.length;
  return DEFAULT_COLORS[colorIndex];
};

/**
 * Get user color from group colors map with fallback to ID-based color
 */
export const getUserColorForGroup = (userId: string, groupColors: UserColors): string => {
  return groupColors[userId] || getUserColorFromId(userId);
};

/**
 * Check if a color is valid hex format
 */
export const isValidHexColor = (color: string): boolean => {
  return /^#[0-9A-F]{6}$/i.test(color);
};

/**
 * Normalize color to lowercase
 */
export const normalizeColor = (color: string): string => {
  return color.toLowerCase();
};

/**
 * Get display name for a user
 */
export const getDisplayName = (user: { username: string; firstName?: string; lastName?: string }): string => {
  if (user.firstName && user.lastName) {
    return `${user.firstName} ${user.lastName.charAt(0)}`;
  }
  return user.username;
};
