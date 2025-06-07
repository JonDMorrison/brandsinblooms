
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { MasterTemplateImportDialog } from "../content-import/MasterTemplateImportDialog";
import { CsvUploadDialog } from "../content-import/CsvUploadDialog";

interface HomepageActionsProps {
  onNewCampaignClick: () => void;
  onImportComplete: () => void;
}

export const HomepageActions = ({ onNewCampaignClick, onImportComplete }: HomepageActionsProps) => {
  return (
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-semibold text-garden-green-dark">
        Current Campaign
      </h2>
      <div className="flex gap-2">
        <MasterTemplateImportDialog onImportComplete={onImportComplete} />
        <CsvUploadDialog onImportComplete={onImportComplete} />
        <Button onClick={onNewCampaignClick} className="bg-garden-green hover:bg-garden-green-dark text-white">
          <PlusCircle className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>
    </div>
  );
};
