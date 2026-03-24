import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface DocSection {
  id: string;
  title: string;
  group: string;
  content: ReactNode;
}

export interface DocField {
  name: string;
  description: ReactNode;
  required: boolean;
}

export interface DocBranding {
  logoSrc?: string;
  logoAlt?: string;
  icon: LucideIcon;
}

export interface DocContent {
  integrationName: string;
  integrationSlug: string;
  category: string;
  pageTitle: string;
  overview: string;
  readingTimeMinutes: number;
  lastUpdated: string;
  sections: DocSection[];
  branding: DocBranding;
}