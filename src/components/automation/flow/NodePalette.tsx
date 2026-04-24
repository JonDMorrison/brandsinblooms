import * as React from "react";
import Box from "@mui/joy/Box";
import Input from "@mui/joy/Input";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { GripVertical, Search } from "lucide-react";
import {
  automationPaletteSections,
  getAutomationNodeVisual,
} from "@/components/automation/flow/automationNodeVisuals";

type NodePaletteProps = {
  onAddNode: (nodeType: string, triggerType?: string) => void;
};

function PaletteItem({
  label,
  nodeType,
  triggerType,
  category,
  icon: Icon,
  onAddNode,
}: (typeof automationPaletteSections)[number]["items"][number] &
  NodePaletteProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const visual = getAutomationNodeVisual(nodeType, {}, triggerType);

  const handleDragStart = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.dataTransfer.setData("application/reactflow-type", nodeType);
      if (triggerType) {
        event.dataTransfer.setData(
          "application/reactflow-trigger",
          triggerType,
        );
      }
      event.dataTransfer.effectAllowed = "move";
      setIsDragging(true);
    },
    [nodeType, triggerType],
  );

  return (
    <Sheet
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => onAddNode(nodeType, triggerType)}
      variant="outlined"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: "md",
        cursor: "grab",
        position: "relative",
        transition:
          "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, opacity 0.15s ease",
        backgroundColor: "background.surface",
        opacity: isDragging ? 0.6 : 1,
        "&:hover": {
          borderColor: "primary.300",
          boxShadow: "sm",
          transform: "translateY(-1px)",
        },
        "&:active": {
          cursor: "grabbing",
          boxShadow: "md",
        },
      }}
    >
      <Box
        sx={{
          width: 4,
          height: 24,
          borderRadius: "999px",
          flexShrink: 0,
          backgroundColor: visual.tone.accentColor,
        }}
      />
      <Box
        sx={{
          color: visual.tone.accentColor,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={18} />
      </Box>
      <Typography
        level="body-sm"
        sx={{ fontWeight: 500, flex: 1, minWidth: 0 }}
      >
        {label}
      </Typography>
      <Box
        className="palette-grip"
        sx={{
          color: "neutral.300",
          display: "inline-flex",
          opacity: isDragging ? 1 : 0,
          transition: "opacity 0.15s ease",
          ".MuiSheet-root:hover &": {
            opacity: 1,
          },
        }}
      >
        <GripVertical size={14} />
      </Box>
    </Sheet>
  );
}

export function NodePalette({ onAddNode }: NodePaletteProps) {
  const [query, setQuery] = React.useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredSections = React.useMemo(
    () =>
      automationPaletteSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) =>
            normalizedQuery
              ? item.label.toLowerCase().includes(normalizedQuery)
              : true,
          ),
        }))
        .filter((section) => section.items.length > 0),
    [normalizedQuery],
  );

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: "1px solid",
        borderColor: "divider",
        backgroundColor: "background.surface",
        overflowY: "auto",
      }}
    >
      <Box sx={{ p: 2 }}>
        <Input
          size="sm"
          variant="plain"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find nodes..."
          startDecorator={<Search size={14} />}
          sx={{
            mb: 2,
            borderRadius: "md",
            backgroundColor: "neutral.50",
            "--Input-focusedThickness": "0px",
          }}
        />

        {filteredSections.map((section, index) => (
          <Box key={section.label} sx={{ mt: index === 0 ? 0 : 2.5 }}>
            <Typography
              level="body-xs"
              sx={{
                px: 1,
                mt: 2,
                mb: 1,
                color: "neutral.500",
                textTransform: "uppercase",
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
              }}
            >
              {section.label}
            </Typography>
            <Stack spacing={0.75}>
              {section.items.map((item) => (
                <PaletteItem
                  key={`${section.label}-${item.label}`}
                  {...item}
                  onAddNode={onAddNode}
                />
              ))}
            </Stack>
          </Box>
        ))}

        {filteredSections.length === 0 ? (
          <Sheet
            variant="soft"
            color="neutral"
            sx={{ p: 1.5, borderRadius: "md", mt: 1.5 }}
          >
            <Typography level="body-xs" sx={{ color: "neutral.600" }}>
              No matching nodes. Try a different search term.
            </Typography>
          </Sheet>
        ) : null}
      </Box>
    </Box>
  );
}
