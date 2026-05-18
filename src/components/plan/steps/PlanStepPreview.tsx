import React, { useMemo, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import Input from "@mui/joy/Input";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Snackbar from "@mui/joy/Snackbar";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { format } from "date-fns";
import { MediaSelectorImage } from "@/components/crm/MediaSelectorImage";
import { usePlanWizard } from "../PlanWizardContext";
import { PlanItem } from "../constants";
import {
  BlogPreviewCard,
  EmailPreviewCard,
  FacebookPreviewCard,
  InstagramPreviewCard,
  SMSPreviewCard,
} from "../preview-cards";
import { BlogContentViewer } from "../BlogContentViewer";

interface PlanStepPreviewProps {
  onNext: () => void;
  onBack: () => void;
}

const CHANNEL_LABELS: Record<PlanItem["type"], string> = {
  blog: "Blog",
  email: "Email",
  facebook: "Facebook",
  instagram: "Instagram",
  sms: "SMS",
};

const toDate = (date: Date | string) =>
  date instanceof Date ? date : new Date(date);

const parseDateInput = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const getSmsSegments = (message: string) =>
  Math.max(1, Math.ceil(message.length / 160));

const getImagePrompt = (item: PlanItem) =>
  item.imageQuery || item.imageIdea || item.caption || item.title;

const normalizeStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;

const normalizeImageMetadata = (
  metadata?: Record<string, unknown>,
): PlanItem["imageMetadata"] | undefined => {
  if (!metadata) return undefined;

  return {
    alt: typeof metadata.alt === "string" ? metadata.alt : undefined,
    photographer:
      typeof metadata.photographer === "string"
        ? metadata.photographer
        : undefined,
    photographer_url:
      typeof metadata.photographer_url === "string"
        ? metadata.photographer_url
        : undefined,
    source: typeof metadata.source === "string" ? metadata.source : undefined,
    unsplash_id:
      typeof metadata.unsplash_id === "string"
        ? metadata.unsplash_id
        : undefined,
    enhanced_query:
      typeof metadata.enhanced_query === "string"
        ? metadata.enhanced_query
        : undefined,
    globalImageId:
      typeof metadata.globalImageId === "string"
        ? metadata.globalImageId
        : undefined,
    tags: normalizeStringArray(metadata.tags),
    storagePath:
      typeof metadata.storagePath === "string"
        ? metadata.storagePath
        : undefined,
    generationTime:
      typeof metadata.generationTime === "number"
        ? metadata.generationTime
        : undefined,
    matchedTags: normalizeStringArray(metadata.matchedTags),
    matchScore:
      typeof metadata.matchScore === "number" ? metadata.matchScore : undefined,
  };
};

const getMediaSelectorContentType = (type: PlanItem["type"]) => {
  if (type === "facebook" || type === "instagram" || type === "blog") {
    return type;
  }

  return undefined;
};

export const PlanStepPreview: React.FC<PlanStepPreviewProps> = ({
  onBack,
  onNext,
}) => {
  const { state, updateItem } = usePlanWizard();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [imageItemId, setImageItemId] = useState<string | null>(null);
  const [blogViewerItem, setBlogViewerItem] = useState<PlanItem | null>(null);
  const [regenerateNoticeOpen, setRegenerateNoticeOpen] = useState(false);

  const enabledItems = useMemo(
    () =>
      state.items
        .filter((item) => item.enabled)
        .sort((a, b) => toDate(a.date).getTime() - toDate(b.date).getTime()),
    [state.items],
  );

  const editingItem = editingItemId
    ? state.items.find((item) => item.id === editingItemId) || null
    : null;
  const imageItem = imageItemId
    ? state.items.find((item) => item.id === imageItemId) || null
    : null;
  const monthName = state.month
    ? format(new Date(`${state.month}-01`), "MMMM yyyy")
    : "";

  const handleItemUpdate = <K extends keyof PlanItem>(
    id: string,
    field: K,
    value: PlanItem[K],
  ) => {
    updateItem(id, { [field]: value } as Pick<PlanItem, K>);
  };

  const handleImageSelected = (
    itemId: string,
    imageUrl: string,
    metadata?: Record<string, unknown>,
  ) => {
    updateItem(itemId, {
      imageUrl,
      imageMetadata: normalizeImageMetadata(metadata),
      imageGenerationStatus: "completed",
      imageError: null,
    });
    setImageItemId(null);
  };

  const handleRegenerate = () => {
    setRegenerateNoticeOpen(true);
  };

  const renderPreviewCard = (item: PlanItem) => {
    const commonProps = {
      item,
      onEdit: () => setEditingItemId(item.id),
      onRegenerate: handleRegenerate,
    };

    switch (item.type) {
      case "email":
        return (
          <EmailPreviewCard
            {...commonProps}
            onImageSelect={() => setImageItemId(item.id)}
          />
        );
      case "facebook":
        return (
          <FacebookPreviewCard
            {...commonProps}
            onImageSelect={() => setImageItemId(item.id)}
          />
        );
      case "instagram":
        return (
          <InstagramPreviewCard
            {...commonProps}
            onImageSelect={() => setImageItemId(item.id)}
          />
        );
      case "sms":
        return <SMSPreviewCard {...commonProps} />;
      case "blog":
        return (
          <BlogPreviewCard
            {...commonProps}
            onImageSelect={() => setImageItemId(item.id)}
            onReadMore={() => setBlogViewerItem(item)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Stack spacing={1} sx={{ textAlign: "center" }}>
        <Typography level="h3">Customize Your Content</Typography>
        <Typography
          color="neutral"
          level="body-md"
          sx={{ mx: "auto", maxWidth: 680 }}
        >
          Preview every enabled content piece for {monthName || "your plan"}.
          Fine-tune copy, choose final visuals, and confirm the channel
          experience before review.
        </Typography>
      </Stack>

      {enabledItems.length === 0 ? (
        <Alert color="neutral" variant="soft">
          No enabled content is available to preview. Return to the calendar
          step to enable items.
        </Alert>
      ) : (
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" },
          }}
        >
          {enabledItems.map((item) => (
            <Box key={item.id}>{renderPreviewCard(item)}</Box>
          ))}
        </Box>
      )}

      <Stack
        direction="row"
        justifyContent="space-between"
        spacing={1.5}
        sx={{ pt: 1 }}
      >
        <Button
          color="neutral"
          onClick={onBack}
          size="lg"
          startDecorator={<ArrowLeft aria-hidden="true" size={16} />}
          variant="outlined"
        >
          Back
        </Button>
        <Button
          color="primary"
          onClick={onNext}
          size="lg"
          endDecorator={<ArrowRight aria-hidden="true" size={16} />}
          variant="solid"
        >
          Continue to Review
        </Button>
      </Stack>

      <Modal open={Boolean(editingItem)} onClose={() => setEditingItemId(null)}>
        <ModalDialog sx={{ maxWidth: 720, width: "calc(100% - 32px)" }}>
          <ModalClose />
          {editingItem && (
            <Stack spacing={2.25}>
              <Stack spacing={0.5} sx={{ pr: 3 }}>
                <Typography level="title-lg">
                  Edit {CHANNEL_LABELS[editingItem.type]}
                </Typography>
                <Typography color="neutral" level="body-sm">
                  Changes apply immediately as you type. Save only closes this
                  dialog.
                </Typography>
              </Stack>

              {editingItem.type === "email" ? (
                <>
                  <FormControl>
                    <FormLabel>Subject</FormLabel>
                    <Input
                      value={editingItem.emailSubject || ""}
                      onChange={(event) =>
                        handleItemUpdate(
                          editingItem.id,
                          "emailSubject",
                          event.target.value,
                        )
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Preheader</FormLabel>
                    <Input
                      value={editingItem.emailPreheader || ""}
                      onChange={(event) =>
                        handleItemUpdate(
                          editingItem.id,
                          "emailPreheader",
                          event.target.value,
                        )
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Body</FormLabel>
                    <Textarea
                      minRows={6}
                      value={editingItem.caption}
                      onChange={(event) =>
                        handleItemUpdate(
                          editingItem.id,
                          "caption",
                          event.target.value,
                        )
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Date</FormLabel>
                    <Input
                      type="date"
                      value={format(toDate(editingItem.date), "yyyy-MM-dd")}
                      onChange={(event) =>
                        handleItemUpdate(
                          editingItem.id,
                          "date",
                          parseDateInput(event.target.value),
                        )
                      }
                      sx={{ maxWidth: 240 }}
                    />
                  </FormControl>
                </>
              ) : editingItem.type === "blog" ? (
                <>
                  <FormControl>
                    <FormLabel>Title</FormLabel>
                    <Input
                      value={editingItem.title}
                      onChange={(event) =>
                        handleItemUpdate(
                          editingItem.id,
                          "title",
                          event.target.value,
                        )
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Date</FormLabel>
                    <Input
                      type="date"
                      value={format(toDate(editingItem.date), "yyyy-MM-dd")}
                      onChange={(event) =>
                        handleItemUpdate(
                          editingItem.id,
                          "date",
                          parseDateInput(event.target.value),
                        )
                      }
                      sx={{ maxWidth: 240 }}
                    />
                  </FormControl>
                  <Button
                    color="neutral"
                    onClick={() => setBlogViewerItem(editingItem)}
                    size="sm"
                    startDecorator={<FileText aria-hidden="true" size={16} />}
                    variant="plain"
                  >
                    Open Full Blog Content
                  </Button>
                </>
              ) : editingItem.type === "sms" ? (
                <FormControl>
                  <FormLabel>Message body</FormLabel>
                  <Textarea
                    minRows={5}
                    value={editingItem.caption}
                    onChange={(event) =>
                      handleItemUpdate(
                        editingItem.id,
                        "caption",
                        event.target.value,
                      )
                    }
                  />
                  <Typography color="neutral" level="body-xs" sx={{ mt: 0.5 }}>
                    {editingItem.caption.length} characters -{" "}
                    {getSmsSegments(editingItem.caption)} segment
                    {getSmsSegments(editingItem.caption) === 1 ? "" : "s"}
                  </Typography>
                </FormControl>
              ) : (
                <>
                  <FormControl>
                    <FormLabel>Title</FormLabel>
                    <Input
                      value={editingItem.title}
                      onChange={(event) =>
                        handleItemUpdate(
                          editingItem.id,
                          "title",
                          event.target.value,
                        )
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Caption</FormLabel>
                    <Textarea
                      minRows={5}
                      value={editingItem.caption}
                      onChange={(event) =>
                        handleItemUpdate(
                          editingItem.id,
                          "caption",
                          event.target.value,
                        )
                      }
                    />
                    <Typography
                      color="neutral"
                      level="body-xs"
                      sx={{ mt: 0.5 }}
                    >
                      {editingItem.caption.length} characters
                    </Typography>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Date</FormLabel>
                    <Input
                      type="date"
                      value={format(toDate(editingItem.date), "yyyy-MM-dd")}
                      onChange={(event) =>
                        handleItemUpdate(
                          editingItem.id,
                          "date",
                          parseDateInput(event.target.value),
                        )
                      }
                      sx={{ maxWidth: 240 }}
                    />
                  </FormControl>
                </>
              )}

              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Button
                  color="neutral"
                  onClick={() => setEditingItemId(null)}
                  variant="plain"
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onClick={() => setEditingItemId(null)}
                  variant="solid"
                >
                  Save
                </Button>
              </Stack>
            </Stack>
          )}
        </ModalDialog>
      </Modal>

      <Modal open={Boolean(imageItem)} onClose={() => setImageItemId(null)}>
        <ModalDialog sx={{ maxWidth: 720, width: "calc(100% - 32px)" }}>
          <ModalClose />
          {imageItem && (
            <Stack spacing={2}>
              <Stack spacing={0.5} sx={{ pr: 3 }}>
                <Typography level="title-lg">{imageItem.title}</Typography>
                <Typography color="neutral" level="body-sm">
                  Select image for {CHANNEL_LABELS[imageItem.type]}
                </Typography>
              </Stack>
              <MediaSelectorImage
                contentContext={getImagePrompt(imageItem)}
                contentType={getMediaSelectorContentType(imageItem.type)}
                imageGenerationStatus={imageItem.imageGenerationStatus}
                onChange={(url, metadata) =>
                  handleImageSelected(imageItem.id, url, metadata)
                }
                src={imageItem.imageUrl}
              />
            </Stack>
          )}
        </ModalDialog>
      </Modal>

      <BlogContentViewer
        blogItem={blogViewerItem || undefined}
        onClose={() => setBlogViewerItem(null)}
        open={Boolean(blogViewerItem)}
      />

      <Snackbar
        anchorOrigin={{ horizontal: "center", vertical: "bottom" }}
        autoHideDuration={4000}
        color="neutral"
        onClose={() => setRegenerateNoticeOpen(false)}
        open={regenerateNoticeOpen}
        variant="soft"
      >
        Regeneration coming soon
      </Snackbar>
    </Stack>
  );
};
