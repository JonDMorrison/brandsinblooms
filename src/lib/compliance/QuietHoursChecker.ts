import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';

interface QuietHoursConfig {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  timezone: string;
}

interface QuietHoursResult {
  isQuietHours: boolean;
  nextSendTime?: Date;
  deferredReason?: string;
}

export class QuietHoursChecker {
  private static parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }

  static check(config: QuietHoursConfig, targetTimezone?: string): QuietHoursResult {
    const now = new Date();
    const customerTimezone = targetTimezone || config.timezone;
    
    // Convert current time to customer's timezone
    const customerTime = toZonedTime(now, customerTimezone);
    
    const startTime = this.parseTime(config.start);
    const endTime = this.parseTime(config.end);
    
    const currentHour = customerTime.getHours();
    const currentMinute = customerTime.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    const startTimeInMinutes = startTime.hours * 60 + startTime.minutes;
    const endTimeInMinutes = endTime.hours * 60 + endTime.minutes;
    
    let isQuietHours = false;
    let nextSendTime: Date | undefined;
    
    if (startTimeInMinutes > endTimeInMinutes) {
      // Quiet hours span midnight (e.g., 20:00 to 08:00)
      isQuietHours = currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes < endTimeInMinutes;
      
      if (isQuietHours) {
        // Calculate next send time (end of quiet hours)
        const nextSendDate = new Date(customerTime);
        
        if (currentTimeInMinutes >= startTimeInMinutes) {
          // After start time, send tomorrow at end time
          nextSendDate.setDate(nextSendDate.getDate() + 1);
        }
        
        nextSendDate.setHours(endTime.hours, endTime.minutes, 0, 0);
        nextSendTime = fromZonedTime(nextSendDate, customerTimezone);
      }
    } else {
      // Quiet hours within same day (e.g., 22:00 to 06:00 - not typical)
      isQuietHours = currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes < endTimeInMinutes;
      
      if (isQuietHours) {
        const nextSendDate = new Date(customerTime);
        nextSendDate.setHours(endTime.hours, endTime.minutes, 0, 0);
        nextSendTime = fromZonedTime(nextSendDate, customerTimezone);
      }
    }
    
    return {
      isQuietHours,
      nextSendTime,
      deferredReason: isQuietHours 
        ? `Deferred due to quiet hours (${config.start}-${config.end} ${customerTimezone})`
        : undefined
    };
  }

  static getNextSendWindow(config: QuietHoursConfig, targetTimezone?: string): Date {
    const result = this.check(config, targetTimezone);
    return result.nextSendTime || new Date();
  }

  static isKeywordResponse(message: string): boolean {
    const keywords = /^\s*(STOP|UNSTOP|HELP|START|YES|RESUME)\s*$/i;
    return keywords.test(message.trim());
  }
}