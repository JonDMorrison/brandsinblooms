
export const TASK_STATUS = {
  PLANNED: 'planned',
  REVIEW: 'review',
  APPROVED: 'approved',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  GENERATED: 'generated',
  PREVIEW: 'preview',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
