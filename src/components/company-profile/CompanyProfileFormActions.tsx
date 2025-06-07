
import { Button } from "@/components/ui/button";
import { Edit, Save, X } from "lucide-react";

interface CompanyProfileFormActionsProps {
  isEditing: boolean;
  isSaving: boolean;
  onToggleEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export const CompanyProfileFormActions = ({ 
  isEditing, 
  isSaving, 
  onToggleEdit, 
  onSave, 
  onCancel 
}: CompanyProfileFormActionsProps) => {
  return (
    <div className="flex gap-2">
      {isEditing ? (
        <>
          <Button variant="outline" size="sm" onClick={onCancel} className="text-base">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button size="sm" onClick={onSave} disabled={isSaving} className="text-base">
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={onToggleEdit} className="text-base">
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </Button>
      )}
    </div>
  );
};
