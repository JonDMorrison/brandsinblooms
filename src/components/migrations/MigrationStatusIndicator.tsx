import { Loader2, CheckCircle2, AlertCircle, Pause } from "lucide-react";
import { useMigrationJobs } from "@/hooks/useMigrationJobs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const MigrationStatusIndicator = () => {
  const { activeJobs, pauseJob, cancelJob, isControlling } = useMigrationJobs();
  const visibleJobs = activeJobs.filter(
    (job) => job.source_platform !== "mailchimp",
  );

  if (visibleJobs.length === 0) return null;

  const job = visibleJobs[0]; // Show the first active job

  return (
    <Card className="fixed bottom-4 right-4 w-96 p-4 shadow-lg z-50 bg-card">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {job.status === "running" && (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            )}
            {job.status === "paused" && (
              <Pause className="h-4 w-4 text-warning" />
            )}
            <span className="font-medium text-sm">
              {job.status === "running" ? "Migrating" : "Paused"}{" "}
              {job.source_platform}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {job.progress_percentage.toFixed(0)}%
          </span>
        </div>

        <Progress value={job.progress_percentage} className="h-2" />

        <div className="text-xs text-muted-foreground">
          {job.progress_current} / {job.progress_total} records processed
        </div>

        <div className="flex gap-2">
          {job.status === "running" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => pauseJob(job.id)}
              disabled={isControlling}
              className="flex-1"
            >
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => cancelJob(job.id)}
            disabled={isControlling}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </Card>
  );
};
