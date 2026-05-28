import * as React from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Popover from "@mui/material/Popover";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Keyboard,
  Layers,
  Mail,
  Menu,
  Package,
  Users,
  X,
} from "lucide-react";
import { BloomAvatar } from "@/components/bloom/BloomAvatar";
import { useBloom } from "@/components/bloom/BloomContext";
import { useBloomReducedMotion } from "@/components/bloom/BloomMotionContext";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyTooltip } from "@/components/joy/JoyTooltip";

interface BloomHeaderProps {
  onDismissEntityContextBadge: () => void;
  onDismissPageContextBadge: () => void;
  showEntityContextBadge: boolean;
  showPageContextBadge: boolean;
  showSidebarButton: boolean;
  onOpenSidebar: () => void;
}

const viewingEntityMeta = {
  campaign: { Icon: Mail, label: "Campaign" },
  customer: { Icon: Users, label: "Customer" },
  product: { Icon: Package, label: "Product" },
  segment: { Icon: Layers, label: "Segment" },
} as const;

export function BloomHeader({
  onDismissEntityContextBadge,
  onDismissPageContextBadge,
  onOpenSidebar,
  showEntityContextBadge,
  showPageContextBadge,
  showSidebarButton,
}: BloomHeaderProps) {
  const reducedMotion = useBloomReducedMotion();
  const {
    activeConversationId,
    conversations,
    entitySummary,
    openShortcutsPanel,
    pageContext,
  } = useBloom();
  const [entityPopoverAnchor, setEntityPopoverAnchor] =
    React.useState<HTMLElement | null>(null);
  const activeConversation = conversations.find(
    (conversation) => conversation.id === activeConversationId,
  );
  const title = activeConversation?.title || "Bloom";
  const entityMeta = entitySummary
    ? viewingEntityMeta[entitySummary.entityType]
    : null;
  const pageContextBadge =
    showPageContextBadge && pageContext ? (
      <JoyChip
        aria-label={`Dismiss page context from ${pageContext.pageName}`}
        size="sm"
        variant="soft"
        color="neutral"
        onClick={onDismissPageContextBadge}
        endDecorator={<X size={12} strokeWidth={2} aria-hidden="true" />}
        sx={{
          maxWidth: { xs: 180, sm: 260, md: 320 },
          color: "neutral.700",
          backgroundColor: "background.level1",
          border: "1px solid",
          borderColor: "neutral.200",
          cursor: "pointer",
          "&:hover": {
            backgroundColor: "background.level1",
            borderColor: "neutral.300",
          },
        }}
      >
        <Typography level="body-xs" noWrap sx={{ color: "inherit" }}>
          From: {pageContext.pageName}
        </Typography>
      </JoyChip>
    ) : null;
  const entityContextBadge =
    showEntityContextBadge && entitySummary && entityMeta ? (
      <JoyChip
        aria-expanded={Boolean(entityPopoverAnchor)}
        aria-haspopup="dialog"
        color="primary"
        size="sm"
        variant="soft"
        startDecorator={
          <entityMeta.Icon size={12} strokeWidth={1.9} aria-hidden="true" />
        }
        endDecorator={
          <ChevronDown size={12} strokeWidth={2} aria-hidden="true" />
        }
        onClick={(event) => setEntityPopoverAnchor(event.currentTarget)}
        sx={{
          maxWidth: { xs: 220, sm: 280, md: 340 },
          color: "primary.700",
          backgroundColor: "primary.softBg",
          border: "1px solid",
          borderColor: "primary.200",
          cursor: "pointer",
          "&:hover": {
            backgroundColor: "primary.softHoverBg",
            borderColor: "primary.300",
          },
        }}
      >
        <Typography level="body-xs" noWrap sx={{ color: "inherit" }}>
          Viewing: {entitySummary.name}
        </Typography>
      </JoyChip>
    ) : null;

  React.useEffect(() => {
    if (!showEntityContextBadge) {
      setEntityPopoverAnchor(null);
    }
  }, [showEntityContextBadge]);

  return (
    <Sheet
      variant="plain"
      sx={{
        minHeight: 56,
        px: { xs: 1.5, md: 2 },
        borderBottom: "1px solid",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2,
        flexShrink: 0,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ minWidth: 0 }}
      >
        {showSidebarButton ? (
          <IconButton
            aria-label="Open Bloom conversations"
            color="neutral"
            size="sm"
            variant="plain"
            onClick={onOpenSidebar}
          >
            <Menu size={18} strokeWidth={1.9} />
          </IconButton>
        ) : null}
        <BloomAvatar size="sm" />
        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
          <Typography
            level="title-sm"
            noWrap
            sx={{
              color: "neutral.900",
              maxWidth: { xs: 150, sm: 280, md: 420 },
              minWidth: 0,
            }}
          >
            {title}
          </Typography>
          <Stack
            direction="row"
            spacing={0.75}
            sx={{ minWidth: 0, flexWrap: "wrap" }}
          >
            {reducedMotion ? (
              <>
                {pageContextBadge ? (
                  <Box sx={{ display: "inline-flex", maxWidth: "100%" }}>
                    {pageContextBadge}
                  </Box>
                ) : null}
                {entityContextBadge ? (
                  <Box sx={{ display: "inline-flex", maxWidth: "100%" }}>
                    {entityContextBadge}
                  </Box>
                ) : null}
              </>
            ) : (
              <AnimatePresence initial={false}>
                {pageContextBadge ? (
                  <motion.div
                    key={pageContext?.pathname}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{ display: "inline-flex", maxWidth: "100%" }}
                  >
                    {pageContextBadge}
                  </motion.div>
                ) : null}
                {entityContextBadge ? (
                  <motion.div
                    key={
                      entitySummary
                        ? `${entitySummary.entityType}:${entitySummary.entityId}`
                        : "entity-context"
                    }
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    style={{ display: "inline-flex", maxWidth: "100%" }}
                  >
                    {entityContextBadge}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            )}
          </Stack>
        </Stack>
      </Stack>

      {showEntityContextBadge && entitySummary && entityMeta ? (
        <Popover
          open={Boolean(entityPopoverAnchor)}
          anchorEl={entityPopoverAnchor}
          onClose={() => setEntityPopoverAnchor(null)}
          anchorOrigin={{
            vertical: "bottom",
            horizontal: "left",
          }}
          transformOrigin={{
            vertical: "top",
            horizontal: "left",
          }}
          slotProps={{
            paper: {
              sx: {
                mt: 0.75,
                backgroundColor: "transparent",
                backgroundImage: "none",
                boxShadow: "none",
                overflow: "visible",
              },
            },
          }}
        >
          <Card
            variant="outlined"
            sx={{
              width: { xs: 280, sm: 320 },
              p: 2,
              borderColor: "neutral.200",
              backgroundColor: "background.surface",
              boxShadow: "var(--joy-shadow-lg)",
            }}
          >
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Box
                      aria-hidden="true"
                      sx={{ display: "inline-flex", color: "primary.600" }}
                    >
                      <entityMeta.Icon size={15} strokeWidth={1.9} />
                    </Box>
                    <Typography level="title-sm" sx={{ color: "neutral.900" }}>
                      {entitySummary.name}
                    </Typography>
                  </Stack>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {entityMeta.label} ID: {entitySummary.entityId}
                  </Typography>
                </Stack>
                <IconButton
                  aria-label="Dismiss viewing badge"
                  color="neutral"
                  size="sm"
                  variant="plain"
                  onClick={() => {
                    setEntityPopoverAnchor(null);
                    onDismissEntityContextBadge();
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </IconButton>
              </Stack>
              <Typography
                level="body-sm"
                sx={{ color: "neutral.600", lineHeight: 1.5 }}
              >
                {entitySummary.summaryText}
              </Typography>
              {entitySummary.detailItems.length > 0 ? (
                <Stack spacing={0.75}>
                  {entitySummary.detailItems.map((detail) => (
                    <Stack
                      key={detail.label}
                      direction="row"
                      spacing={2}
                      justifyContent="space-between"
                      sx={{ minWidth: 0 }}
                    >
                      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                        {detail.label}
                      </Typography>
                      <Typography
                        level="body-xs"
                        sx={{
                          color: "neutral.800",
                          fontWeight: "var(--joy-fontWeight-medium)",
                          textAlign: "right",
                        }}
                      >
                        {detail.value}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Card>
        </Popover>
      ) : null}

      <Stack
        direction="row"
        spacing={1}
        alignItems="center"
        sx={{ flexShrink: 0 }}
      >
        <JoyTooltip title="Keyboard shortcuts">
          <Box sx={{ display: "inline-flex" }}>
            <IconButton
              aria-label="Keyboard shortcuts"
              color="neutral"
              size="sm"
              variant="plain"
              onClick={openShortcutsPanel}
            >
              <Keyboard size={16} strokeWidth={1.9} />
            </IconButton>
          </Box>
        </JoyTooltip>
      </Stack>
    </Sheet>
  );
}
