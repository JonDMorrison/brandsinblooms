# Migration Tracking System

This system provides real-time tracking and control of background data migration jobs.

## Components

### MigrationStatusIndicator
A floating indicator that appears when migrations are active. Shows:
- Current progress percentage
- Records processed
- Pause/Cancel controls

**Usage:**
```tsx
import { MigrationStatusIndicator } from '@/components/migrations';

// Add to your main layout or App component
function App() {
  return (
    <>
      {/* Your app content */}
      <MigrationStatusIndicator />
    </>
  );
}
```

### MigrationJobCard
Individual job card showing detailed status and controls.

**Usage:**
```tsx
import { MigrationJobCard } from '@/components/migrations';
import { useMigrationJobs } from '@/hooks/useMigrationJobs';

function MyComponent() {
  const { jobs, pauseJob, resumeJob, cancelJob } = useMigrationJobs();
  
  return (
    <div>
      {jobs.map(job => (
        <MigrationJobCard
          key={job.id}
          job={job}
          onPause={() => pauseJob(job.id)}
          onResume={() => resumeJob(job.id)}
          onCancel={() => cancelJob(job.id)}
        />
      ))}
    </div>
  );
}
```

### MigrationDashboard
Complete dashboard with tabs for active, completed, and failed jobs.

**Usage:**
```tsx
import { MigrationDashboard } from '@/components/migrations';

function MigrationsPage() {
  return <MigrationDashboard />;
}
```

## Hook: useMigrationJobs

Provides real-time migration job data and controls.

**Returns:**
- `jobs`: Array of all migration jobs
- `isLoading`: Loading state
- `activeJobs`: Currently running jobs
- `pauseJob(jobId)`: Pause a running job
- `resumeJob(jobId)`: Resume a paused job
- `cancelJob(jobId)`: Cancel a job
- `isControlling`: Control action in progress

## Starting a Migration

To start a new migration job, insert into the `migration_jobs` table:

```ts
const { data: job, error } = await supabase
  .from('migration_jobs')
  .insert({
    tenant_id: currentTenantId,
    user_id: currentUserId,
    source_platform: 'square', // or 'clover', 'shopify', etc.
    job_type: 'import',
    status: 'pending',
    progress_total: totalRecords,
    metadata: {
      // Your migration config
    }
  })
  .select()
  .single();
```

Then start your migration worker that will:
1. Update `status` to 'running'
2. Update `started_at` timestamp
3. Process records in batches
4. Update `progress_current` and `progress_percentage`
5. Create `migration_artifacts` for each record
6. Add logs to `migration_job_logs`
7. Set `status` to 'completed' when done

## Real-time Updates

The system automatically subscribes to Supabase Realtime for `migration_jobs` table changes. All UI components will update automatically when:
- Job status changes
- Progress updates
- Jobs are paused/resumed/cancelled

## Database Tables

### migration_jobs
Main job tracking table with status, progress, and metadata.

### migration_job_logs
Logs for each job with different severity levels (info, warning, error, success).

### migration_artifacts
Individual records processed, with source/target ID mapping.
