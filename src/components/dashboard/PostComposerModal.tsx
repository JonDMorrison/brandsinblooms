import { useEffect, useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { ChipProps } from "@mui/joy/Chip";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Search, Share2 } from "lucide-react";
import { postTemplates } from "@/lib/social/postTemplates";

interface PostComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ALL_CATEGORY = "All";
const DEFAULT_CATEGORY_ORDER = [
  "Educational",
  "Product",
  "Personal",
  "Promotion",
] as const;

const resolveCategoryChipColor = (category: string): ChipProps["color"] => {
  switch (category.toLowerCase()) {
    case "educational":
      return "primary";
    case "product":
      return "success";
    case "personal":
      return "warning";
    case "promotion":
      return "danger";
    default:
      return "neutral";
  }
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

export const PostComposerModal = ({
  isOpen,
  onClose,
}: PostComposerModalProps) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    setSearchQuery("");
    setSelectedCategory(ALL_CATEGORY);
  }, [isOpen]);

  const categoryFilters = useMemo(() => {
    const seenCategories = new Set(
      postTemplates
        .map((template) => template.category?.trim())
        .filter((category): category is string => Boolean(category)),
    );

    const trailingCategories = Array.from(seenCategories)
      .filter(
        (category) =>
          !DEFAULT_CATEGORY_ORDER.includes(
            category as (typeof DEFAULT_CATEGORY_ORDER)[number],
          ),
      )
      .sort((left, right) => left.localeCompare(right));

    return [ALL_CATEGORY, ...DEFAULT_CATEGORY_ORDER, ...trailingCategories];
  }, []);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);

    return postTemplates.filter((template) => {
      const matchesCategory =
        selectedCategory === ALL_CATEGORY ||
        template.category === selectedCategory;
      const matchesSearch =
        normalizedQuery.length === 0 ||
        normalizeSearchText(template.title).includes(normalizedQuery) ||
        normalizeSearchText(template.description).includes(normalizedQuery);

      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  const handleModalClose = () => {
    onClose();
  };

  // Tertiary action: blank composer (no template prefill). PublishPage reads
  // ?compose=blank and opens the composer drawer with an empty caption so the
  // user lands directly in the editor instead of on the list view.
  const handleStartBlank = () => {
    navigate("/publish?compose=blank");
    onClose();
  };

  // Primary action: a template card click navigates straight to the composer
  // with the template content prefilled (PublishPage reads ?template= and
  // creates a new content_tasks row from the matching template).
  const handleTemplateClick = (templateId: string) => {
    navigate(`/publish?template=${encodeURIComponent(templateId)}`);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleModalClose}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <ModalDialog
        variant="outlined"
        sx={{
          maxWidth: 680,
          width: "100%",
          maxHeight: "85vh",
          borderRadius: "xl",
          p: 0,
          overflow: "hidden",
          bgcolor: "background.surface",
          borderColor: "divider",
          boxShadow: "lg",
        }}
      >
        <ModalClose onClick={onClose} sx={{ top: 16, right: 16 }} />

        <Box sx={{ p: 3, pb: 2 }}>
          <Stack spacing={0.75} sx={{ pr: 5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Share2 size={20} />
              <Typography level="title-lg" sx={{ fontWeight: "lg" }}>
                Create Social Post
              </Typography>
            </Stack>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              Choose a template to get started
            </Typography>
          </Stack>
        </Box>

        <Box sx={{ px: 3, pb: 3, overflowY: "auto" }}>
          <Stack spacing={2}>
            <Input
              placeholder="Search templates..."
              startDecorator={<Search size={16} />}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              variant="soft"
              size="sm"
              sx={{ borderRadius: "md" }}
            />

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              {categoryFilters.map((category) => {
                const isActive = selectedCategory === category;

                return (
                  <Chip
                    key={category}
                    component="button"
                    type="button"
                    variant={isActive ? "solid" : "soft"}
                    color={isActive ? "primary" : "neutral"}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    sx={{
                      borderRadius: "md",
                      cursor: "pointer",
                    }}
                  >
                    {category}
                  </Chip>
                );
              })}
            </Box>

            {filteredTemplates.length === 0 ? (
              <Box
                sx={{
                  py: 6,
                  textAlign: "center",
                  borderRadius: "lg",
                  border: "1px dashed",
                  borderColor: "divider",
                  bgcolor: "background.level1",
                }}
              >
                <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                  No templates match your search.
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
                  gap: 2,
                }}
              >
                {filteredTemplates.map((template) => (
                  <Card
                    key={template.id}
                    component="button"
                    type="button"
                    variant="outlined"
                    onClick={() => handleTemplateClick(template.id)}
                    sx={{
                      cursor: "pointer",
                      borderRadius: "lg",
                      p: 2.5,
                      transition: "all 0.2s ease",
                      textAlign: "left",
                      bgcolor: "background.surface",
                      borderColor: "divider",
                      "&:hover": {
                        borderColor: "primary.300",
                        boxShadow: "sm",
                        bgcolor: "background.level1",
                      },
                      "&:focus-visible": {
                        outline:
                          "2px solid rgba(var(--joy-palette-primary-mainChannel) / 0.35)",
                        outlineOffset: 2,
                      },
                    }}
                  >
                    <Stack spacing={2} sx={{ height: "100%" }}>
                      <Stack spacing={0.75}>
                        <Typography level="title-sm" sx={{ fontWeight: "lg" }}>
                          {template.title}
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "text.secondary" }}
                        >
                          {template.description}
                        </Typography>
                      </Stack>

                      <Typography
                        level="body-xs"
                        sx={{
                          mt: 1.5,
                          fontStyle: "italic",
                          p: 1.5,
                          bgcolor: "background.level1",
                          borderRadius: "sm",
                          borderLeft: "3px solid",
                          borderColor: "primary.200",
                          color: "text.tertiary",
                          lineHeight: 1.6,
                          flex: 1,
                        }}
                      >
                        {`"${template.content}"`}
                      </Typography>

                      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <Chip
                          variant="soft"
                          size="sm"
                          color={resolveCategoryChipColor(template.category)}
                        >
                          {template.category}
                        </Chip>
                      </Box>
                    </Stack>
                  </Card>
                ))}
              </Box>
            )}
          </Stack>
        </Box>

        <Box
          sx={{
            p: 3,
            pt: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Button variant="plain" color="neutral" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="solid"
            color="primary"
            size="sm"
            endDecorator={<ArrowRight size={14} />}
            onClick={handleStartBlank}
          >
            Start Blank
          </Button>
        </Box>
      </ModalDialog>
    </Modal>
  );
};
