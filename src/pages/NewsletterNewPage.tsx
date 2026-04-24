import React, { useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowRight, PenTool, Sparkles, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "@/components/joy/PageContainer";
import { NewsletterPicker } from "@/components/newsletter/NewsletterPicker";

const surfaceTransition =
  "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease";

type CreationPathCardProps = {
  title: string;
  description: string;
  buttonLabel: string;
  buttonVariant: "solid" | "outlined";
  chipLabel?: string;
  highlighted?: boolean;
  icon: LucideIcon;
  order: { xs: number; md: number };
  onClick: () => void;
};

function CreationPathCard({
  title,
  description,
  buttonLabel,
  buttonVariant,
  chipLabel,
  highlighted = false,
  icon: Icon,
  order,
  onClick,
}: CreationPathCardProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        order,
        p: { xs: 3, md: 4 },
        minHeight: { xs: 320, md: 380 },
        borderRadius: "xl",
        borderColor: highlighted ? "primary.200" : "neutral.200",
        background: highlighted
          ? "linear-gradient(145deg, rgba(var(--joy-palette-primary-mainChannel) / 0.08) 0%, rgba(255, 255, 255, 0.98) 72%)"
          : "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.92) 100%)",
        boxShadow: "sm",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        transition: surfaceTransition,
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "lg",
          borderColor: highlighted ? "primary.300" : "neutral.300",
        },
        "&:hover .newsletter-create-path__icon": {
          backgroundColor: highlighted
            ? "rgba(var(--joy-palette-primary-mainChannel) / 0.18)"
            : "rgba(var(--joy-palette-neutral-mainChannel) / 0.14)",
        },
      }}
    >
      <Stack spacing={2.5} sx={{ flex: 1 }}>
        <Sheet
          className="newsletter-create-path__icon"
          variant="soft"
          color={highlighted ? "primary" : "neutral"}
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            transition: "background-color 0.2s ease",
          }}
        >
          <Icon size={30} />
        </Sheet>

        <Stack spacing={1.25} sx={{ flex: 1 }}>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
          >
            <Typography level="title-lg">{title}</Typography>
            {chipLabel ? (
              <Chip size="sm" variant="soft" color="primary">
                {chipLabel}
              </Chip>
            ) : null}
          </Stack>

          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            {description}
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ pt: 1 }}>
        <Button
          size="md"
          variant={buttonVariant}
          color={highlighted ? "primary" : "neutral"}
          endDecorator={<ArrowRight size={16} />}
          onClick={onClick}
          sx={{ width: "100%" }}
        >
          {buttonLabel}
        </Button>
      </Box>
    </Card>
  );
}

export const NewsletterNewPage = () => {
  const [showPicker, setShowPicker] = useState(false);
  const navigate = useNavigate();

  return (
    <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3.5 } }}>
      <Stack spacing={3.5}>
        <Sheet
          variant="soft"
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "xl",
            p: { xs: 3, md: 4 },
            border: "1px solid",
            borderColor: "neutral.200",
            background:
              "linear-gradient(135deg, rgba(var(--joy-palette-primary-mainChannel) / 0.06) 0%, rgba(var(--joy-palette-warning-mainChannel) / 0.05) 50%, rgba(255, 255, 255, 0.98) 100%)",
            "&::before": {
              content: '""',
              position: "absolute",
              inset: "auto -96px -120px auto",
              width: 260,
              height: 260,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(var(--joy-palette-primary-mainChannel) / 0.12) 0%, rgba(var(--joy-palette-primary-mainChannel) / 0) 70%)",
              pointerEvents: "none",
            },
          }}
        >
          <Stack spacing={1.25} sx={{ maxWidth: 680, position: "relative" }}>
            <Typography level="h2">Create a Newsletter</Typography>
            <Typography level="body-md" sx={{ color: "text.secondary" }}>
              Start from scratch or let AI inspire your next send.
            </Typography>
          </Stack>
        </Sheet>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
            gap: 2.5,
          }}
        >
          <CreationPathCard
            order={{ xs: 2, md: 1 }}
            title="Start from Scratch"
            description="Open a blank editor and build your newsletter block by block."
            buttonLabel="Open blank editor"
            buttonVariant="outlined"
            icon={PenTool}
            onClick={() => navigate("/crm/campaigns/new?type=newsletter")}
          />

          <CreationPathCard
            order={{ xs: 1, md: 2 }}
            title="Pick an Idea"
            description="Get AI-generated newsletter concepts tailored to your business."
            buttonLabel="Explore AI ideas"
            buttonVariant="solid"
            chipLabel="AI-Powered"
            highlighted
            icon={Sparkles}
            onClick={() => setShowPicker(true)}
          />
        </Box>
      </Stack>

      <NewsletterPicker
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
      />
    </PageContainer>
  );
};
