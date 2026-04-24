import React, { useState } from "react";
import { Button } from "@/components/ui-legacy/button";
import { Bug } from "lucide-react";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { ReportProblemDialog } from "./ReportProblemDialog";

export const ReportProblemButton: React.FC = () => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <JoyTooltip title="Report a Problem">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="gap-2"
        >
          <Bug className="h-5 w-5" />
          <span className="hidden sm:inline">Got a question?</span>
        </Button>
      </JoyTooltip>

      <ReportProblemDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  );
};
