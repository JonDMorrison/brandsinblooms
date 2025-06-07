
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { MasterTemplateImportDialog } from "../content-import/MasterTemplateImportDialog";
import { CsvUploadDialog } from "../content-import/CsvUploadDialog";

interface HomepageHeaderProps {
  onNewCampaignClick: () => void;
  onImportComplete: () => void;
}

export const HomepageHeader = ({ onNewCampaignClick, onImportComplete }: HomepageHeaderProps) => {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold text-garden-green-dark mb-2">
        Welcome to Your Marketing Hub
      </h1>
      <p className="text-garden-green">
        Plan, generate, and manage your content with ease
      </p>
    </div>
  );
};
