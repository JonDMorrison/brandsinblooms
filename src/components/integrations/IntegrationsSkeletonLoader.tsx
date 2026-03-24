import { cn } from "@/lib/utils";
import { INTEGRATION_CATEGORIES } from "@/components/integrations/integrationsHubConfig";

const SKELETON_CARD_COUNT = 8;
const TAB_WIDTHS = ["w-14", "w-24", "w-16", "w-20", "w-32", "w-24", "w-28"];

function SkeletonBlock({
  className,
  testId,
}: {
  className?: string;
  testId?: string;
}) {
  return (
    <div
      aria-hidden="true"
      data-testid={testId}
      className={cn("integrations-skeleton-block", className)}
    />
  );
}

function IntegrationSkeletonCard() {
  return (
    <article
      aria-hidden="true"
      data-testid="integration-skeleton-card"
      className="flex min-h-56 flex-col rounded-2xl border border-border/70 bg-card p-5 shadow-sm shadow-brand-navy/5"
    >
      <div className="mb-3 flex items-start justify-between gap-4">
        <SkeletonBlock className="h-12 w-12 rounded-xl border border-border/70" />
        <SkeletonBlock className="h-4 w-20 rounded-full" />
      </div>

      <div className="flex flex-1 flex-col">
        <SkeletonBlock className="mb-2 h-[18px] w-36 rounded-md" />
        <div className="mb-4 space-y-2">
          <SkeletonBlock className="h-3.5 w-full rounded-md" />
          <SkeletonBlock className="h-3.5 w-4/5 rounded-md" />
          <SkeletonBlock className="h-3.5 w-3/5 rounded-md" />
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/60 pt-3">
        <SkeletonBlock className="h-8 w-24 rounded-lg" />
        <SkeletonBlock className="h-8 w-[72px] rounded-md border border-border/80" />
      </div>
    </article>
  );
}

export function IntegrationsSkeletonLoader({
  canUseActions,
}: {
  canUseActions: boolean;
}) {
  const tabs = [{ value: "all", label: "All" }, ...INTEGRATION_CATEGORIES];

  return (
    <div
      className="container mx-auto space-y-7 p-6"
      aria-busy="true"
      data-testid="integrations-skeleton-loader"
    >
      <section className="space-y-5 rounded-[1.75rem] border border-border/70 bg-gradient-to-br from-white via-white to-brand-teal/5 p-5 shadow-sm shadow-brand-navy/5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-border/70 bg-white/90 px-4 py-2 shadow-sm shadow-brand-navy/5 backdrop-blur-sm">
              <SkeletonBlock className="h-4 w-20 rounded-full" />
              <SkeletonBlock className="h-3 w-3 rounded-full" />
              <SkeletonBlock className="h-4 w-24 rounded-full" />
            </div>

            <div className="space-y-2">
              <SkeletonBlock className="h-6 w-32 rounded-full" />
              <SkeletonBlock className="h-4 w-[280px] max-w-full rounded-full" />
            </div>
          </div>

          {canUseActions ? (
            <SkeletonBlock
              testId="integrations-skeleton-actions"
              className="h-10 w-24 self-start rounded-xl border border-border/80"
            />
          ) : null}
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            className="flex flex-wrap gap-2 border-b border-border/70 pb-2"
            aria-hidden="true"
          >
            {tabs.map((tab, index) => (
              <SkeletonBlock
                key={tab.value}
                className={cn("h-8 rounded-md", TAB_WIDTHS[index] ?? "w-24")}
              />
            ))}
          </div>

          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <SkeletonBlock className="h-10 w-full rounded-xl border border-border/80" />
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
          {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
            <IntegrationSkeletonCard key={index} />
          ))}
        </div>
      </section>
    </div>
  );
}
