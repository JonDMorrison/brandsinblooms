import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NewsletterLayoutPicker } from "../NewsletterLayoutPicker";
import { useNewsletterIdeas } from "@/hooks/useNewsletterIdeas";
import { NewsletterIdea } from "@/types/newsletter";
import { getCurrentWeekNumber } from "@/utils/dateUtils";
import { IdeaGrid } from "./IdeaGrid";
import { POPULAR_NEWSLETTER_PROMPTS } from "./newsletterPromptSuggestions";

interface NewsletterPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

type PickerStep = "ideas" | "layout";

const stepLabelSx = {
  fontSize: "0.925rem",
  transition: "color 0.15s ease, font-weight 0.15s ease",
} as const;

export const NewsletterPicker: React.FC<NewsletterPickerProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const { ideas, templates, loading, generateAIIdeas } = useNewsletterIdeas();

  const [currentStep, setCurrentStep] = useState<PickerStep>("ideas");
  const [selectedIdea, setSelectedIdea] = useState<NewsletterIdea | null>(null);
  const [selectedLayout, setSelectedLayout] = useState<
    "block-builder" | "simple-email" | null
  >(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);

  const currentWeekNumber = useMemo(() => getCurrentWeekNumber(), []);
  const currentWeekIdea = useMemo(
    () => ideas.find((idea) => idea.weekNumber === currentWeekNumber) ?? null,
    [currentWeekNumber, ideas],
  );

  const quickPromptSuggestions = POPULAR_NEWSLETTER_PROMPTS.slice(0, 4);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setCurrentStep("ideas");
    setSelectedLayout(null);
    setSelectedIdea(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || selectedIdea || !currentWeekIdea) {
      return;
    }

    setSelectedIdea(currentWeekIdea);
  }, [currentWeekIdea, isOpen, selectedIdea]);

  const handleSelectIdea = (idea: NewsletterIdea) => {
    setSelectedIdea(idea);
    setSelectedLayout(null);
    setCurrentStep("layout");
  };

  const handleGenerateAI = async (promptOverride?: string) => {
    const prompt = (promptOverride ?? aiPrompt).trim();
    if (!prompt) return;

    if (promptOverride) {
      setAiPrompt(promptOverride);
    }

    setGeneratingAI(true);
    try {
      await generateAIIdeas(prompt);
    } catch (error) {
      console.error("Failed to generate AI ideas:", error);
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleContinue = () => {
    if (!selectedIdea || !selectedLayout) return;

    const params = new URLSearchParams({
      type: "newsletter",
      flow: "template-picker",
      templateId: selectedIdea.id,
      layout: selectedLayout,
      source: "picker",
      title: selectedIdea.title,
      description: selectedIdea.description,
      category: selectedIdea.category,
    });

    navigate(`/crm/campaigns/new?${params.toString()}`);
    onClose();
  };

  const handleBack = () => {
    if (currentStep === "layout") {
      setCurrentStep("ideas");
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={() => onClose()}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: "rgba(0, 0, 0, 0.25)",
          },
        },
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 0, sm: 1.5 },
      }}
    >
      <ModalDialog
        className="bg-card"
        layout="center"
        sx={{
          width: { xs: "100vw", sm: "95vw", md: "90vw" },
          maxWidth: 900,
          height: { xs: "100dvh", md: "88vh" },
          maxHeight: { xs: "100dvh", md: "88vh" },
          borderRadius: { xs: 0, md: "xl" },
          borderColor: "neutral.200",
          backgroundColor: "background.surface",
          backgroundImage: "none",
          boxShadow: "0 24px 48px rgba(0, 0, 0, 0.12)",
          p: 0,
          overflow: "hidden",
        }}
      >
        <Stack sx={{ height: "100%" }}>
          <Stack
            direction="row"
            spacing={2}
            justifyContent="space-between"
            alignItems="flex-start"
            sx={{ px: 3, py: 2 }}
          >
            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
              <Typography level="title-lg" sx={{ fontWeight: 700 }}>
                Newsletter Idea Studio
              </Typography>
              <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                Curate an idea, pair it with a layout, then continue into the
                editor.
              </Typography>
            </Stack>

            <IconButton
              size="sm"
              variant="plain"
              color="neutral"
              onClick={() => onClose()}
              sx={{
                borderRadius: "999px",
                "&:hover": {
                  backgroundColor: "neutral.100",
                },
              }}
            >
              <X size={16} />
            </IconButton>
          </Stack>

          <Divider sx={{ borderColor: "neutral.100" }} />

          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{ px: 3, py: 1.5 }}
          >
            <Typography
              level="body-sm"
              sx={{
                ...stepLabelSx,
                color:
                  currentStep === "ideas" ? "text.primary" : "text.tertiary",
                fontWeight: currentStep === "ideas" ? 600 : 400,
              }}
            >
              {currentStep === "layout" ? "✓ Choose an Idea" : "Choose an Idea"}
            </Typography>

            <Typography level="body-sm" sx={{ color: "text.tertiary" }}>
              →
            </Typography>

            <Typography
              level="body-sm"
              sx={{
                ...stepLabelSx,
                color:
                  currentStep === "layout" ? "text.primary" : "text.tertiary",
                fontWeight: currentStep === "layout" ? 600 : 400,
              }}
            >
              Pick a Layout
            </Typography>
          </Stack>

          <Divider sx={{ borderColor: "neutral.100" }} />

          <Box
            key={currentStep}
            sx={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              animation: "newsletter-picker-fade 0.16s ease",
              "@keyframes newsletter-picker-fade": {
                from: { opacity: 0 },
                to: { opacity: 1 },
              },
            }}
          >
            {currentStep === "ideas" ? (
              <Stack sx={{ flex: 1, minHeight: 0 }}>
                <Stack
                  spacing={1.5}
                  sx={{ px: 3, pt: 2.5, pb: 2, bgcolor: "neutral.50" }}
                >
                  <Typography
                    level="body-sm"
                    sx={{ color: "text.secondary", fontWeight: 500 }}
                  >
                    What should this newsletter be about?
                  </Typography>

                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={1.5}
                    alignItems={{ xs: "stretch", md: "flex-start" }}
                  >
                    <Textarea
                      minRows={2}
                      maxRows={3}
                      value={aiPrompt}
                      onChange={(event) => setAiPrompt(event.target.value)}
                      placeholder="e.g. Spring gardening tips for beginners, a weekly product roundup, a behind-the-scenes look at our team..."
                      sx={{
                        flex: 1,
                        backgroundColor: "background.surface",
                        borderColor: "neutral.200",
                        boxShadow: "none",
                        "--Textarea-focusedHighlight": "rgba(0, 0, 0, 0)",
                        "--Textarea-focusedThickness": "1px",
                        "&:focus-within": {
                          borderColor: "neutral.400",
                          boxShadow: "none",
                        },
                        "& textarea::placeholder": {
                          color: "var(--joy-palette-text-tertiary)",
                        },
                      }}
                    />

                    <Button
                      size="sm"
                      variant="solid"
                      color="primary"
                      disabled={!aiPrompt.trim() || generatingAI}
                      loading={generatingAI}
                      startDecorator={
                        !generatingAI ? <Sparkles size={14} /> : undefined
                      }
                      onClick={() => handleGenerateAI()}
                      sx={{
                        minWidth: { xs: "100%", md: 120 },
                        alignSelf: { xs: "stretch", md: "center" },
                      }}
                    >
                      Generate
                    </Button>
                  </Stack>

                  <Stack
                    direction="row"
                    spacing={0.75}
                    useFlexGap
                    flexWrap="wrap"
                  >
                    {quickPromptSuggestions.map((prompt) => (
                      <Chip
                        key={prompt}
                        size="sm"
                        variant="outlined"
                        color="neutral"
                        onClick={() => setAiPrompt(prompt)}
                        sx={{
                          cursor: "pointer",
                          color: "text.secondary",
                          borderColor: "neutral.200",
                          backgroundColor: "transparent",
                          transition:
                            "background-color 0.15s ease, border-color 0.15s ease",
                          "&:hover": {
                            backgroundColor: "neutral.50",
                            borderColor: "neutral.300",
                          },
                        }}
                      >
                        {prompt}
                      </Chip>
                    ))}
                  </Stack>
                </Stack>

                <Divider sx={{ borderColor: "neutral.100" }} />

                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    px: 3,
                    py: 2,
                  }}
                >
                  <IdeaGrid
                    ideas={ideas}
                    currentWeekIdeaId={currentWeekIdea?.id ?? null}
                    onSelectIdea={handleSelectIdea}
                    onGenerateIdeas={handleGenerateAI}
                    loading={loading || generatingAI}
                    selectedIdeaId={selectedIdea?.id ?? null}
                  />
                </Box>
              </Stack>
            ) : selectedIdea ? (
              <Box sx={{ flex: 1, minHeight: 0, display: "flex" }}>
                <NewsletterLayoutPicker
                  ideaTitle={selectedIdea.title}
                  onBack={handleBack}
                  onChange={setSelectedLayout}
                  onContinue={handleContinue}
                  templates={templates}
                  value={selectedLayout}
                />
              </Box>
            ) : null}
          </Box>
        </Stack>
      </ModalDialog>
    </Modal>
  );
};
