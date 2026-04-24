import React, { useMemo, useState } from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Leaf,
  Mail,
  MessageSquare,
  ShoppingCart,
  TrendingUp,
  Users,
} from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDialog } from "@/components/joy/JoyDialog";
import { AudienceSelector } from "@/components/crm/AudienceSelector";

interface GuidedAutomationBuilderProps {
  onComplete: (automationConfig: any) => void;
  onBack: () => void;
}

const businessGoals = [
  {
    id: "welcome_new_customers",
    title: "Welcome New Customers",
    description: "Build confidence and loyalty with new plant parents.",
    icon: Users,
  },
  {
    id: "increase_sales",
    title: "Increase Sales",
    description: "Drive revenue with relevant offers and product reminders.",
    icon: ShoppingCart,
  },
  {
    id: "educate_customers",
    title: "Educate and Retain",
    description: "Share care tips and build long-term trust.",
    icon: Leaf,
  },
  {
    id: "win_back_customers",
    title: "Win Back Customers",
    description: "Re-engage customers who have gone quiet.",
    icon: TrendingUp,
  },
];

const triggers = {
  welcome_new_customers: [
    {
      id: "loyalty_join",
      label: "Customer joins loyalty",
      description: "Start a welcome series right after enrollment.",
    },
    {
      id: "first_purchase",
      label: "Customer makes first purchase",
      description: "Follow up after the first visit.",
    },
    {
      id: "form_submitted",
      label: "Customer submits a form",
      description: "Capture and nurture new leads immediately.",
    },
  ],
  increase_sales: [
    {
      id: "payment.completed",
      label: "Any purchase completed",
      description: "Promote complementary products after checkout.",
    },
    {
      id: "new_product_drop",
      label: "Scheduled launch date",
      description: "Announce launches to a saved audience.",
    },
    {
      id: "abandoned_cart",
      label: "Abandoned cart",
      description: "Recover shoppers before intent fades.",
    },
  ],
  educate_customers: [
    {
      id: "plant_care_reminder",
      label: "Plant care reminder",
      description: "Send seasonal care content automatically.",
    },
    {
      id: "birthday",
      label: "Birthday outreach",
      description: "Blend education and celebration in one flow.",
    },
    {
      id: "persona.assigned",
      label: "Persona assigned",
      description: "Adapt education tracks when persona fit changes.",
    },
  ],
  win_back_customers: [
    {
      id: "repeat_purchase_90d",
      label: "90-day purchase lapse",
      description: "Reconnect customers before they drift further.",
    },
    {
      id: "segment.added",
      label: "Added to segment",
      description:
        "Launch win-back content when a contact enters a lapsed segment.",
    },
    {
      id: "refund.created",
      label: "Refund processed",
      description: "Recover confidence after a service issue.",
    },
  ],
} as const;

const channelPreferences = [
  {
    id: "email_first",
    title: "Email first",
    description: "Lead with richer email content, then follow with SMS.",
    channels: ["email", "sms"],
    icon: Mail,
  },
  {
    id: "sms_first",
    title: "SMS first",
    description: "Open with quick action, then follow with email detail.",
    channels: ["sms", "email"],
    icon: MessageSquare,
  },
  {
    id: "email_only",
    title: "Email only",
    description: "Use a single rich email step.",
    channels: ["email"],
    icon: Mail,
  },
  {
    id: "sms_only",
    title: "SMS only",
    description: "Use a single fast SMS step.",
    channels: ["sms"],
    icon: MessageSquare,
  },
] as const;

export const GuidedAutomationBuilder: React.FC<
  GuidedAutomationBuilderProps
> = ({ onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedGoal, setSelectedGoal] = useState("");
  const [selectedTrigger, setSelectedTrigger] = useState("");
  const [selectedChannels, setSelectedChannels] = useState("");
  const [audienceType, setAudienceType] = useState<
    "everyone" | "persona" | "segment"
  >("everyone");
  const [selectedPersonas, setSelectedPersonas] = useState<any[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<any[]>([]);
  const [showAudienceSelector, setShowAudienceSelector] = useState(false);

  const currentGoal = businessGoals.find((goal) => goal.id === selectedGoal);
  const availableTriggers = selectedGoal
    ? triggers[selectedGoal as keyof typeof triggers]
    : [];
  const currentTrigger = availableTriggers.find(
    (trigger) => trigger.id === selectedTrigger,
  );
  const currentChannelPref = channelPreferences.find(
    (channel) => channel.id === selectedChannels,
  );

  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return Boolean(selectedGoal);
      case 2:
        return Boolean(selectedTrigger);
      case 3:
        return Boolean(selectedChannels);
      case 4:
        return (
          audienceType === "everyone" ||
          selectedPersonas.length > 0 ||
          selectedSegments.length > 0
        );
      default:
        return false;
    }
  }, [
    audienceType,
    currentStep,
    selectedChannels,
    selectedGoal,
    selectedPersonas.length,
    selectedSegments.length,
    selectedTrigger,
  ]);

  const generateAutomationStructure = () => {
    const baseFlow = {
      nodes: [
        {
          id: "trigger-1",
          type: "trigger",
          position: { x: 100, y: 50 },
          data: {
            triggerType: selectedTrigger,
            label: currentTrigger?.label || "Trigger",
          },
        },
      ],
      edges: [] as Array<{ id: string; source: string; target: string }>,
    };

    let lastNodeId = "trigger-1";
    let yPosition = 210;

    currentChannelPref?.channels.forEach((channel, index) => {
      const nodeId = `${channel}-${index + 1}`;
      baseFlow.nodes.push({
        id: nodeId,
        type: channel,
        position: { x: 100, y: yPosition },
        data:
          channel === "email"
            ? {
                subject: `${currentGoal?.title} follow-up`,
                content: `Hi {{first_name}}, here is the next step for ${currentGoal?.title.toLowerCase()}.`,
              }
            : {
                message: `Hi {{first_name}}, here is your next update from Brands in Blooms.`,
                content: `Hi {{first_name}}, here is your next update from Brands in Blooms.`,
              },
      });
      baseFlow.edges.push({
        id: `edge-${index + 1}`,
        source: lastNodeId,
        target: nodeId,
      });
      lastNodeId = nodeId;
      yPosition += 160;
    });

    return {
      name: `${currentGoal?.title} Automation`,
      description: `${currentGoal?.description} Triggered by ${currentTrigger?.label}.`,
      flow_data: baseFlow,
      goal: selectedGoal,
      trigger: selectedTrigger,
      channels: currentChannelPref?.channels || ["email"],
      audience: {
        type: audienceType,
        personas: selectedPersonas,
        segments: selectedSegments,
      },
    };
  };

  return (
    <Stack spacing={2.5}>
      <Sheet
        variant="outlined"
        sx={{ p: { xs: 2, md: 2.5 }, borderRadius: "xl" }}
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1.5}
            justifyContent="space-between"
          >
            <Box>
              <Typography level="h2">Build a guided automation</Typography>
              <Typography
                level="body-sm"
                sx={{ color: "neutral.600", mt: 0.5 }}
              >
                Choose a goal, trigger, channels, and audience. The canvas
                starter flow is generated from these inputs.
              </Typography>
            </Box>
            <JoyButton
              variant="outlined"
              color="neutral"
              startDecorator={<ArrowLeft size={16} />}
              onClick={onBack}
              sx={{ alignSelf: "flex-start" }}
            >
              Back to templates
            </JoyButton>
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {[1, 2, 3, 4].map((step) => (
              <Chip
                key={step}
                color={
                  step === currentStep
                    ? "primary"
                    : step < currentStep
                      ? "success"
                      : "neutral"
                }
                variant={step === currentStep ? "solid" : "soft"}
              >
                {step < currentStep ? <CheckCircle2 size={14} /> : step}
              </Chip>
            ))}
          </Stack>
        </Stack>
      </Sheet>

      <Sheet
        variant="outlined"
        sx={{ p: { xs: 2, md: 2.5 }, borderRadius: "xl" }}
      >
        {currentStep === 1 ? (
          <StepGrid
            title="Choose the goal"
            description="Pick the business outcome first so we can bias the starter flow in the right direction."
            items={businessGoals.map((goal) => ({
              id: goal.id,
              title: goal.title,
              description: goal.description,
              icon: goal.icon,
            }))}
            selectedId={selectedGoal}
            onSelect={(id) => {
              setSelectedGoal(id);
              setSelectedTrigger("");
            }}
          />
        ) : null}

        {currentStep === 2 ? (
          <StepGrid
            title="Choose the trigger"
            description="This decides what starts the automation."
            items={availableTriggers.map((trigger) => ({
              id: trigger.id,
              title: trigger.label,
              description: trigger.description,
              icon: ArrowRight,
            }))}
            selectedId={selectedTrigger}
            onSelect={setSelectedTrigger}
          />
        ) : null}

        {currentStep === 3 ? (
          <StepGrid
            title="Choose the communication pattern"
            description="The selected pattern creates the starter message nodes in the canvas."
            items={channelPreferences.map((channel) => ({
              id: channel.id,
              title: channel.title,
              description: channel.description,
              icon: channel.icon,
              meta: channel.channels.join(" → "),
            }))}
            selectedId={selectedChannels}
            onSelect={setSelectedChannels}
          />
        ) : null}

        {currentStep === 4 ? (
          <Stack spacing={2}>
            <Box>
              <Typography level="title-lg">Choose the audience</Typography>
              <Typography
                level="body-sm"
                sx={{ color: "neutral.600", mt: 0.5 }}
              >
                Use everyone or save persona and segment filters for the starter
                automation.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              {[
                {
                  id: "everyone",
                  title: "Everyone",
                  description: "No audience filters are saved.",
                },
                {
                  id: "persona",
                  title: "Persona-led",
                  description: "Select one or more personas.",
                },
                {
                  id: "segment",
                  title: "Segment-led",
                  description: "Select one or more CRM segments.",
                },
              ].map((option) => (
                <Sheet
                  key={option.id}
                  variant={audienceType === option.id ? "solid" : "outlined"}
                  color={audienceType === option.id ? "primary" : "neutral"}
                  sx={{
                    p: 1.5,
                    borderRadius: "lg",
                    flex: 1,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setAudienceType(
                      option.id as "everyone" | "persona" | "segment",
                    )
                  }
                >
                  <Typography level="title-sm">{option.title}</Typography>
                  <Typography
                    level="body-sm"
                    sx={{
                      mt: 0.5,
                      color:
                        audienceType === option.id
                          ? "common.white"
                          : "neutral.600",
                    }}
                  >
                    {option.description}
                  </Typography>
                </Sheet>
              ))}
            </Stack>
            {audienceType !== "everyone" ? (
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ p: 1.5, borderRadius: "lg" }}
              >
                <Stack
                  direction={{ xs: "column", md: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", md: "center" }}
                >
                  <Box>
                    <Typography level="title-sm">Saved filters</Typography>
                    <Typography
                      level="body-sm"
                      sx={{ color: "neutral.600", mt: 0.5 }}
                    >
                      {selectedPersonas.length} personas and{" "}
                      {selectedSegments.length} segments selected.
                    </Typography>
                  </Box>
                  <JoyButton
                    variant="outlined"
                    color="neutral"
                    onClick={() => setShowAudienceSelector(true)}
                  >
                    Configure audience
                  </JoyButton>
                </Stack>
              </Sheet>
            ) : null}
          </Stack>
        ) : null}
      </Sheet>

      <Sheet variant="soft" color="neutral" sx={{ p: 1.5, borderRadius: "xl" }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "center" }}
        >
          <Box>
            <Typography level="title-sm">Starter summary</Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600", mt: 0.5 }}>
              {currentGoal?.title || "Choose a goal"} •{" "}
              {currentTrigger?.label || "Choose a trigger"} •{" "}
              {currentChannelPref?.title || "Choose a channel pattern"}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <JoyButton
              variant="outlined"
              color="neutral"
              disabled={currentStep === 1}
              onClick={() => setCurrentStep((value) => Math.max(1, value - 1))}
            >
              Previous
            </JoyButton>
            {currentStep < 4 ? (
              <JoyButton
                endDecorator={<ArrowRight size={16} />}
                disabled={!canProceed}
                onClick={() =>
                  setCurrentStep((value) => Math.min(4, value + 1))
                }
              >
                Next
              </JoyButton>
            ) : (
              <JoyButton
                endDecorator={<ArrowRight size={16} />}
                disabled={!canProceed}
                onClick={() => onComplete(generateAutomationStructure())}
              >
                Open starter canvas
              </JoyButton>
            )}
          </Stack>
        </Stack>
      </Sheet>

      <JoyDialog
        open={showAudienceSelector}
        onClose={() => setShowAudienceSelector(false)}
        title="Configure starter audience"
        description="These selections are carried into the builder and saved with the automation."
        size="xl"
      >
        <AudienceSelector
          selectedPersonas={selectedPersonas}
          selectedSegments={selectedSegments}
          onPersonasChange={setSelectedPersonas}
          onSegmentsChange={setSelectedSegments}
          onClose={() => setShowAudienceSelector(false)}
          maxPersonas={3}
          maxSegments={5}
        />
      </JoyDialog>
    </Stack>
  );
};

interface StepGridItem {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  meta?: string;
}

function StepGrid({
  title,
  description,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  description: string;
  items: StepGridItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Stack spacing={2}>
      <Box>
        <Typography level="title-lg">{title}</Typography>
        <Typography level="body-sm" sx={{ color: "neutral.600", mt: 0.5 }}>
          {description}
        </Typography>
      </Box>
      <Stack spacing={1}>
        {items.map((item) => {
          const Icon = item.icon;
          const selected = item.id === selectedId;
          return (
            <Sheet
              key={item.id}
              variant={selected ? "solid" : "outlined"}
              color={selected ? "primary" : "neutral"}
              sx={{ p: 1.5, borderRadius: "lg", cursor: "pointer" }}
              onClick={() => onSelect(item.id)}
            >
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="flex-start"
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1.25} alignItems="flex-start">
                  <Avatar
                    variant={selected ? "soft" : "outlined"}
                    color={selected ? "primary" : "neutral"}
                  >
                    <Icon size={16} />
                  </Avatar>
                  <Box>
                    <Typography level="title-sm">{item.title}</Typography>
                    <Typography
                      level="body-sm"
                      sx={{
                        mt: 0.5,
                        color: selected ? "common.white" : "neutral.600",
                      }}
                    >
                      {item.description}
                    </Typography>
                  </Box>
                </Stack>
                {item.meta ? (
                  <Chip variant="soft" color={selected ? "primary" : "neutral"}>
                    {item.meta}
                  </Chip>
                ) : null}
              </Stack>
            </Sheet>
          );
        })}
      </Stack>
    </Stack>
  );
}
