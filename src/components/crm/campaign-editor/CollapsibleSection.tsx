import * as React from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ChevronDown } from "lucide-react";

export interface CollapsibleSectionProps {
  id?: string;
  title: React.ReactNode;
  summary?: React.ReactNode;
  badge?: React.ReactNode;
  endDecorator?: React.ReactNode;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  id,
  title,
  summary,
  badge,
  endDecorator,
  defaultExpanded = true,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const reactId = React.useId();
  const bodyId = `${id ?? reactId}-body`;

  const toggle = React.useCallback(() => {
    setExpanded((previous) => !previous);
  }, []);

  const onHeaderKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    },
    [toggle],
  );

  return (
    <Card
      id={id}
      variant="outlined"
      sx={{ borderRadius: "xl", p: 0, overflow: "hidden" }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        // Only target a real id when the body is in the DOM. Setting
        // aria-controls to a non-existent id trips automated WCAG
        // checks even though the relationship is logically inferable.
        aria-controls={expanded ? bodyId : undefined}
        onClick={toggle}
        onKeyDown={onHeaderKeyDown}
        sx={{
          px: 3,
          py: 2,
          borderBottom: expanded ? "1px solid" : "none",
          borderColor: "neutral.200",
          backgroundColor: "neutral.50",
          cursor: "pointer",
          transition: "background-color 0.16s ease",
          "&:hover": { backgroundColor: "neutral.100" },
          "&:focus-visible": {
            outline: "2px solid var(--joy-palette-primary-400)",
            outlineOffset: "-2px",
          },
        }}
      >
        <Stack
          direction="row"
          spacing={1.5}
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ minWidth: 0, flex: 1 }}
          >
            <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                sx={{ minWidth: 0 }}
              >
                {/* Render the title as an inline <span> so the surrounding
                    role="button" doesn't contain a block-level <p>. */}
                <Typography
                  component="span"
                  level="title-sm"
                  fontWeight="md"
                  sx={{ color: "neutral.800" }}
                >
                  {title}
                </Typography>
                {badge}
              </Stack>
              {!expanded && summary ? (
                <Typography
                  component="span"
                  level="body-sm"
                  sx={{
                    display: "block",
                    color: "neutral.600",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {summary}
                </Typography>
              ) : null}
            </Stack>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {endDecorator}
            <Box
              aria-hidden
              sx={{
                display: "inline-flex",
                color: "neutral.500",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.16s ease",
              }}
            >
              <ChevronDown size={16} />
            </Box>
          </Stack>
        </Stack>
      </Box>
      {/* Only render children when expanded so heavy subtrees
          (Live Preview iframe, etc.) don't mount until the user
          actually expands the section. */}
      {expanded ? (
        <Box id={bodyId} sx={{ p: 3 }}>
          {children}
        </Box>
      ) : null}
    </Card>
  );
}
