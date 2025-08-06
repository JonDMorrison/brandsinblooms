export type DelayUnit = 'minutes' | 'hours' | 'days';

export interface DelayConfig {
  value: number;
  unit: DelayUnit;
}

export function convertToMinutes(value: number, unit: DelayUnit): number {
  switch (unit) {
    case 'minutes':
      return value;
    case 'hours':
      return value * 60;
    case 'days':
      return value * 60 * 24;
    default:
      return value;
  }
}

export function convertFromMinutes(minutes: number): DelayConfig {
  if (minutes === 0) {
    return { value: 0, unit: 'minutes' };
  }
  
  // Convert to days if it's a multiple of 1440 (24 hours)
  if (minutes >= 1440 && minutes % 1440 === 0) {
    return { value: minutes / 1440, unit: 'days' };
  }
  
  // Convert to hours if it's a multiple of 60
  if (minutes >= 60 && minutes % 60 === 0) {
    return { value: minutes / 60, unit: 'hours' };
  }
  
  // Otherwise use minutes
  return { value: minutes, unit: 'minutes' };
}

export function getDelayLabel(value: number, unit: DelayUnit): string {
  if (value === 0) {
    return 'Immediate';
  }
  
  const unitLabel = value === 1 ? unit.slice(0, -1) : unit; // Remove 's' for singular
  return `${value} ${unitLabel}`;
}

export function getEquivalentTime(value: number, unit: DelayUnit): string {
  const totalMinutes = convertToMinutes(value, unit);
  
  if (totalMinutes === 0) return 'Immediate';
  if (totalMinutes < 60) return `${totalMinutes} min`;
  if (totalMinutes < 1440) return `${Math.round(totalMinutes / 60 * 10) / 10} hrs`;
  
  const days = Math.round(totalMinutes / 1440 * 10) / 10;
  return `${days} days`;
}
