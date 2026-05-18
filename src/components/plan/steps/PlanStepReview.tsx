import React, { useMemo, useState } from "react";
import type { ElementType } from "react";
import Accordion from "@mui/joy/Accordion";
import AccordionDetails from "@mui/joy/AccordionDetails";
import AccordionGroup from "@mui/joy/AccordionGroup";
import AccordionSummary from "@mui/joy/AccordionSummary";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import Link from "@mui/joy/Link";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Facebook,
  FileText,
  Instagram,
  Mail,
  MessageSquare,
  Rocket,
} from "lucide-react";
import { format } from "date-fns";
import { Link as RouterLink } from "react-router-dom";
import { AudienceTargetingSection } from "../AudienceTargetingSection";
import { BlogContentViewer } from "../BlogContentViewer";
import { PlanItem } from "../constants";
import { usePlanWizard } from "../PlanWizardContext";
import { useTwilioSetup } from "@/components/dashboard/TwilioSetupChecker";
import { useSenderConfiguration } from "@/hooks/useSenderConfiguration";

interface PlanStepReviewProps {
  onBack: () => void;
  onLaunch: () => void;
  isLaunching?: boolean;
}

type ChannelKey = PlanItem["type"];

interface ChannelConfig {
  label: string;
  icon: ElementType;
  requiresImage: boolean;
}

const CHANNEL_ORDER: ChannelKey[] = [
  "email",
  "sms",
  "facebook",
  "instagram",
  "blog",
];

const CHANNEL_CONFIG: Record<ChannelKey, ChannelConfig> = {
  email: { label: "Email", icon: Mail, requiresImage: true },
  sms: { label: "SMS", icon: MessageSquare, requiresImage: false },
  facebook: { label: "Facebook", icon: Facebook, requiresImage: true },
  instagram: { label: "Instagram", icon: Instagram, requiresImage: true },
  blog: { label: "Blog", icon: FileText, requiresImage: true },
};

const toDate = (date: Date | string) =>
  date instanceof Date ? date : new Date(date);

const isValidDate = (date: Date) => !Number.isNaN(date.getTime());

const getMonthName = (month: string) => {
  if (!month) return "your plan";
  const parsed = new Date(`${month}-01T00:00:00`);
  return isValidDate(parsed) ? format(parsed, "MMMM yyyy") : month;
};

const getDateRangeLabel = (items: PlanItem[]) => {
  const dates = items
    .map((item) => toDate(item.date))
    .filter(isValidDate)
    .sort((first, second) => first.getTime() - second.getTime());

  if (!dates.length) return "No dates selected";

  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];

  if (firstDate.getTime() === lastDate.getTime()) {
    return format(firstDate, "MMM d, yyyy");
  }

  return `${format(firstDate, "MMM d")} - ${format(lastDate, "MMM d, yyyy")}`;
};

const sortByDate = (items: PlanItem[]) =>
  [...items].sort(
    (first, second) =>
      toDate(first.date).getTime() - toDate(second.date).getTime(),
  );

const getImageStatusLabel = (item: PlanItem) => {
  if (!CHANNEL_CONFIG[item.type].requiresImage) return "No image required";
  return item.imageUrl ? "Image ready" : "Image missing";
};

const ImageStatus = ({ item }: { item: PlanItem }) => {
  const imageReady =
    !CHANNEL_CONFIG[item.type].requiresImage || Boolean(item.imageUrl);

  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box
        sx={{
          color: imageReady ? "success.500" : "warning.500",
          display: "inline-flex",
          lineHeight: 0,
        }}
      >
        {imageReady ? (
          <Check aria-hidden="true" size={14} />
        ) : (
          <AlertCircle aria-hidden="true" size={14} />
        )}
      </Box>
      <Typography color="neutral" level="body-xs">
        {getImageStatusLabel(item)}
      </Typography>
    </Stack>
  );
};

export const PlanStepReview: React.FC<PlanStepReviewProps> = ({
  onBack,
  onLaunch,
  isLaunching = false,
}) => {
  const { state } = usePlanWizard();
  const { data: twilioData, isLoading: twilioLoading } = useTwilioSetup();
  const { senderConfig, loading: senderLoading } = useSenderConfiguration();
  const [blogViewerItem, setBlogViewerItem] = useState<PlanItem | null>(null);

  const enabledItems = useMemo(
    () => sortByDate(state.items.filter((item) => item.enabled)),
    [state.items],
  );

  const itemsByType = useMemo(
    () =>
      CHANNEL_ORDER.reduce(
        (channels, channel) => ({
          ...channels,
          [channel]: enabledItems.filter((item) => item.type === channel),
        }),
        {} as Record<ChannelKey, PlanItem[]>,
      ),
    [enabledItems],
  );

  const activeChannels = CHANNEL_ORDER.filter(
    (channel) => itemsByType[channel].length > 0,
  );
  const emailItems = itemsByType.email;
  const smsItems = itemsByType.sms;
  const imageEligibleItems = enabledItems.filter(
    (item) => CHANNEL_CONFIG[item.type].requiresImage,
  );
  const missingImageCount = imageEligibleItems.filter(
    (item) => !item.imageUrl,
  ).length;
  const isDomainVerified = senderConfig?.isVerified === true;
  const isTwilioConnected = twilioData?.isSetup === true;
  const showEmailWarning =
    emailItems.length > 0 && !senderLoading && !isDomainVerified;
  const showSmsWarning =
    smsItems.length > 0 && !twilioLoading && !isTwilioConnected;
  const hasAnyContent = enabledItems.length > 0;
  const launchDisabled = !hasAnyContent || isLaunching || missingImageCount > 0;
  const monthName = getMonthName(state.month);
  const dateRangeLabel = getDateRangeLabel(enabledItems);

  const launchHelper = (() => {
    if (!hasAnyContent)
      return "Enable at least one content item before launching.";
    if (missingImageCount > 0) {
      return `Resolve ${missingImageCount} missing image${missingImageCount === 1 ? "" : "s"} before launch.`;
    }
    if (isLaunching) return "Scheduling your plan on the calendar.";
    return `${enabledItems.length} item${enabledItems.length === 1 ? "" : "s"} will be scheduled on your calendar.`;
  })();

  return (
    <Stack spacing={{ xs: 3, md: 4 }}>
      <Stack spacing={1} sx={{ textAlign: "center" }}>
        <Typography level="h3">Review and Launch</Typography>
        <Typography
          color="neutral"
          level="body-md"
          sx={{ mx: "auto", maxWidth: 700 }}
        >
          Confirm the final channel mix, targeting, and readiness checks for{" "}
          {monthName}.
        </Typography>
      </Stack>

      <Card variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={2.5}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            justifyContent="space-between"
          >
            <Stack spacing={0.5}>
              <Typography level="title-md">Plan Overview</Typography>
              <Typography color="neutral" level="body-sm">
                A compact summary of what will move to the calendar.
              </Typography>
            </Stack>
            <Chip color="neutral" variant="soft">
              {monthName}
            </Chip>
          </Stack>

          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              },
            }}
          >
            <Sheet variant="outlined" sx={{ borderRadius: "md", p: 1.5 }}>
              <Typography color="neutral" level="body-xs">
                Active Content
              </Typography>
              <Typography level="title-lg">{enabledItems.length}</Typography>
            </Sheet>
            <Sheet variant="outlined" sx={{ borderRadius: "md", p: 1.5 }}>
              <Typography color="neutral" level="body-xs">
                Channels
              </Typography>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ flexWrap: "wrap", mt: 0.75 }}
                useFlexGap
              >
                {activeChannels.length ? (
                  activeChannels.map((channel) => (
                    <Chip
                      color="neutral"
                      key={channel}
                      size="sm"
                      variant="outlined"
                    >
                      {CHANNEL_CONFIG[channel].label}{" "}
                      {itemsByType[channel].length}
                    </Chip>
                  ))
                ) : (
                  <Typography color="neutral" level="body-sm">
                    No active channels
                  </Typography>
                )}
              </Stack>
            </Sheet>
            <Sheet variant="outlined" sx={{ borderRadius: "md", p: 1.5 }}>
              <Typography color="neutral" level="body-xs">
                Date Range
              </Typography>
              <Typography level="title-sm" sx={{ mt: 0.5 }}>
                {dateRangeLabel}
              </Typography>
            </Sheet>
            <Sheet variant="outlined" sx={{ borderRadius: "md", p: 1.5 }}>
              <Typography color="neutral" level="body-xs">
                Themes
              </Typography>
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ flexWrap: "wrap", mt: 0.75 }}
                useFlexGap
              >
                {state.themes.length ? (
                  state.themes.map((theme) => (
                    <Chip
                      color="neutral"
                      key={theme.id}
                      size="sm"
                      variant="soft"
                    >
                      {theme.label}
                    </Chip>
                  ))
                ) : (
                  <Typography color="neutral" level="body-sm">
                    No themes selected
                  </Typography>
                )}
              </Stack>
            </Sheet>
          </Box>
        </Stack>
      </Card>

      <AudienceTargetingSection />

      <Stack spacing={1.5}>
        {showEmailWarning && (
          <Alert
            color="warning"
            startDecorator={<AlertCircle aria-hidden="true" size={16} />}
            variant="soft"
          >
            <Stack spacing={0.5}>
              <Typography level="title-sm">
                Email sender needs verification
              </Typography>
              <Typography level="body-sm">
                Email items are included, but no verified sending domain is
                active. You can still review the plan, then finish setup in{" "}
                <Link component={RouterLink} to="/crm/settings/email-sending">
                  email settings
                </Link>
                .
              </Typography>
            </Stack>
          </Alert>
        )}

        {showSmsWarning && (
          <Alert
            color="warning"
            startDecorator={<AlertCircle aria-hidden="true" size={16} />}
            variant="soft"
          >
            <Stack spacing={0.5}>
              <Typography level="title-sm">
                SMS setup is not complete
              </Typography>
              <Typography level="body-sm">
                SMS items are included, but SMS sending is not configured. Open{" "}
                <Link component={RouterLink} to="/sms">
                  SMS settings
                </Link>{" "}
                before sending those campaigns.
              </Typography>
            </Stack>
          </Alert>
        )}

        {missingImageCount > 0 && (
          <Alert
            color="danger"
            startDecorator={<AlertCircle aria-hidden="true" size={16} />}
            variant="soft"
          >
            <Stack spacing={0.5}>
              <Typography level="title-sm">
                Launch blocked by missing images
              </Typography>
              <Typography level="body-sm">
                {missingImageCount} of {imageEligibleItems.length}{" "}
                image-required item
                {imageEligibleItems.length === 1 ? "" : "s"} still need an
                image. Launch is blocked until every email, blog, Facebook, and
                Instagram item has an image.
              </Typography>
            </Stack>
          </Alert>
        )}
      </Stack>

      <Stack spacing={1.5}>
        <Stack spacing={0.5}>
          <Typography level="title-lg">Channel Review</Typography>
          <Typography color="neutral" level="body-sm">
            Expand each active channel to inspect the scheduled content rows.
          </Typography>
        </Stack>

        {activeChannels.length ? (
          <AccordionGroup
            variant="outlined"
            sx={{
              borderRadius: "lg",
              overflow: "hidden",
              "--AccordionGroup-separator": "1px solid",
              "--AccordionDetails-paddingInline": "1rem",
            }}
          >
            {activeChannels.map((channel) => {
              const config = CHANNEL_CONFIG[channel];
              const Icon = config.icon;
              const channelItems = itemsByType[channel];

              return (
                <Accordion
                  defaultExpanded={channel === activeChannels[0]}
                  key={channel}
                >
                  <AccordionSummary>
                    <Stack
                      direction="row"
                      spacing={1.25}
                      alignItems="center"
                      sx={{ minWidth: 0, width: "100%" }}
                    >
                      <Icon aria-hidden="true" size={16} />
                      <Typography level="title-sm" sx={{ flex: 1 }}>
                        {config.label}
                      </Typography>
                      <Chip color="neutral" size="sm" variant="soft">
                        {channelItems.length}
                      </Chip>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.25} sx={{ py: 1 }}>
                      {channelItems.map((item) => {
                        const itemDate = toDate(item.date);
                        const dateLabel = isValidDate(itemDate)
                          ? format(itemDate, "MMM d, yyyy")
                          : "Unscheduled";

                        return (
                          <Sheet
                            key={item.id}
                            variant="outlined"
                            sx={{
                              borderRadius: "md",
                              p: 1.5,
                            }}
                          >
                            <Stack
                              direction={{ xs: "column", sm: "row" }}
                              spacing={1.5}
                              justifyContent="space-between"
                              alignItems={{ xs: "flex-start", sm: "center" }}
                            >
                              <Stack
                                direction="row"
                                spacing={1.25}
                                sx={{ minWidth: 0 }}
                              >
                                <Box
                                  aria-label="Active item"
                                  sx={{
                                    bgcolor: "success.500",
                                    borderRadius: "50%",
                                    flex: "0 0 auto",
                                    height: 8,
                                    mt: "0.45rem",
                                    width: 8,
                                  }}
                                />
                                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                                  <Typography
                                    level="title-sm"
                                    sx={{
                                      display: "-webkit-box",
                                      overflow: "hidden",
                                      WebkitBoxOrient: "vertical",
                                      WebkitLineClamp: 2,
                                    }}
                                  >
                                    {item.title}
                                  </Typography>
                                  <Typography color="neutral" level="body-xs">
                                    {dateLabel}
                                    {item.themeName
                                      ? ` · ${item.themeName}`
                                      : ""}
                                  </Typography>
                                </Stack>
                              </Stack>

                              <Stack
                                direction="row"
                                spacing={1.25}
                                alignItems="center"
                                sx={{ flexWrap: "wrap" }}
                                useFlexGap
                              >
                                <ImageStatus item={item} />
                                {item.type === "blog" &&
                                item.enhancedContent ? (
                                  <Button
                                    color="neutral"
                                    onClick={() => setBlogViewerItem(item)}
                                    size="sm"
                                    startDecorator={
                                      <FileText aria-hidden="true" size={14} />
                                    }
                                    variant="outlined"
                                  >
                                    View Blog
                                  </Button>
                                ) : null}
                              </Stack>
                            </Stack>
                          </Sheet>
                        );
                      })}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </AccordionGroup>
        ) : (
          <Alert color="neutral" variant="soft">
            No enabled content is available. Go back to the preview step to
            enable items before launch.
          </Alert>
        )}
      </Stack>

      <Card variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography level="title-lg">Launch Plan</Typography>
            <Typography color="neutral" level="body-sm">
              This schedules enabled content on your calendar. It does not send
              messages immediately.
            </Typography>
          </Stack>
          <Button
            color="primary"
            disabled={launchDisabled}
            fullWidth
            onClick={onLaunch}
            size="lg"
            startDecorator={
              isLaunching ? (
                <CircularProgress color="neutral" size="sm" />
              ) : (
                <Rocket aria-hidden="true" size={16} />
              )
            }
            variant="solid"
          >
            Launch Plan
          </Button>
          <Typography
            color={
              missingImageCount > 0 || !hasAnyContent ? "danger" : "neutral"
            }
            level="body-xs"
          >
            {launchHelper}
          </Typography>
        </Stack>
      </Card>

      <Divider />

      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
        <Button
          color="neutral"
          disabled={isLaunching}
          onClick={onBack}
          size="lg"
          startDecorator={<ArrowLeft aria-hidden="true" size={16} />}
          variant="outlined"
        >
          Back to Preview
        </Button>
      </Stack>

      <Modal
        open={Boolean(blogViewerItem)}
        onClose={() => setBlogViewerItem(null)}
      >
        <ModalDialog sx={{ maxWidth: 980, width: "calc(100% - 32px)" }}>
          <ModalClose />
          <Stack
            spacing={2}
            sx={{ maxHeight: "80vh", overflow: "auto", pr: { sm: 1 } }}
          >
            <Stack spacing={0.5} sx={{ pr: 3 }}>
              <Typography level="title-lg">Blog Content Preview</Typography>
              <Typography color="neutral" level="body-sm">
                Review the complete blog draft before launch.
              </Typography>
            </Stack>
            <BlogContentViewer blogItem={blogViewerItem} />
          </Stack>
        </ModalDialog>
      </Modal>
    </Stack>
  );
};
