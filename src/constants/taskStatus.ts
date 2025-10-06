
export const TASK_STATUS = {
  PLANNED: 'planned',
  REVIEW: 'review',
  APPROVED: 'approved',
  SCHEDULED: 'scheduled',
  PUBLISHED: 'published',
  GENERATED: 'generated',
  PREVIEW: 'preview',
  FAILED: 'failed',
  PENDING: 'pending',
  POSTED: 'posted',
  DRAFT: 'draft',
  GENERATING: 'generating',
  NEEDS_REVIEW: 'needs_review',
  IN_PROGRESS: 'in_progress',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];

// Valid statuses according to database check constraint
export const VALID_CONTENT_TASK_STATUSES = [
  'planned',
  'pending', 
  'review',
  'approved',
  'posted',
  'failed',
  'draft',
  'preview',
  'generating',
  'generated',
  'scheduled',
  'needs_review',
  'in_progress'
] as const;

export function isValidTaskStatus(status: string): status is TaskStatus {
  return VALID_CONTENT_TASK_STATUSES.includes(status as any);
}

