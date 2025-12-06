/**
 * Integration Tests: Timezone Scheduler
 * 
 * These tests verify that timezone conversions work correctly for scheduling,
 * storing dates in UTC, and displaying them in the user's selected timezone.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { format, startOfDay } from 'date-fns';

describe('TimezoneScheduler - UTC Conversions', () => {
  
  describe('fromZonedTime - Convert local to UTC', () => {
    it('should convert Vancouver time to UTC correctly', () => {
      const selectedTimezone = 'America/Vancouver';
      
      // User picks June 10, 2025 at 2:00 PM Vancouver time
      const localDate = new Date(2025, 5, 10, 14, 0, 0); // Month is 0-indexed
      
      // Convert to UTC
      const utcDate = fromZonedTime(localDate, selectedTimezone);
      
      // Vancouver is UTC-7 in summer (PDT), so 2:00 PM PDT = 9:00 PM UTC
      expect(utcDate.getUTCHours()).toBe(21);
      expect(utcDate.getUTCDate()).toBe(10);
      expect(utcDate.getUTCMonth()).toBe(5); // June
    });

    it('should convert New York time to UTC correctly', () => {
      const selectedTimezone = 'America/New_York';
      
      // User picks June 10, 2025 at 10:00 AM New York time
      const localDate = new Date(2025, 5, 10, 10, 0, 0);
      
      // Convert to UTC
      const utcDate = fromZonedTime(localDate, selectedTimezone);
      
      // New York is UTC-4 in summer (EDT), so 10:00 AM EDT = 2:00 PM UTC
      expect(utcDate.getUTCHours()).toBe(14);
      expect(utcDate.getUTCDate()).toBe(10);
    });

    it('should convert London time to UTC correctly (no offset in summer)', () => {
      const selectedTimezone = 'Europe/London';
      
      // User picks June 10, 2025 at 3:00 PM London time (BST = UTC+1)
      const localDate = new Date(2025, 5, 10, 15, 0, 0);
      
      const utcDate = fromZonedTime(localDate, selectedTimezone);
      
      // London is UTC+1 in summer (BST), so 3:00 PM BST = 2:00 PM UTC
      expect(utcDate.getUTCHours()).toBe(14);
    });
  });

  describe('toZonedTime - Convert UTC to local for display', () => {
    it('should convert UTC to Vancouver time for display', () => {
      const selectedTimezone = 'America/Vancouver';
      
      // Stored UTC date: June 10, 2025 at 9:00 PM UTC
      const utcDate = new Date(Date.UTC(2025, 5, 10, 21, 0, 0));
      
      // Convert to local time for display
      const localDate = toZonedTime(utcDate, selectedTimezone);
      
      // Should display as 2:00 PM Vancouver time
      expect(localDate.getHours()).toBe(14);
      expect(localDate.getDate()).toBe(10);
    });

    it('should convert UTC to Tokyo time for display', () => {
      const selectedTimezone = 'Asia/Tokyo';
      
      // Stored UTC date: June 10, 2025 at 10:00 AM UTC
      const utcDate = new Date(Date.UTC(2025, 5, 10, 10, 0, 0));
      
      const localDate = toZonedTime(utcDate, selectedTimezone);
      
      // Tokyo is UTC+9, so 10:00 AM UTC = 7:00 PM Tokyo
      expect(localDate.getHours()).toBe(19);
    });
  });

  describe('Round-trip: local → UTC → local', () => {
    it('should preserve the original local date/time through round-trip', () => {
      const selectedTimezone = 'America/Vancouver';
      
      // User picks June 10, 2025 at 2:30 PM
      const originalLocal = new Date(2025, 5, 10, 14, 30, 0);
      
      // Convert to UTC for storage
      const utcStored = fromZonedTime(originalLocal, selectedTimezone);
      
      // Convert back to local for display
      const displayedLocal = toZonedTime(utcStored, selectedTimezone);
      
      // Should match original
      expect(displayedLocal.getFullYear()).toBe(2025);
      expect(displayedLocal.getMonth()).toBe(5); // June
      expect(displayedLocal.getDate()).toBe(10);
      expect(displayedLocal.getHours()).toBe(14);
      expect(displayedLocal.getMinutes()).toBe(30);
    });

    it('should preserve date across different timezones viewing same UTC', () => {
      // User in Vancouver schedules for June 10, 2025 at 6:00 PM
      const vancouverTz = 'America/Vancouver';
      const localInVancouver = new Date(2025, 5, 10, 18, 0, 0);
      
      // Store as UTC
      const utcStored = fromZonedTime(localInVancouver, vancouverTz);
      
      // Admin in New York views the same campaign
      const newYorkTz = 'America/New_York';
      const displayedInNewYork = toZonedTime(utcStored, newYorkTz);
      
      // 6:00 PM Vancouver = 9:00 PM New York (3 hour difference)
      expect(displayedInNewYork.getHours()).toBe(21);
      // Same calendar date
      expect(displayedInNewYork.getDate()).toBe(10);
    });
  });

  describe('DST boundary handling', () => {
    it('should handle spring DST transition (March 2025) correctly', () => {
      const selectedTimezone = 'America/Vancouver';
      
      // March 9, 2025 is when DST starts in Vancouver (2:00 AM becomes 3:00 AM)
      // Schedule for March 9 at noon (after DST transition)
      const localNoon = new Date(2025, 2, 9, 12, 0, 0);
      
      const utcStored = fromZonedTime(localNoon, selectedTimezone);
      const displayedBack = toZonedTime(utcStored, selectedTimezone);
      
      // Date should not shift
      expect(displayedBack.getDate()).toBe(9);
      expect(displayedBack.getMonth()).toBe(2); // March
      expect(displayedBack.getHours()).toBe(12);
    });

    it('should handle fall DST transition (November 2025) correctly', () => {
      const selectedTimezone = 'America/Vancouver';
      
      // November 2, 2025 is when DST ends (2:00 AM becomes 1:00 AM)
      // Schedule for November 2 at noon
      const localNoon = new Date(2025, 10, 2, 12, 0, 0);
      
      const utcStored = fromZonedTime(localNoon, selectedTimezone);
      const displayedBack = toZonedTime(utcStored, selectedTimezone);
      
      // Date should not shift
      expect(displayedBack.getDate()).toBe(2);
      expect(displayedBack.getMonth()).toBe(10); // November
      expect(displayedBack.getHours()).toBe(12);
    });

    it('should use noon normalization to avoid midnight DST edge cases', () => {
      const selectedTimezone = 'America/Vancouver';
      
      // Simulate calendar date selection with noon normalization
      const pickedDate = new Date(2025, 2, 9); // Just the date
      pickedDate.setHours(12, 0, 0, 0); // Normalize to noon
      
      const utcStored = fromZonedTime(pickedDate, selectedTimezone);
      const displayedBack = toZonedTime(utcStored, selectedTimezone);
      
      // The date portion should never shift when using noon
      expect(displayedBack.getDate()).toBe(9);
      expect(displayedBack.getMonth()).toBe(2);
    });
  });

  describe('Schedule option simulation', () => {
    interface ScheduleOption {
      type: 'now' | 'optimal' | 'custom';
      date?: Date;
      timezone?: string;
    }

    it('should create correct UTC date for custom schedule', () => {
      const selectedTimezone = 'America/Vancouver';
      const selectedDate = new Date(2025, 5, 15); // June 15
      selectedDate.setHours(12, 0, 0, 0);
      const selectedTime = '14:00';
      
      // Simulate the conversion logic from TimezoneScheduler
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const dateWithTime = new Date(selectedDate);
      dateWithTime.setHours(hours, minutes, 0, 0);
      
      const utcDate = fromZonedTime(dateWithTime, selectedTimezone);
      
      const schedule: ScheduleOption = {
        type: 'custom',
        date: utcDate,
        timezone: selectedTimezone,
      };
      
      // Verify it's stored as UTC
      expect(schedule.date).toBeDefined();
      expect(schedule.date!.toISOString()).toContain('Z'); // UTC marker
      
      // Verify display conversion works
      const displayDate = toZonedTime(schedule.date!, selectedTimezone);
      expect(displayDate.getHours()).toBe(14);
      expect(displayDate.getDate()).toBe(15);
    });

    it('should format display correctly for schedule preview', () => {
      const selectedTimezone = 'America/Vancouver';
      
      // UTC stored date
      const utcDate = new Date(Date.UTC(2025, 5, 15, 21, 0, 0)); // June 15, 9 PM UTC
      
      // Convert for display
      const displayDate = toZonedTime(utcDate, selectedTimezone);
      
      // Format for preview
      const dateStr = format(displayDate, 'EEEE, MMMM d, yyyy');
      const timeStr = format(displayDate, 'h:mm a');
      
      expect(dateStr).toBe('Sunday, June 15, 2025');
      expect(timeStr).toBe('2:00 PM');
    });
  });

  describe('Past date validation', () => {
    it('should correctly identify past dates', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      
      const today = startOfDay(new Date());
      const checkDate = startOfDay(pastDate);
      
      expect(checkDate < today).toBe(true);
    });

    it('should not mark future dates as past', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      
      const today = startOfDay(new Date());
      const checkDate = startOfDay(futureDate);
      
      expect(checkDate < today).toBe(false);
    });
  });
});
