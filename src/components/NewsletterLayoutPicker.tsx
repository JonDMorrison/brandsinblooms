import React, { type KeyboardEvent } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { NewsletterIdea, NewsletterTemplate } from "@/types/newsletter";

type LayoutKey = NewsletterTemplate["layout"];
type NewsletterIdeaSummary = Pick<
  NewsletterIdea,
  "title" | "description" | "category" | "badge" | "weekNumber"
>;

const categoryLabelByCategory: Record<NewsletterIdea["category"], string> = {
  holiday: "Holiday",
  seasonal: "Seasonal",
  product: "Product",
  "ai-generated": "AI Idea",
  general: "General",
  weekly: "Weekly",
};

const defaultTemplates: NewsletterTemplate[] = [
  {
    id: "block-builder",
    name: "Block Builder",
    layout: "block-builder",
    thumbnail: "",
    description:
      "Drag-and-drop content blocks to create a fully custom newsletter layout.",
    isDefault: true,
  },
  {
    id: "simple-email",
    name: "Simple Email",
    layout: "simple-email",
    thumbnail: "",
    description:
      "A clean, single-column format focused on text content and announcements.",
  },
];

function getIdeaMetaLabel(idea: NewsletterIdeaSummary) {
  const categoryLabel = categoryLabelByCategory[idea.category].toUpperCase();
  const secondaryLabel =
    idea.badge ??
    (typeof idea.weekNumber === "number" ? `Week ${idea.weekNumber}` : null);

  return secondaryLabel
    ? `${categoryLabel} · ${secondaryLabel}`
    : categoryLabel;
}

function BlockBuilderPreview() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 200"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <rect
        x="24"
        y="18"
        width="272"
        height="26"
        rx="6"
        fill="var(--joy-palette-neutral-200)"
        stroke="var(--joy-palette-neutral-300)"
        strokeWidth="1.5"
      />

      {[
        { x: 24, y: 60 },
        { x: 164, y: 60 },
        { x: 24, y: 114 },
        { x: 164, y: 114 },
      ].map((block) => (
        <g key={`${block.x}-${block.y}`}>
          <rect
            x={block.x}
            y={block.y}
            width="132"
            height="40"
            rx="6"
            fill="var(--joy-palette-background-surface)"
            stroke="var(--joy-palette-neutral-300)"
            strokeWidth="1.5"
          />
          <rect
            x={block.x + 12}
            y={block.y + 10}
            width="54"
            height="6"
            rx="3"
            fill="var(--joy-palette-neutral-200)"
          />
          <rect
            x={block.x + 12}
            y={block.y + 20}
            width="92"
            height="4"
            rx="2"
            fill="var(--joy-palette-neutral-200)"
          />
          <rect
            x={block.x + 12}
            y={block.y + 28}
            width="74"
            height="4"
            rx="2"
            fill="var(--joy-palette-neutral-200)"
          />
        </g>
      ))}

      <rect
        x="24"
        y="168"
        width="272"
        height="18"
        rx="6"
        fill="var(--joy-palette-primary-200)"
        stroke="var(--joy-palette-neutral-300)"
        strokeWidth="1.5"
      />
      <rect
        x="40"
        y="174"
        width="96"
        height="5"
        rx="2.5"
        fill="var(--joy-palette-background-surface)"
      />
    </svg>
  );
}

function SimpleEmailPreview() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 200"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <rect
        x="88"
        y="14"
        width="144"
        height="172"
        rx="12"
        fill="var(--joy-palette-background-surface)"
        stroke="var(--joy-palette-neutral-300)"
        strokeWidth="1.5"
      />
      <circle
        cx="160"
        cy="36"
        r="10"
        fill="var(--joy-palette-neutral-200)"
        stroke="var(--joy-palette-neutral-300)"
        strokeWidth="1.5"
      />
      <rect
        x="108"
        y="58"
        width="104"
        height="10"
        rx="5"
        fill="var(--joy-palette-neutral-200)"
      />
      <rect
        x="108"
        y="80"
        width="108"
        height="5"
        rx="2.5"
        fill="var(--joy-palette-neutral-200)"
      />
      <rect
        x="108"
        y="91"
        width="102"
        height="5"
        rx="2.5"
        fill="var(--joy-palette-neutral-200)"
      />
      <rect
        x="108"
        y="102"
        width="114"
        height="5"
        rx="2.5"
        fill="var(--joy-palette-neutral-200)"
      />
      <rect
        x="108"
        y="113"
        width="86"
        height="5"
        rx="2.5"
        fill="var(--joy-palette-neutral-200)"
      />
      <rect
        x="128"
        y="132"
        width="64"
        height="18"
        rx="8"
        fill="var(--joy-palette-primary-200)"
        stroke="var(--joy-palette-neutral-300)"
        strokeWidth="1.5"
      />
      <rect
        x="116"
        y="162"
        width="88"
        height="5"
        rx="2.5"
        fill="var(--joy-palette-neutral-200)"
      />
      <rect
        x="126"
        y="173"
        width="68"
        height="5"
        rx="2.5"
        fill="var(--joy-palette-neutral-200)"
      />
    </svg>
  );
}

const layoutContentByLayout: Record<
  LayoutKey,
  {
    description: string;
    featureHints: string[];
    preview: React.ReactNode;
  }
> = {
  "block-builder": {
    description:
      "Drag-and-drop content blocks to create a fully custom newsletter layout. Best for rich, visual newsletters with multiple sections.",
    featureHints: ["Multi-section", "Images & CTAs", "Full control"],
    preview: <BlockBuilderPreview />,
  },
  "simple-email": {
    description:
      "A clean, single-column format focused on text content. Ideal for announcements, updates, and personal newsletters.",
    featureHints: ["Text-focused", "Clean layout", "Quick to write"],
    preview: <SimpleEmailPreview />,
  },
};

function LayoutOptionCard({
  selected,
  template,
  onSelect,
}: {
  selected: boolean;
  template: NewsletterTemplate;
  onSelect: () => void;
}) {
  const layoutContent = layoutContentByLayout[template.layout];

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      variant="outlined"
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      sx={{
        p: 0,
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        borderRadius: "lg",
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? "primary.500" : "neutral.200",
        bgcolor: "background.surface",
        boxShadow: "none",
        cursor: "pointer",
        transition: "border-color 150ms ease, box-shadow 150ms ease",
        outline: "none",
        "&:hover": {
          borderColor: selected ? "primary.500" : "primary.300",
        },
        "&:focus-visible": {
          borderColor: selected ? "primary.500" : "primary.400",
        },
      }}
    >
      {selected ? (
        <Chip
          size="sm"
          variant="solid"
          color="primary"
          sx={{
            position: "absolute",
            top: 14,
            right: 14,
            zIndex: 1,
            minHeight: 24,
            minWidth: 24,
            px: 0.75,
            borderRadius: "999px",
          }}
        >
          <Check size={14} />
        </Chip>
      ) : null}

      <Box sx={{ p: 2.5, pb: 0 }}>
        <Box
          sx={{
            bgcolor: "background.level1",
            borderRadius: "sm",
            p: 2,
            height: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {layoutContent.preview}
        </Box>
      </Box>

      <Stack
        spacing={1.5}
        sx={{ p: 2.5, flex: 1, justifyContent: "space-between" }}
      >
        <Stack spacing={0.75}>
          <Typography level="title-md" sx={{ fontWeight: 600 }}>
            {template.name}
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary", mt: 0.5 }}>
            {layoutContent.description}
          </Typography>
        </Stack>

        <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
          {layoutContent.featureHints.map((feature) => (
            <Chip
              key={feature}
              size="sm"
              variant="outlined"
              color="neutral"
              sx={{ borderRadius: "sm" }}
            >
              {feature}
            </Chip>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}

export function NewsletterLayoutPicker({
  idea,
  onBack,
  onChange,
  onContinue,
  templates,
  value,
}: {
  idea: NewsletterIdeaSummary;
  onBack: () => void;
  onChange: (v: LayoutKey) => void;
  onContinue: () => void;
  templates: NewsletterTemplate[];
  value: LayoutKey | null;
}) {
  const sourceTemplates = templates.length > 0 ? templates : defaultTemplates;
  const templateByLayout = new Map(
    sourceTemplates.map((template) => [template.layout, template]),
  );
  const resolvedTemplates = (["block-builder", "simple-email"] as const)
    .map((layout) => templateByLayout.get(layout))
    .filter((template): template is NewsletterTemplate => Boolean(template));

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Box
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 3, pt: 2.5, pb: 3 }}
      >
        <Stack spacing={3}>
          <Card
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: "lg",
              borderColor: "neutral.200",
              bgcolor: "background.surface",
              boxShadow: "none",
            }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={2}
              alignItems={{ xs: "flex-start", sm: "center" }}
              justifyContent="space-between"
            >
              <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  level="body-xs"
                  sx={{
                    color: "text.tertiary",
                    textTransform: "uppercase",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                  }}
                >
                  {getIdeaMetaLabel(idea)}
                </Typography>
                <Typography level="title-md" sx={{ fontWeight: 700 }}>
                  {idea.title}
                </Typography>
                <Typography
                  level="body-sm"
                  sx={{
                    color: "text.secondary",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                    overflow: "hidden",
                  }}
                >
                  {idea.description}
                </Typography>
              </Stack>

              <Button
                variant="plain"
                color="primary"
                size="sm"
                startDecorator={<ArrowLeft size={14} />}
                onClick={onBack}
                sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
              >
                Change idea
              </Button>
            </Stack>
          </Card>

          <Stack spacing={0.75}>
            <Typography level="title-lg" sx={{ fontWeight: 600 }}>
              Choose a Layout
            </Typography>
            <Typography
              level="body-sm"
              sx={{ color: "text.secondary", mb: 2.5 }}
            >
              Select how your newsletter will be structured.
            </Typography>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2.5,
              alignItems: "stretch",
            }}
          >
            {resolvedTemplates.map((template) => (
              <LayoutOptionCard
                key={template.id}
                selected={value === template.layout}
                template={template}
                onSelect={() => onChange(template.layout)}
              />
            ))}
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ borderColor: "neutral.100" }} />

      <Box
        sx={{
          display: "flex",
          flexWrap: { xs: "wrap", sm: "nowrap" },
          gap: 1.5,
          justifyContent: "space-between",
          alignItems: "center",
          px: 3,
          py: 2,
        }}
      >
        <Button
          size="sm"
          variant="plain"
          color="neutral"
          startDecorator={<ArrowLeft size={14} />}
          onClick={onBack}
        >
          Back to ideas
        </Button>

        <Button
          size="md"
          variant="solid"
          color="primary"
          disabled={!value}
          endDecorator={<ArrowRight size={16} />}
          onClick={onContinue}
          sx={{ ml: { sm: "auto" } }}
        >
          Continue to Editor
        </Button>
      </Box>
    </Stack>
  );
}
