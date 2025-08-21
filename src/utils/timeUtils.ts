// Time utility functions for schedule management

import type { TimeBlock } from '@/types';

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
export const timeToMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Convert minutes since midnight to time string (HH:MM)
 */
export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Format hour number to human-readable time
 */
export const formatTime = (hour: number): string => {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
};

/**
 * Check if two time blocks overlap
 */
export const doTimeBlocksOverlap = (block1: TimeBlock, block2: TimeBlock): boolean => {
  // Only check if they're on the same day
  if (block1.day_of_week !== block2.day_of_week) return false;
  
  const start1 = timeToMinutes(block1.start_time);
  const end1 = timeToMinutes(block1.end_time);
  const start2 = timeToMinutes(block2.start_time);
  const end2 = timeToMinutes(block2.end_time);
  
  // Check if there's any overlap
  return start1 < end2 && start2 < end1;
};

/**
 * Find overlapping time blocks
 */
export const findOverlappingBlocks = (
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
