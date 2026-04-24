import {
  Box,
  Button,
  CircularProgress,
  Modal,
  ModalDialog,
  Stack,
  Typography,
} from "@mui/joy";

type LightspeedOAuthStep = "preparing" | "redirecting" | "completing";

const stepMessages: Record<LightspeedOAuthStep, string> = {
  preparing: "Preparing your authorization request…",
  redirecting: "Redirecting to Lightspeed…",
  completing: "Completing connection…",
};

interface LightspeedOAuthOverlayProps {
  isVisible: boolean;
  step?: LightspeedOAuthStep;
  onCancel?: () => void;
}

export const LightspeedOAuthOverlay = ({
  isVisible,
  step = "preparing",
  onCancel,
}: LightspeedOAuthOverlayProps) => {
  const steps: LightspeedOAuthStep[] = ["preparing", "redirecting", "completing"];
  const currentIndex = steps.indexOf(step);

  return (
    <Modal open={isVisible} disablePortal={false}>
      <ModalDialog
        variant="plain"
        sx={{
          maxWidth: 360,
          borderRadius: "xl",
          bgcolor: "background.surface",
          textAlign: "center",
          p: 4,
          boxShadow: "lg",
        }}
      >
        <Stack spacing={3} alignItems="center">
          <CircularProgress size="lg" color="neutral" />

          <Box>
            <Typography level="title-md" fontWeight="xl" mb={0.5}>
              Connecting Lightspeed
            </Typography>
            <Typography level="body-sm" textColor="text.tertiary">
              {stepMessages[step]}
            </Typography>
          </Box>

          {/* Step dots */}
          <Stack direction="row" spacing={0.75} alignItems="center">
            {steps.map((s, idx) => (
              <Box
                key={s}
                sx={{
                  width: idx === currentIndex ? 20 : 8,
                  height: 8,
                  borderRadius: 20,
                  bgcolor:
                    idx <= currentIndex
                      ? "neutral.700"
                      : "neutral.300",
                  transition: "width 0.25s, background-color 0.25s",
                }}
              />
            ))}
          </Stack>

          {onCancel && (
            <Button
              variant="plain"
              color="neutral"
              size="sm"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
        </Stack>
      </ModalDialog>
    </Modal>
  );
};
