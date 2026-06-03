import React from "react";
import Button from "@mui/joy/Button";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { format } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";

interface PlanSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatLaunchMonth = (month: string | null) => {
  if (!month) return "your plan";

  const parsed = new Date(`${month}-01T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? month : format(parsed, "MMMM yyyy");
};

export const PlanSuccessModal: React.FC<PlanSuccessModalProps> = ({
  open,
  onOpenChange,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const planLaunched = searchParams.get("planLaunched") === "true";
  const month = formatLaunchMonth(searchParams.get("launchMonth"));
  const itemCount = searchParams.get("launchItems") || "0";
  const modalOpen = open || planLaunched;

  const clearLaunchParams = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("launchMonth");
    nextParams.delete("launchItems");
    nextParams.delete("planLaunched");
    setSearchParams(nextParams, { replace: true });
  };

  const handleClose = () => {
    clearLaunchParams();
    onOpenChange(false);
  };

  const handleViewCalendar = () => {
    onOpenChange(false);
    navigate("/calendar", { replace: true });
  };

  const handleCreateAnotherPlan = () => {
    onOpenChange(false);
    navigate("/plan", { replace: true });
  };

  return (
    <Modal open={modalOpen} onClose={handleClose}>
      <ModalDialog sx={{ maxWidth: 440, width: "calc(100% - 32px)" }}>
        <ModalClose />
        <Stack spacing={3} sx={{ pt: 1 }}>
          <Stack spacing={1} sx={{ pr: 3 }}>
            <Typography level="h3">{month} plan is ready</Typography>
            <Typography color="neutral" level="body-md">
              {itemCount} item{itemCount === "1" ? "" : "s"} have been scheduled
              on your calendar. You can review dates, edit copy, and adjust
              assets before anything is sent.
            </Typography>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
            <Button
              fullWidth
              onClick={handleViewCalendar}
              size="lg"
              variant="solid"
            >
              View Calendar
            </Button>
            <Button
              color="neutral"
              fullWidth
              onClick={handleCreateAnotherPlan}
              size="lg"
              variant="outlined"
            >
              Create Another Plan
            </Button>
          </Stack>
        </Stack>
      </ModalDialog>
    </Modal>
  );
};
