import React, { useEffect, useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowLeft, Check, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { PlanWizardProvider, usePlanWizard } from "./PlanWizardContext";
import { PlanStepTheme } from "./steps/PlanStepTheme";
import { PlanStepCalendar } from "./steps/PlanStepCalendar";
import { PlanStepPreview } from "./steps/PlanStepPreview";
import { PlanStepReview } from "./steps/PlanStepReview";
import { persistPlan } from "@/lib/plan/planPersist";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";

const steps = [
  { id: 1, title: "Pick Focus", description: "Choose theme & month" },
  { id: 2, title: "Generate Content", description: "Create marketing drafts" },
  { id: 3, title: "Customize", description: "Edit & refine content" },
  { id: 4, title: "Launch", description: "Schedule & activate" },
];

const StepRail = ({ currentStep }: { currentStep: number }) => (
  <Box
    sx={{
      overflowX: { xs: "auto", sm: "visible" },
      pb: 0.5,
      scrollbarWidth: "none",
      "&::-webkit-scrollbar": { display: "none" },
    }}
  >
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        width: "100%",
        maxWidth: 640,
        minWidth: { xs: 520, sm: 0 },
        mx: "auto",
      }}
    >
      {steps.map((step, index) => {
        const isActive = currentStep === step.id;
        const isComplete = currentStep > step.id;
        const connectorComplete = currentStep > step.id;

        return (
          <React.Fragment key={step.id}>
            <Box
              aria-current={isActive ? "step" : undefined}
              sx={{
                width: { xs: 92, sm: 136 },
                minWidth: { xs: 92, sm: 136 },
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: { xs: 28, sm: 32 },
                  height: { xs: 28, sm: 32 },
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor:
                    isActive || isComplete ? "primary.500" : "neutral.100",
                  color:
                    isActive || isComplete ? "common.white" : "neutral.400",
                  outline: isActive ? "2px solid" : "none",
                  outlineColor: isActive ? "primary.200" : undefined,
                  outlineOffset: isActive ? "2px" : undefined,
                  transition:
                    "background-color 180ms ease, color 180ms ease, outline-color 180ms ease",
                }}
              >
                {isComplete ? (
                  <Check aria-hidden="true" size={16} strokeWidth={2.4} />
                ) : (
                  <Typography
                    level={isActive ? "body-sm" : "body-xs"}
                    sx={{
                      color: "inherit",
                      fontSize: { xs: "0.75rem", sm: "0.875rem" },
                      fontWeight: isActive ? 700 : 500,
                      lineHeight: 1,
                    }}
                  >
                    {step.id}
                  </Typography>
                )}
              </Box>

              <Stack spacing={0.35} sx={{ mt: 1.25, px: { xs: 0.5, sm: 1 } }}>
                <Typography
                  level={isActive ? "body-sm" : "body-xs"}
                  noWrap
                  sx={{
                    color:
                      isComplete || isActive ? "text.primary" : "neutral.400",
                    fontSize: { xs: "0.75rem", sm: "0.875rem" },
                    fontWeight: isActive ? 700 : isComplete ? 600 : 500,
                    letterSpacing: "0.01em",
                    lineHeight: 1.25,
                  }}
                >
                  {step.title}
                </Typography>
                <Typography
                  level="body-xs"
                  noWrap
                  sx={{
                    display: { xs: "none", sm: "block" },
                    color: isActive
                      ? "primary.500"
                      : isComplete
                        ? "neutral.500"
                        : "neutral.300",
                    lineHeight: 1.35,
                  }}
                >
                  {step.description}
                </Typography>
              </Stack>
            </Box>

            {index < steps.length - 1 ? (
              <Box
                sx={{
                  flex: 1,
                  minWidth: { xs: 12, sm: 24 },
                  mx: { xs: 0.5, sm: 1.25 },
                  mt: { xs: "13px", sm: "15px" },
                }}
              >
                <Box
                  sx={{
                    width: "100%",
                    height: 2,
                    borderRadius: 999,
                    bgcolor: connectorComplete ? "primary.500" : "neutral.200",
                    transition: "background-color 180ms ease",
                  }}
                />
              </Box>
            ) : null}
          </React.Fragment>
        );
      })}
    </Box>
  </Box>
);

const PlanWizardContent: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isUrlStateReady, setIsUrlStateReady] = useState(false);
  const { state, reset, setMonth } = usePlanWizard();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (isUrlStateReady) {
      return;
    }

    const month = searchParams.get("month");
    const step = searchParams.get("step");

    if (step) {
      const stepNum = parseInt(step, 10);
      if (stepNum >= 1 && stepNum <= 4) {
        setCurrentStep(stepNum);
      }
    }

    if (month) {
      setMonth(month);
    }

    setIsUrlStateReady(true);
  }, [isUrlStateReady, searchParams, setMonth]);

  useEffect(() => {
    if (!isUrlStateReady) return;

    const params = new URLSearchParams(searchParams);

    if (state.month) {
      params.set("month", state.month);
    } else {
      params.delete("month");
    }

    if (state.themes.length > 0) {
      params.set("themes", state.themes.map((t) => t.id).join(","));
    } else {
      params.delete("themes");
    }

    params.set("step", currentStep.toString());

    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [
    currentStep,
    isUrlStateReady,
    searchParams,
    setSearchParams,
    state.month,
    state.themes,
  ]);

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLaunch = async () => {
    if (!state.themes.length || !state.month) {
      toast.error("Missing theme or month selection");
      return;
    }

    setIsLaunching(true);

    try {
      const result = await persistPlan(state);

      if (result.success) {
        const themesLabel = state.themes.map((t) => t.label).join(" + ");
        let successMsg = `Plan launched! Created ${result.created} items for ${themesLabel}`;
        if (result.skipped > 0) {
          successMsg += ` (${result.skipped} items skipped)`;
        }
        toast.success(successMsg);

        // Reset the wizard
        reset();

        // Navigate to calendar with launch success params
        const month = state.month
          ? format(new Date(state.month), "MMMM yyyy")
          : "Your plan";
        navigate(
          `/calendar?planLaunched=true&launchMonth=${encodeURIComponent(month)}&launchItems=${result.created}`,
        );
      } else {
        const errorMsg = result.error || "Failed to create plan items";
        toast.error(errorMsg);

        // Show details if available
        if (result.details && result.details.length > 0) {
        }
      }
    } catch (error) {
      console.error("Plan launch error:", error);
      toast.error("Unexpected error during launch");
    } finally {
      setIsLaunching(false);
    }
  };

  const handleStartOver = () => {
    reset();
    setCurrentStep(1);
    navigate("/plan");
  };

  return (
    <Sheet
      sx={{
        bgcolor: "background.surface",
        minHeight: "100%",
        px: { xs: 2, sm: 3 },
        py: { xs: 3, md: 4 },
      }}
    >
      <Box sx={{ maxWidth: 900, mx: "auto", width: "100%" }}>
        <Stack spacing={{ xs: 3, md: 4 }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            spacing={1}
          >
            <Button
              color="neutral"
              onClick={() => navigate("/dashboard")}
              size="sm"
              startDecorator={<ArrowLeft aria-hidden="true" size={16} />}
              variant="plain"
            >
              Back to Dashboard
            </Button>
            <Button
              color="neutral"
              onClick={handleStartOver}
              size="sm"
              startDecorator={<RotateCcw aria-hidden="true" size={16} />}
              variant="plain"
            >
              Start Over
            </Button>
          </Stack>

          <Stack spacing={1.5}>
            <StepRail currentStep={currentStep} />
            <Stack spacing={0.25} sx={{ px: 0.25 }}>
              <Typography level="title-md">
                {steps[currentStep - 1]?.title}
              </Typography>
              <Typography color="neutral" level="body-sm">
                {steps[currentStep - 1]?.description}
              </Typography>
            </Stack>
          </Stack>

          <Box>
            {currentStep === 1 && <PlanStepTheme onNext={handleNext} />}
            {currentStep === 2 && (
              <PlanStepCalendar onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 3 && (
              <PlanStepPreview onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 4 && (
              <PlanStepReview
                onBack={handleBack}
                onLaunch={handleLaunch}
                isLaunching={isLaunching}
              />
            )}
          </Box>
        </Stack>
      </Box>
    </Sheet>
  );
};

export const PlanWizard: React.FC = () => {
  return (
    <PlanWizardProvider>
      <PlanWizardContent />
    </PlanWizardProvider>
  );
};
