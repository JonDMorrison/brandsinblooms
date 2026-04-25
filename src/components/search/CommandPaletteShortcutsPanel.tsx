import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

const SHORTCUTS = [
  { keys: ["↑", "↓"], label: "Move through results" },
  { keys: ["→"], label: "Open the selected action menu" },
  { keys: ["←", "Esc"], label: "Close the open action menu" },
  { keys: ["Enter"], label: "Open the selected result or execute the action" },
  { keys: ["Ctrl", "Enter"], label: "Open the selected result in a new tab on Windows or Linux" },
  { keys: ["Cmd", "Enter"], label: "Open the selected result in a new tab on macOS" },
  { keys: [">"], label: "Switch into command mode" },
  { keys: ["Tab"], label: "Move focus to the filter bar" },
  { keys: ["?"], label: "Toggle this shortcuts reference" },
  { keys: ["Esc"], label: "Close the palette when no submenu is open" },
] as const;

export function CommandPaletteShortcutsPanel() {
  return (
    <Stack spacing={1.5} sx={{ p: 1.5 }}>
      <Box sx={{ px: 0.5, pt: 0.25 }}>
        <Typography level="title-sm" sx={{ color: "neutral.800" }}>
          Keyboard Shortcuts
        </Typography>
        <Typography level="body-sm" sx={{ mt: 0.5, color: "neutral.500" }}>
          The palette keeps focus in the search field, so these shortcuts work without moving into the result list.
        </Typography>
      </Box>

      <Stack spacing={0.75}>
        {SHORTCUTS.map((shortcut) => (
          <Sheet
            key={`${shortcut.keys.join("-")}-${shortcut.label}`}
            variant="soft"
            sx={{
              px: 1.25,
              py: 1,
              borderRadius: "lg",
              backgroundColor:
                "rgba(var(--joy-palette-neutral-mainChannel) / 0.045)",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
            >
              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                {shortcut.keys.map((key) => (
                  <Chip
                    key={`${shortcut.label}-${key}`}
                    size="sm"
                    variant="soft"
                    sx={{
                      minWidth: 34,
                      justifyContent: "center",
                      borderRadius: "999px",
                      fontFamily: "var(--joy-fontFamily-code, monospace)",
                      fontWeight: 700,
                    }}
                  >
                    {key}
                  </Chip>
                ))}
              </Stack>

              <Typography level="body-sm" sx={{ color: "neutral.600" }}>
                {shortcut.label}
              </Typography>
            </Stack>
          </Sheet>
        ))}
      </Stack>
    </Stack>
  );
}