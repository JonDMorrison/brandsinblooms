import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  STUDIO_BLOCK_LOOKUP,
  type StudioBlockType,
} from "@/components/crm/studio/blockLibraryData";

type BlockDragOverlayProps = {
  type: StudioBlockType;
  label: string;
};

export default function BlockDragOverlay({
  type,
  label,
}: BlockDragOverlayProps) {
  const Icon = STUDIO_BLOCK_LOOKUP[type].icon;

  return (
    <Sheet
      variant="outlined"
      sx={{
        width: 200,
        opacity: 0.92,
        boxShadow: "lg",
        borderRadius: "10px",
        border: "1.5px solid",
        borderColor: "primary.300",
        bgcolor: "background.surface",
        transform: "translate(16px, 12px) rotate(1.5deg) scale(1.02)",
        pointerEvents: "none",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.25 }}>
        <Icon size={16} />
        <Typography level="title-sm">{label}</Typography>
      </Stack>
    </Sheet>
  );
}
