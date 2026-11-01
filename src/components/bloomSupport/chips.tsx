import Chip from "@mui/joy/Chip";
import { Bot, Hand, Pause } from "lucide-react";
import { STATUS_LABEL, type SupportStatus } from "@/lib/bloomSupport/api";

const STATUS_COLOR: Record<SupportStatus, "neutral" | "primary" | "warning" | "danger" | "success"> = {
  new: "primary",
  working: "neutral",
  waiting: "warning",
  needs_owner: "danger",
  resolved: "success",
};

export function StatusChip({ status }: { status: SupportStatus }) {
  return <Chip size="sm" variant="soft" color={STATUS_COLOR[status]}>{STATUS_LABEL[status] ?? status}</Chip>;
}

export function PriorityChip({ priority }: { priority: string }) {
  if (priority === "normal" || priority === "low") return null;
  return <Chip size="sm" variant="solid" color={priority === "urgent" ? "danger" : "warning"}>{priority}</Chip>;
}

export function AutomationChip({ mode }: { mode: "auto" | "paused" | "human" }) {
  if (mode === "auto") return <Chip size="sm" variant="outlined" color="success" startDecorator={<Bot size={12} />}>Bloom active</Chip>;
  if (mode === "paused") return <Chip size="sm" variant="outlined" color="warning" startDecorator={<Pause size={12} />}>Bloom paused</Chip>;
  return <Chip size="sm" variant="outlined" color="neutral" startDecorator={<Hand size={12} />}>Human</Chip>;
}
