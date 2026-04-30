export type ActivityStatus =
  | "success"
  | "failed"
  | "pending"
  | "warning"
  | string;
export type ActivityActorType =
  | "user"
  | "automation"
  | "integration"
  | "system"
  | string;
export type ActivitySource = "ui" | "automation" | "webhook" | "sync" | string;

export type ActivityDescriptionPart =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string; target?: string }
  | { type: "mention"; label: string; href?: string }
  | { type: string; [key: string]: unknown };

export interface ActivityDescription {
  parts: ActivityDescriptionPart[];
  [key: string]: unknown;
}

export interface ActivityLink {
  type?: string;
  href?: string;
  label?: string;
  [key: string]: unknown;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  customer_id: string | null;
  actor_type: ActivityActorType;
  actor_id: string | null;
  source: ActivitySource;
  integration_name: string | null;
  activity_type: string;
  status: ActivityStatus;
  title: string;
  description: ActivityDescription;
  metadata: Record<string, unknown>;
  related_entities: Record<string, unknown>;
  links: ActivityLink[];
  error_message: string | null;
}

export interface ActivityFeedFilters {
  customerId?: string | null;
  search?: string;
  status?: string[];
  actorTypes?: string[];
  sources?: string[];
  integrationNames?: string[];
  activityTypes?: string[];
  start?: Date | null;
  end?: Date | null;
  segmentIds?: string[];
  personaIds?: string[];
}
