import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { CheckCircle, AlertCircle, X, Eye } from 'lucide-react';
import { useGenerationJobTracker, GenerationJob } from '@/state/useGenerationJobTracker';
import { useNavigate } from 'react-router-dom';

interface GenerationProgressBannerProps {
  className?: string;
}

export const GenerationProgressBanner: React.FC<GenerationProgressBannerProps> = ({ className }) => {
  const { jobs, removeJob, clearCompletedJobs } = useGenerationJobTracker();
  const navigate = useNavigate();
  
  const activeJobs = Object.values(jobs).filter(job => job.status === 'generating');
  const completedJobs = Object.values(jobs).filter(job => job.status === 'completed');
  const failedJobs = Object.values(jobs).filter(job => job.status === 'failed');

  const allJobs = [...activeJobs, ...completedJobs, ...failedJobs];
  
  if (allJobs.length === 0) return null;

  const handleViewContent = (job: GenerationJob) => {
    if (job.redirectPath) {
      navigate(job.redirectPath);
    }
    removeJob(job.id);
  };

  const handleDismiss = (job: GenerationJob) => {
    removeJob(job.id);
  };

  return (
    <div className={`space-y-2 ${className || ''}`}>
      {activeJobs.map(job => (
        <Card key={job.id} className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <LoadingSpinner size="sm" color="primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">Generating content for "{job.title}"</p>
                <p className="text-xs text-muted-foreground">AI is creating your {job.type} content...</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleDismiss(job)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {completedJobs.map(job => (
        <Card key={job.id} className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">Content ready for "{job.title}"</p>
                <p className="text-xs text-green-600">Your {job.type} content has been generated successfully!</p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleViewContent(job)}
                  className="text-green-700 border-green-200 hover:bg-green-100"
                >
                  <Eye className="w-4 h-4 mr-1" />
                  Review
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleDismiss(job)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {failedJobs.map(job => (
        <Card key={job.id} className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">Failed to generate "{job.title}"</p>
                <p className="text-xs text-red-600">{job.error || 'Content generation failed. Please try again.'}</p>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleDismiss(job)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      
      {(completedJobs.length > 1 || failedJobs.length > 1) && (
        <div className="flex justify-center pt-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearCompletedJobs}
            className="text-muted-foreground"
          >
            Clear all notifications
          </Button>
        </div>
      )}
    </div>
  );
};