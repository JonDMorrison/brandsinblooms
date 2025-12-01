import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bug } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ReportProblemDialog } from './ReportProblemDialog';

export const ReportProblemButton: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-2"
            >
              <Bug className="h-5 w-5" />
              <span className="hidden sm:inline">Got a question?</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Report a Problem</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <ReportProblemDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};
