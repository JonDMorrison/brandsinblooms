import React from "react";
import AspectRatio from "@mui/joy/AspectRatio";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowLeft } from "lucide-react";
import { NewsletterTemplate } from "@/types/newsletter";

type LayoutKey = NewsletterTemplate["layout"];

const surfaceTransition =
  "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease";

const defaultTemplates: NewsletterTemplate[] = [
  {
    id: "block-builder",
    name: "Block Builder",
    layout: "block-builder",
    thumbnail: "",
    description: "Multiple customizable blocks for rich content",
    isDefault: true,
  },
  {
    id: "simple-email",
    name: "Simple Email",
    layout: "simple-email",
    thumbnail: "",
    description: "Clean, straightforward single-column format",
  },
];

function LayoutPreview({ layout }: { layout: LayoutKey }) {
  if (layout === "block-builder") {
    return (
      <Stack spacing={1} sx={{ height: "100%", p: 1.5, bgcolor: "neutral.50" }}>
        <Box
          sx={{
            borderRadius: "md",
            border: "1px solid",
            borderColor: "neutral.200",
            bgcolor: "background.surface",
            p: 1,
          }}
        >
          <Box
            sx={{
              height: 12,
              width: "58%",
              borderRadius: "sm",
              bgcolor: "neutral.300",
              mb: 0.75,
            }}
          />
          <Box
            sx={{
              height: 8,
              width: "84%",
              borderRadius: "sm",
              bgcolor: "neutral.200",
            }}
          />
        </Box>

        {Array.from({ length: 2 }).map((_, index) => (
          <Box
            key={index}
            sx={{
              borderRadius: "md",
              border: "1px solid",
              borderColor: "neutral.200",
              bgcolor: "background.surface",
              p: 0.85,
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1.1fr 1fr",
                gap: 0.75,
                minHeight: 52,
              }}
            >
              <Box sx={{ borderRadius: "sm", bgcolor: "neutral.100" }} />
              <Stack spacing={0.5} justifyContent="center">
                <Box
                  sx={{
                    height: 8,
                    width: "88%",
                    borderRadius: "sm",
                    bgcolor: "neutral.300",
                  }}
                />
                <Box
                  sx={{
                    height: 8,
                    width: "72%",
                    borderRadius: "sm",
                    bgcolor: "neutral.200",
                  }}
                />
                <Box
                  sx={{
                    height: 8,
                    width: "80%",
                    borderRadius: "sm",
                    bgcolor: "neutral.200",
                  }}
                />
              </Stack>
            </Box>
          </Box>
        ))}

        <Box
          sx={{
            mt: "auto",
            borderRadius: "md",
            border: "1px solid",
            borderColor: "neutral.200",
            bgcolor: "background.surface",
            p: 0.75,
          }}
        >
          <Box
            sx={{
              height: 8,
              width: "54%",
              borderRadius: "sm",
              bgcolor: "neutral.300",
            }}
          />
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={1} sx={{ height: "100%", p: 1.5, bgcolor: "neutral.50" }}>
      <Box
        sx={{
          flex: 1,
          borderRadius: "md",
          border: "1px solid",
          borderColor: "neutral.200",
          bgcolor: "background.surface",
          p: 1.15,
          display: "flex",
          flexDirection: "column",
          gap: 0.9,
        }}
      >
        <Box
          sx={{
            height: 14,
            width: "54%",
            borderRadius: "sm",
            bgcolor: "neutral.300",
          }}
        />
        <Box
          sx={{
            height: 8,
            width: "88%",
            borderRadius: "sm",
            bgcolor: "neutral.200",
          }}
        />
        <Box
          sx={{
            height: 8,
            width: "96%",
            borderRadius: "sm",
            bgcolor: "neutral.200",
          }}
        />
        <Box
          sx={{
            height: 8,
            width: "80%",
            borderRadius: "sm",
            bgcolor: "neutral.200",
          }}
        />
        <Box sx={{ height: 72, borderRadius: "md", bgcolor: "neutral.100" }} />
        <Box
          sx={{
            height: 8,
            width: "94%",
            borderRadius: "sm",
            bgcolor: "neutral.200",
          }}
        />
        <Box
          sx={{
            height: 8,
            width: "76%",
            borderRadius: "sm",
            bgcolor: "neutral.200",
          }}
        />
        <Box
          sx={{
            mt: "auto",
            height: 24,
            borderRadius: "sm",
            bgcolor: "neutral.200",
          }}
        />
      </Box>
    </Stack>
  );
}

export function NewsletterLayoutPicker({
  ideaTitle,
  onBack,
  onChange,
  onContinue,
  templates,
  value,
}: {
  ideaTitle: string;
  onBack: () => void;
  onChange: (v: LayoutKey) => void;
  onContinue: () => void;
  templates: NewsletterTemplate[];
  value: LayoutKey | null;
}) {
  const resolvedTemplates = templates.length > 0 ? templates : defaultTemplates;

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        useFlexGap
        flexWrap="wrap"
        sx={{ px: 3, pt: 2.5, pb: 2 }}
      >
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          Selected:{" "}
          <Box component="span" sx={{ color: "text.primary", fontWeight: 500 }}>
            {ideaTitle}
          </Box>
        </Typography>

        <Typography
          level="body-sm"
          onClick={onBack}
          sx={{
            color: "primary.plainColor",
            fontWeight: 500,
            cursor: "pointer",
            "&:hover": {
              textDecoration: "underline",
            },
          }}
        >
          ← Change idea
        </Typography>
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 3, pb: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, minmax(0, 1fr))",
              md: "repeat(3, minmax(0, 1fr))",
            },
            gap: 2,
          }}
        >
          {resolvedTemplates.map((template) => {
            const selected = value === template.layout;

            return (
              <Card
                key={template.id}
                variant="outlined"
                onClick={() => onChange(template.layout)}
                sx={{
                  p: 0,
                  borderRadius: "lg",
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? "primary.400" : "neutral.200",
                  backgroundColor: "background.surface",
                  boxShadow: selected
                    ? "0 4px 12px rgba(0, 0, 0, 0.06)"
                    : "0 1px 2px rgba(0, 0, 0, 0.03)",
                  cursor: "pointer",
                  overflow: "hidden",
                  transition: surfaceTransition,
                  "&:hover": {
                    transform: "translateY(-1px)",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.06)",
                    borderColor: selected ? "primary.400" : "neutral.300",
                  },
                }}
              >
                <AspectRatio ratio="4 / 5">
                  <Box sx={{ height: "100%", bgcolor: "background.surface" }}>
                    <LayoutPreview layout={template.layout} />
                  </Box>
                </AspectRatio>

                <Box
                  sx={{
                    px: 2,
                    py: 1.5,
                    borderTop: "1px solid",
                    borderColor: "neutral.100",
                    textAlign: "center",
                  }}
                >
                  <Typography
                    level="body-sm"
                    sx={{
                      fontWeight: 500,
                      color: selected ? "primary.plainColor" : "text.primary",
                    }}
                  >
                    {template.name}
                  </Typography>
                </Box>
              </Card>
            );
          })}
        </Box>
      </Box>

      <Divider sx={{ borderColor: "neutral.100" }} />

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ px: 3, py: 2 }}
      >
        <Button
          size="sm"
          variant="plain"
          color="neutral"
          startDecorator={<ArrowLeft size={14} />}
          onClick={onBack}
          sx={{
            "&:hover": {
              backgroundColor: "neutral.100",
            },
          }}
        >
          Back to ideas
        </Button>

        <Button
          size="lg"
          variant="solid"
          color="primary"
          disabled={!value}
          onClick={onContinue}
          sx={{ minWidth: { xs: 180, sm: 220 } }}
        >
          Continue to Editor
        </Button>
      </Stack>
    </Stack>
  );
}
