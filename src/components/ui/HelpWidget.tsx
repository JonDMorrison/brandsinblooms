import { useLayoutEffect, useRef, useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { BookOpen, LifeBuoy, MessageCircle, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReportProblemDialog } from "@/components/bloomSupport/ReportProblemDialog";
import { HELP_CENTRE_PATH } from "@/lib/bloomSupport/constants";

const PANEL_ID = "bloom-help-menu";

/**
 * A lightweight launcher for the same Bloom Support journey used everywhere
 * else. It intentionally contains no second form or legacy intake endpoint.
 */
export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const firstAction = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();

  useLayoutEffect(() => {
    if (open) firstAction.current?.focus();
  }, [open]);

  const closeMenu = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };

  return (
    <>
      <Box
        sx={{
          position: "fixed",
          right: { xs: 16, sm: 24 },
          bottom: { xs: 16, sm: 24 },
          zIndex: 1400,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 1.25,
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        {open && (
          <Sheet
            id={PANEL_ID}
            role="dialog"
            aria-modal="false"
            aria-labelledby="bloom-help-title"
            variant="outlined"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                closeMenu(true);
              }
            }}
            sx={{
              width: "min(360px, calc(100vw - 32px))",
              p: 2,
              borderRadius: "xl",
              boxShadow: "lg",
              bgcolor: "background.surface",
            }}
          >
            <Stack spacing={1.5}>
              <Box>
                <Typography id="bloom-help-title" level="title-lg">How can Bloom help?</Typography>
                <Typography level="body-sm" textColor="text.secondary">
                  Send one request, follow the conversation, or find a quick answer.
                </Typography>
              </Box>
              <Stack spacing={0.75}>
                <Button
                  ref={firstAction}
                  variant="soft"
                  color="primary"
                  startDecorator={<MessageCircle size={18} aria-hidden />}
                  onClick={() => {
                    closeMenu();
                    setReportOpen(true);
                  }}
                  sx={{ justifyContent: "flex-start", minHeight: 44 }}
                >
                  Start a support request
                </Button>
                <Button
                  variant="plain"
                  color="neutral"
                  startDecorator={<LifeBuoy size={18} aria-hidden />}
                  onClick={() => {
                    closeMenu();
                    navigate("/support");
                  }}
                  sx={{ justifyContent: "flex-start", minHeight: 44 }}
                >
                  Open Help &amp; Support
                </Button>
                <Button
                  variant="plain"
                  color="neutral"
                  startDecorator={<BookOpen size={18} aria-hidden />}
                  onClick={() => {
                    closeMenu();
                    navigate(HELP_CENTRE_PATH);
                  }}
                  sx={{ justifyContent: "flex-start", minHeight: 44 }}
                >
                  Browse the help centre
                </Button>
              </Stack>
            </Stack>
          </Sheet>
        )}

        <IconButton
          ref={trigger}
          color="primary"
          variant="solid"
          aria-label={open ? "Close help and support" : "Open help and support"}
          aria-expanded={open}
          aria-controls={open ? PANEL_ID : undefined}
          onClick={() => setOpen((value) => !value)}
          sx={{ width: 48, height: 48, borderRadius: "50%", boxShadow: "lg" }}
        >
          {open ? <X size={21} aria-hidden /> : <LifeBuoy size={21} aria-hidden />}
        </IconButton>
      </Box>
      <ReportProblemDialog open={reportOpen} onClose={() => setReportOpen(false)} />
    </>
  );
}
