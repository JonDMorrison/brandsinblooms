
export const TASK_STATUS = {
  PLANNED: 'planned',
  APPROVED: 'approved',
  GENERATED: 'generated',
  REVIEW: 'review',
  PREVIEW: 'preview',
  SCHEDULED: 'scheduled',
  POSTED: 'posted',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
