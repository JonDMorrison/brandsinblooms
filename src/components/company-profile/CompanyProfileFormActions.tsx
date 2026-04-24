import Stack from "@mui/joy/Stack";
import { Edit, Save, X } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";

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
  onCancel,
}: CompanyProfileFormActionsProps) => {
  return (
    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
      {isEditing ? (
        <>
          <JoyButton color="neutral" onClick={onCancel} variant="plain">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </JoyButton>
          <JoyButton
            loading={isSaving}
            loadingPosition="start"
            onClick={onSave}
            startDecorator={
              !isSaving ? <Save className="w-4 h-4" /> : undefined
            }
            variant="solid"
          >
            Save changes
          </JoyButton>
        </>
      ) : (
        <JoyButton
          color="neutral"
          onClick={onToggleEdit}
          startDecorator={<Edit className="w-4 h-4" />}
          variant="plain"
        >
          Edit
        </JoyButton>
      )}
    </Stack>
  );
};
