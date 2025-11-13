import { useMigrationJobs } from '@/hooks/useMigrationJobs';
import { MigrationJobCard } from './MigrationJobCard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

export const MigrationDashboard = () => {
  const { jobs, isLoading, pauseJob, resumeJob, cancelJob, isControlling } = useMigrationJobs();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'paused');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const failedJobs = jobs.filter(j => j.status === 'failed' || j.status === 'cancelled');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Migration Jobs</h2>
        <p className="text-muted-foreground">
          Monitor and control your data migration jobs
        </p>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">
            Active {activeJobs.length > 0 && `(${activeJobs.length})`}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed {completedJobs.length > 0 && `(${completedJobs.length})`}
          </TabsTrigger>
          <TabsTrigger value="failed">
            Failed {failedJobs.length > 0 && `(${failedJobs.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeJobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No active migration jobs
            </p>
          ) : (
            activeJobs.map((job) => (
              <MigrationJobCard
                key={job.id}
                job={job}
                onPause={() => pauseJob(job.id)}
                onResume={() => resumeJob(job.id)}
                onCancel={() => cancelJob(job.id)}
                isControlling={isControlling}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedJobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No completed migration jobs
            </p>
          ) : (
            completedJobs.map((job) => (
              <MigrationJobCard key={job.id} job={job} />
            ))
          )}
        </TabsContent>

        <TabsContent value="failed" className="space-y-4">
          {failedJobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No failed migration jobs
            </p>
          ) : (
            failedJobs.map((job) => (
              <MigrationJobCard key={job.id} job={job} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
