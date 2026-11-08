import Chip from "@mui/joy/Chip";
import { Bot, Hand, Pause } from "lucide-react";
import { clientStatusOf, STATUS_LABEL, CLIENT_STATUS_LABEL, type ClientStatus, type SupportStatus, type TicketStatus } from "@/lib/bloomSupport/api";

type ChipColor = "neutral" | "primary" | "warning" | "danger" | "success";

const STATUS_COLOR: Record<SupportStatus, ChipColor> = {
  new: "primary",
  working: "neutral",
  waiting: "warning",
  // Calm desk: work that needs an admin is amber, never alarm red.
  needs_owner: "warning",
  resolved: "success",
};

const CLIENT_STATUS_COLOR: Record<ClientStatus, ChipColor> = {
  received: "primary",
  in_progress: "neutral",
  waiting_on_you: "warning",
  resolved: "success",
};

/**
 * Ticket status chip. `audience="client"` always renders the client four-state
 * label, so an internal routing state (e.g. needs_owner) never reaches a client
 * even if a raw status slips through.
 */
export function StatusChip({ status, audience = "staff" }: { status: TicketStatus; audience?: "staff" | "client" }) {
  if (audience === "client" || !(status in STATUS_COLOR)) {
    const c = clientStatusOf(status);
    return <Chip size="sm" variant="soft" color={CLIENT_STATUS_COLOR[c]}>{CLIENT_STATUS_LABEL[c]}</Chip>;
  }
  const s = status as SupportStatus;
  return <Chip size="sm" variant="soft" color={STATUS_COLOR[s]}>{STATUS_LABEL[s] ?? s}</Chip>;
}

/** Only urgent and high are worth a chip. Soft colours keep the desk calm. */
export function PriorityChip({ priority }: { priority: string }) {
  if (priority === "normal" || priority === "low") return null;
  return <Chip size="sm" variant="soft" color={priority === "urgent" ? "warning" : "neutral"}>{priority === "urgent" ? "Urgent" : "High priority"}</Chip>;
}

export function AutomationChip({ mode }: { mode: "auto" | "paused" | "human" }) {
  if (mode === "auto") return <Chip size="sm" variant="outlined" color="success" startDecorator={<Bot size={12} />}>Bloom active</Chip>;
  if (mode === "paused") return <Chip size="sm" variant="outlined" color="warning" startDecorator={<Pause size={12} />}>Bloom paused</Chip>;
  return <Chip size="sm" variant="outlined" color="neutral" startDecorator={<Hand size={12} />}>Human</Chip>;
}
