import * as React from "react";
import Badge from "@mui/joy/Badge";
import Box from "@mui/joy/Box";
import Drawer from "@mui/joy/Drawer";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import { AnimatePresence, motion } from "framer-motion";
import { RefreshCw, Sparkles } from "lucide-react";
import { AskBloomActionBar } from "@/components/askBloom/AskBloomActionBar";
import { AskBloomApprovalBar } from "@/components/askBloom/AskBloomApprovalBar";
import useMediaQuery from "@/hooks/use-media-query";
import { useAskBloom } from "@/providers/AskBloomProvider";
import { AskBloomConversationArea } from "@/components/askBloom/AskBloomConversationArea";
import { AskBloomHeader } from "@/components/askBloom/AskBloomHeader";
import AskBloomInput from "@/components/askBloom/AskBloomInput";
import { AskBloomResourceBanner } from "@/components/askBloom/AskBloomResourceBanner";

const DEFAULT_PANEL_WIDTH = 400;
const TABLET_PANEL_WIDTH = 400;

const panelSurfaceSx = {
  "--ask-bloom-floating-input-height": "0px",
  "--ask-bloom-floating-stack-height": "0px",
  position: "relative",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  bgcolor: "background.surface",
  backgroundImage:
    "radial-gradient(var(--joy-palette-neutral-300) 1px, transparent 1px)",
  backgroundSize: "10px 10px",
  backgroundPosition: "center",
} as const;

function AskBloomPanelBody() {
  const askBloom = useAskBloom();
  const bottomStackRef = React.useRef<HTMLDivElement | null>(null);
  const [showContextUpdated, setShowContextUpdated] = React.useState(false);

  React.useEffect(() => {
    const stack = bottomStackRef.current;
    if (!stack) {
      return undefined;
    }

    const panel = stack.closest("[data-ask-bloom-panel]");
    const panelElement = panel instanceof HTMLElement ? panel : null;

    const syncLayout = () => {
      panelElement?.style.setProperty(
        "--ask-bloom-floating-stack-height",
        `${Math.ceil(stack.getBoundingClientRect().height)}px`,
      );
    };

    syncLayout();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        panelElement?.style.removeProperty("--ask-bloom-floating-stack-height");
      };
    }

    const observer = new ResizeObserver(() => {
      syncLayout();
    });

    observer.observe(stack);
    return () => {
      observer.disconnect();
      panelElement?.style.removeProperty("--ask-bloom-floating-stack-height");
    };
  }, []);

  React.useEffect(() => {
    if (!askBloom.state.contextUpdatedToken) {
      return;
    }

    setShowContextUpdated(true);
    const timeoutId = window.setTimeout(() => {
      setShowContextUpdated(false);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [askBloom.state.contextUpdatedToken]);

  const shouldShowActionBar =
    Boolean(askBloom.state.resourceFocus) &&
    askBloom.state.messages.length < 3 &&
    !askBloom.state.isLoadingConversation &&
    !askBloom.state.isTransitioning &&
    !askBloom.state.isSendingMessage;

  return (
    <Sheet
      data-ask-bloom-panel
      variant="outlined"
      sx={{
        ...panelSurfaceSx,
        width: "100%",
        minWidth: 320,
        maxWidth: 600,
        borderLeft: "none",
        borderColor: "divider",
      }}
    >
      <AskBloomHeader />
      {askBloom.state.resourceFocus ? <AskBloomResourceBanner /> : null}
      <AnimatePresence initial={false}>
        {showContextUpdated ? (
          <Box
            component={motion.div}
            initial={{ height: 0, opacity: 0, y: -8 }}
            animate={{ height: 24, opacity: 1, y: 0 }}
            exit={{ height: 0, opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            sx={{
              px: 1.5,
              bgcolor: "primary.50",
              color: "primary.600",
              borderBottom: "1px solid",
              borderColor: "divider",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <Box
              sx={{
                height: 24,
                display: "flex",
                alignItems: "center",
                gap: 0.75,
              }}
            >
              <RefreshCw size={12} strokeWidth={1.8} />
              <Typography level="body-xs">Context updated</Typography>
            </Box>
          </Box>
        ) : null}
      </AnimatePresence>
      {shouldShowActionBar ? <AskBloomActionBar /> : null}
      <AskBloomConversationArea />
      <Box
        ref={bottomStackRef}
        sx={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          pointerEvents: "none",
        }}
      >
        <Box sx={{ pointerEvents: "auto" }}>
          <AskBloomApprovalBar />
        </Box>
        <Box
          sx={{
            pointerEvents: "auto",
            mx: 1.5,
            mb: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          <AskBloomInput />
        </Box>
      </Box>
    </Sheet>
  );
}

export function AskBloomPanel() {
  const askBloom = useAskBloom();
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const isTablet = useMediaQuery(
    "(min-width: 1024px) and (max-width: 1279.95px)",
  );
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeStateRef = React.useRef<{
    startX: number;
    startWidth: number;
  } | null>(null);

  React.useEffect(() => {
    if (!isResizing) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const nextWidth =
        resizeState.startWidth + (resizeState.startX - event.clientX);
      askBloom.setPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStateRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = previousUserSelect;
    };
  }, [askBloom, isResizing]);

  if (!askBloom.state.isOpen) {
    return null;
  }

  if (isDesktop && askBloom.state.isCollapsed) {
    const unreadCount = 0;

    return (
      <Sheet
        data-ask-bloom-panel
        variant="outlined"
        onClick={askBloom.toggleCollapse}
        sx={{
          width: 40,
          minWidth: 40,
          maxWidth: 40,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          borderLeft: "none",
          borderColor: "divider",
          bgcolor: "background.surface",
          flexShrink: 0,
        }}
      >
        <Badge
          badgeContent={unreadCount > 0 ? unreadCount : undefined}
          color="danger"
        >
          <Sparkles size={18} strokeWidth={1.5} />
        </Badge>
      </Sheet>
    );
  }

  if (isDesktop) {
    return (
      <Box
        sx={{
          position: "relative",
          width: askBloom.state.panelWidth,
          minWidth: askBloom.state.panelWidth,
          maxWidth: askBloom.state.panelWidth,
          height: "100%",
          flexShrink: 0,
        }}
      >
        <Box
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(event) => {
            resizeStateRef.current = {
              startX: event.clientX,
              startWidth: askBloom.state.panelWidth,
            };
            setIsResizing(true);
          }}
          onDoubleClick={() => askBloom.setPanelWidth(DEFAULT_PANEL_WIDTH)}
          sx={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: 6,
            cursor: "col-resize",
            zIndex: 2,
            "&::after": {
              content: '""',
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 2,
              width: 2,
              bgcolor: isResizing ? "primary.400" : "transparent",
              transition: "background-color 150ms ease",
            },
            "&:hover::after": {
              bgcolor: "primary.400",
            },
          }}
        />
        <AskBloomPanelBody />
      </Box>
    );
  }

  if (isTablet) {
    return (
      <Drawer
        anchor="right"
        open={askBloom.state.isOpen}
        onClose={askBloom.close}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: "rgba(15, 23, 42, 0.15)",
            },
          },
          content: {
            sx: {
              width: `${TABLET_PANEL_WIDTH}px`,
              maxWidth: "100vw",
              p: 0,
              bgcolor: "background.surface",
              overflow: "hidden",
            },
          },
        }}
      >
        <AskBloomPanelBody />
      </Drawer>
    );
  }

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--joy-zIndex-modal)",
        backgroundColor: "rgba(15, 23, 42, 0.15)",
      }}
      onClick={askBloom.close}
    >
      <Sheet
        variant="solid"
        onClick={(event) => event.stopPropagation()}
        sx={{
          ...panelSurfaceSx,
          position: "absolute",
          inset: 0,
          width: "100vw",
          maxWidth: "100vw",
          height: "100vh",
          borderRadius: 0,
          animation: "askBloomMobileSheetIn 220ms ease",
          "@keyframes askBloomMobileSheetIn": {
            from: {
              opacity: 0,
              transform: "translateY(24px)",
            },
            to: {
              opacity: 1,
              transform: "translateY(0)",
            },
          },
        }}
      >
        <AskBloomPanelBody />
      </Sheet>
    </Box>
  );
}
