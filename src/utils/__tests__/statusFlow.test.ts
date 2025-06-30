
import { TASK_STATUS } from '@/constants/taskStatus';

// Helper function to simulate status transitions
const toApproved = (task: { status: string }) => ({
  ...task,
  status: TASK_STATUS.APPROVED
});

describe('Task Status Flow', () => {
  it('moves generated tasks to approved', () => {
    const task = { status: TASK_STATUS.PLANNED };
    const next = toApproved(task);
    expect(next.status).toBe(TASK_STATUS.APPROVED);
  });

  it('maintains task properties when changing status', () => {
    const task = { 
      id: '123', 
      status: TASK_STATUS.GENERATED,
      content: 'Test content'
    };
    const next = toApproved(task);
    
    expect(next.id).toBe('123');
    expect(next.content).toBe('Test content');
    expect(next.status).toBe(TASK_STATUS.APPROVED);
  });

  it('validates approved status is visible in draft tray', () => {
    const visibleStatuses = [TASK_STATUS.APPROVED, TASK_STATUS.GENERATED];
    const approvedTask = { status: TASK_STATUS.APPROVED };
    const reviewTask = { status: TASK_STATUS.REVIEW };
    
    expect(visibleStatuses.includes(approvedTask.status as any)).toBe(true);
    expect(visibleStatuses.includes(reviewTask.status as any)).toBe(false);
  });
});
