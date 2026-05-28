import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { X } from "lucide-react";
import { useBloom } from "@/components/bloom/BloomContext";
import { JoyChip } from "@/components/joy/JoyChip";

interface ShortcutRow {
  description: string;
  keys: string;
}

interface ShortcutSection {
  rows: ShortcutRow[];
  title: string;
}

function isMacPlatform() {
  if (typeof navigator === "undefined") {
    return false;
  }

  const platform =
    navigator.userAgentData?.platform ??
    navigator.platform ??
    navigator.userAgent;

  return /mac/i.test(platform);
}

function createShortcutSections(isMac: boolean): ShortcutSection[] {
  const modifier = isMac ? "⌘" : "Ctrl";
  const shift = isMac ? "⇧" : "+Shift";
  const join = (suffix: string) =>
    isMac ? `${modifier}${suffix}` : `${modifier}+${suffix}`;
  const joinWithShift = (suffix: string) =>
    isMac ? `${modifier}${shift}${suffix}` : `${modifier}${shift}+${suffix}`;

  return [
    {
      title: "Global",
      rows: [
        { keys: join("K"), description: "Open command palette" },
        { keys: join("J"), description: "Open Bloom" },
        { keys: joinWithShift("J"), description: "New conversation" },
      ],
    },
    {
      title: "Chat",
      rows: [
        { keys: "Enter", description: "Send message" },
        {
          keys: isMac ? "⇧Enter" : "Shift+Enter",
          description: "New line",
        },
        {
          keys: joinWithShift("R"),
          description: "Regenerate response",
        },
        {
          keys: joinWithShift("E"),
          description: "Edit last message",
        },
        {
          keys: joinWithShift("C"),
          description: "Copy last response",
        },
        { keys: "↑", description: "Load last message" },
      ],
    },
    {
      title: "Modes",
      rows: [
        { keys: join("1"), description: "Standard" },
        { keys: join("2"), description: "Reasoning" },
        { keys: join("3"), description: "Research" },
        { keys: join("4"), description: "Image" },
      ],
    },
    {
      title: "Commands",
      rows: [
        { keys: "/", description: "Open command menu" },
        { keys: "Esc", description: "Close menu / sidebar" },
      ],
    },
  ];
}

export function BloomShortcutsPanel() {
  const { closeShortcutsPanel, shortcutsPanelOpen } = useBloom();
  const isMac = React.useMemo(() => isMacPlatform(), []);
  const sections = React.useMemo(() => createShortcutSections(isMac), [isMac]);

  return (
    <Modal open={shortcutsPanelOpen} onClose={closeShortcutsPanel}>
      <ModalDialog
        aria-labelledby="bloom-shortcuts-panel-title"
        sx={{
          width: "min(680px, 92vw)",
          maxWidth: "92vw",
          maxHeight: "min(80vh, 720px)",
          overflow: "hidden",
          p: 0,
          borderRadius: "xl",
          backgroundColor: "background.surface",
          boxShadow: "lg",
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: 2,
            py: 1.75,
            borderBottom: "1px solid",
            borderColor: "neutral.200",
          }}
        >
          <Typography id="bloom-shortcuts-panel-title" level="title-lg">
            Keyboard Shortcuts
          </Typography>
          <IconButton
            aria-label="Close keyboard shortcuts"
            color="neutral"
            size="sm"
            variant="plain"
            onClick={closeShortcutsPanel}
          >
            <X size={16} strokeWidth={2} />
          </IconButton>
        </Stack>

        <Stack spacing={2} sx={{ px: 2, py: 2, overflowY: "auto" }}>
          {sections.map((section) => (
            <Stack key={section.title} spacing={1}>
              <Typography level="title-sm" sx={{ color: "neutral.900" }}>
                {section.title}
              </Typography>
              <Stack spacing={0.75}>
                {section.rows.map((row) => (
                  <Box
                    key={`${section.title}-${row.keys}`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 2,
                      py: 0.75,
                      minWidth: 0,
                    }}
                  >
                    <JoyChip
                      size="sm"
                      variant="soft"
                      color="neutral"
                      sx={{
                        borderRadius: "999px",
                        fontFamily: "var(--joy-fontFamily-code, monospace)",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {row.keys}
                    </JoyChip>
                    <Typography
                      level="body-sm"
                      sx={{ color: "neutral.600", textAlign: "right" }}
                    >
                      {row.description}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>
          ))}
        </Stack>
      </ModalDialog>
    </Modal>
  );
}
