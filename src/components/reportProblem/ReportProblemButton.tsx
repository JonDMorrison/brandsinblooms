import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
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
              size="icon"
              onClick={() => setDialogOpen(true)}
            >
              <AlertCircle className="h-5 w-5" />
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
