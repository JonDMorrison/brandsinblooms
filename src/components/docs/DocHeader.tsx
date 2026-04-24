import { Badge } from "@/components/ui-legacy/badge";

import { DocLogoTile } from "./DocLogoTile";
import type { DocBranding } from "./types";

interface DocHeaderProps {
  integrationName: string;
  category: string;
  pageTitle: string;
  overview: string;
  lastUpdated: string;
  readingTimeMinutes: number;
  branding: DocBranding;
}

export function DocHeader({
  integrationName,
  category,
  pageTitle,
  overview,
  lastUpdated,
  readingTimeMinutes,
  branding,
}: DocHeaderProps) {
  return (
    <header className="mb-8 border-b border-gray-200 pb-8">
      <div className="mb-4 flex items-center gap-3">
        <DocLogoTile
          name={integrationName}
          icon={branding.icon}
          logoSrc={branding.logoSrc}
        />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">
            {integrationName}
          </p>
          <Badge
            variant="outline"
            className="w-fit border-slate-200 text-xs text-muted-foreground"
          >
            {category}
          </Badge>
        </div>
      </div>
      <h1 className="mb-4 text-4xl font-semibold tracking-tight text-slate-950">
        {pageTitle}
      </h1>
      <p className="max-w-3xl text-[15px] leading-7 text-muted-foreground">
        {overview}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>Last updated {lastUpdated}</span>
        <span className="text-border">&middot;</span>
        <span>Reading time: ~{readingTimeMinutes} min</span>
      </div>
    </header>
  );
}
