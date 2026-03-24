import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

import { DocLogoTile } from "./DocLogoTile";
import type { DocBranding, DocSection } from "./types";

interface DocSidebarProps {
  integrationName: string;
  integrationSlug: string;
  sections: DocSection[];
  branding: DocBranding;
}

function scrollToSection(sectionId: string) {
  const target = document.getElementById(sectionId);
  if (!target) {
    return;
  }

  target.scrollIntoView({ behavior: "smooth", block: "start" });
  window.history.replaceState(null, "", `#${sectionId}`);
}

export function DocSidebar({
  integrationName,
  integrationSlug,
  sections,
  branding,
}: DocSidebarProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? "");

  const groups = useMemo(() => {
    return sections.reduce<Array<{ label: string; items: DocSection[] }>>(
      (acc, section) => {
        const existingGroup = acc.find(
          (group) => group.label === section.group,
        );
        if (existingGroup) {
          existingGroup.items.push(section);
          return acc;
        }

        acc.push({ label: section.group, items: [section] });
        return acc;
      },
      [],
    );
  }, [sections]);

  useEffect(() => {
    if (sections.length === 0) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setActiveSection(sections[0]?.id ?? "");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length === 0) {
          return;
        }

        visibleEntries.sort(
          (left, right) => right.intersectionRatio - left.intersectionRatio,
        );
        setActiveSection(visibleEntries[0].target.id);
      },
      {
        rootMargin: "-96px 0px -55% 0px",
        threshold: [0.1, 0.35, 0.6],
      },
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [sections]);

  return (
    <>
      <div className="min-[900px]:hidden">
        <div className="sticky top-4 z-10 mb-6 rounded-2xl border border-border/70 bg-white/95 p-3 shadow-sm shadow-brand-navy/5 backdrop-blur-sm">
          <div className="mb-3 flex items-center gap-2">
            <DocLogoTile
              name={integrationName}
              icon={branding.icon}
              logoSrc={branding.logoSrc}
              size="sm"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {integrationName}
              </p>
              <p className="text-xs text-muted-foreground">On this page</p>
            </div>
          </div>
          <NativeSelect
            aria-label="Documentation sections"
            value={activeSection}
            onChange={(event) => {
              const nextSection = event.target.value;
              setActiveSection(nextSection);
              scrollToSection(nextSection);
            }}
            className="h-10 rounded-xl border-gray-200 bg-white text-sm"
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <aside className="hidden min-[900px]:block">
        <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto pr-2">
          <Link
            to={`/integrations/${integrationSlug}`}
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            <span>Back to {integrationName}</span>
          </Link>

          <div className="mb-6 flex items-center gap-2">
            <DocLogoTile
              name={integrationName}
              icon={branding.icon}
              logoSrc={branding.logoSrc}
              size="sm"
            />
            <span className="text-sm font-semibold text-slate-900">
              {integrationName}
            </span>
          </div>

          <nav aria-label="Documentation table of contents">
            {groups.map((group) => (
              <div key={group.label}>
                <p className="mb-1 mt-5 px-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-1">
                  {group.items.map((section) => {
                    const isActive = activeSection === section.id;
                    return (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "block rounded-md px-2 py-1 text-sm transition-colors",
                          isActive
                            ? "bg-gray-100 font-medium text-foreground"
                            : "text-muted-foreground hover:bg-gray-50 hover:text-foreground",
                        )}
                        onClick={(event) => {
                          event.preventDefault();
                          setActiveSection(section.id);
                          scrollToSection(section.id);
                        }}
                      >
                        {section.title}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  );
}
