import React from "react";
import { ContentBlock } from "@/types/emailBuilder";
import {
  Newspaper,
  Sun,
  Gift,
  CalendarDays,
  Sprout,
  LayoutTemplate,
} from "lucide-react";

interface StructurePickerProps {
  gardenCenterName: string;
  primaryColor: string;
  weeklyThemeTitle?: string;
  onSelect: (
    blocks: ContentBlock[],
    campaignName?: string,
    subjectLine?: string,
  ) => void;
}

interface StructureOption {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  campaignName: string;
  subjectLine: string;
  blocks: () => ContentBlock[];
}

let blockCounter = 0;
function makeId() {
  return `struct_${Date.now()}_${++blockCounter}`;
}

function buildOptions(
  name: string,
  color: string,
): StructureOption[] {
  return [
    {
      id: "weekly-newsletter",
      title: "Weekly Newsletter",
      description: "Hero, story with photo, tips list, and CTA",
      icon: <Newspaper className="h-5 w-5" />,
      campaignName: `This Week at ${name}`,
      subjectLine: `This Week at ${name}`,
      blocks: () => [
        {
          id: makeId(), type: "email-safe-hero", layout: "full-width",
          headline: `This Week at ${name}`,
          subtitle: "What's new, what's blooming, and what to do this week.",
          body: "", content: "", title: "", imageUrl: "", ctaText: "", ctaUrl: "",
          source: "manual", visible: true, collapsed: false,
          backgroundColor: "#f5f5f7", textColor: "#111111",
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        },
        {
          id: makeId(), type: "image-text", layout: "two-column-left",
          headline: "The Story This Week",
          body: "Write a short paragraph about what's happening at your garden center this week. A new shipment, a staff pick, or a customer success story.",
          content: "", title: "", imageUrl: "", ctaText: "", ctaUrl: "",
          source: "manual", visible: true, collapsed: false,
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        },
        {
          id: makeId(), type: "image-text", layout: "full-width",
          headline: "Quick Tips",
          body: "1. Tip one — a short, actionable gardening tip.\n2. Tip two — something seasonal and relevant.\n3. Tip three — a product recommendation or care reminder.",
          content: "", title: "", imageUrl: "", ctaText: "", ctaUrl: "",
          source: "manual", visible: true, collapsed: false,
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        },
        {
          id: makeId(), type: "button", layout: "full-width",
          headline: "", body: "", content: "", title: "", imageUrl: "",
          buttonText: "Visit Us This Weekend", buttonUrl: "",
          ctaText: "Visit Us This Weekend", ctaUrl: "",
          buttonColor: color, alignment: "center",
          source: "manual", visible: true, collapsed: false,
        },
      ],
    },
    {
      id: "seasonal-announcement",
      title: "Seasonal Announcement",
      description: "Banner, announcement body, hero photo, CTA",
      icon: <Sun className="h-5 w-5" />,
      campaignName: "Spring Has Arrived",
      subjectLine: `Spring Has Arrived at ${name}`,
      blocks: () => [
        {
          id: makeId(), type: "newsletter-header", layout: "full-width",
          title: "Spring Has Arrived", subtitle: `${name} is ready for the season.`,
          headline: "Spring Has Arrived", body: "",
          content: "", imageUrl: "", ctaText: "", ctaUrl: "",
          publishDate: new Date().toLocaleDateString(),
          backgroundImageUrl: "", alignment: "center", padding: "large",
          source: "manual", visible: true, collapsed: false,
        },
        {
          id: makeId(), type: "image-text", layout: "full-width",
          headline: "", body: "We've been preparing all winter, and we're excited to share what's new this season. From fresh arrivals to returning favourites, there's something for every garden.",
          content: "", title: "", imageUrl: "", ctaText: "", ctaUrl: "",
          source: "manual", visible: true, collapsed: false,
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        },
        {
          id: makeId(), type: "image", layout: "full-width",
          title: "", content: "", headline: "", body: "",
          imageUrl: "", altText: "Seasonal hero photo",
          ctaText: "", ctaUrl: "", alignment: "center",
          source: "manual", visible: true, collapsed: false,
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        },
        {
          id: makeId(), type: "button", layout: "full-width",
          headline: "", body: "", content: "", title: "", imageUrl: "",
          buttonText: "Shop Now", buttonUrl: "",
          ctaText: "Shop Now", ctaUrl: "",
          buttonColor: color, alignment: "center",
          source: "manual", visible: true, collapsed: false,
        },
      ],
    },
    {
      id: "loyalty-offer",
      title: "Loyalty Offer",
      description: "Offer headline, details with urgency, CTA",
      icon: <Gift className="h-5 w-5" />,
      campaignName: "Exclusive Offer for Our Best Customers",
      subjectLine: `${name} — An exclusive offer just for you`,
      blocks: () => [
        {
          id: makeId(), type: "email-safe-hero", layout: "full-width",
          headline: "Exclusive Offer for Our Best Customers",
          subtitle: "Because you've been with us, we wanted to give you something first.",
          body: "", content: "", title: "", imageUrl: "", ctaText: "", ctaUrl: "",
          source: "manual", visible: true, collapsed: false,
          backgroundColor: "#f5f5f7", textColor: "#111111",
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        },
        {
          id: makeId(), type: "image-text", layout: "full-width",
          headline: "", body: "As one of our most loyal customers, you get early access to this offer before anyone else. Valid this week only — come visit us before it's gone.",
          content: "", title: "", imageUrl: "", ctaText: "", ctaUrl: "",
          source: "manual", visible: true, collapsed: false,
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        },
        {
          id: makeId(), type: "button", layout: "full-width",
          headline: "", body: "", content: "", title: "", imageUrl: "",
          buttonText: "Claim Your Offer", buttonUrl: "",
          ctaText: "Claim Your Offer", ctaUrl: "",
          buttonColor: color, alignment: "center",
          source: "manual", visible: true, collapsed: false,
        },
      ],
    },
    {
      id: "workshop-event",
      title: "Workshop or Event",
      description: "Event banner, details, register button",
      icon: <CalendarDays className="h-5 w-5" />,
      campaignName: "You're Invited",
      subjectLine: `You're invited — upcoming event at ${name}`,
      blocks: () => [
        {
          id: makeId(), type: "header", layout: "full-width",
          headline: "You're Invited", body: "A hands-on workshop at your local garden center.",
          content: "", title: "", imageUrl: "", ctaText: "", ctaUrl: "",
          backgroundColor: color, textColor: "#ffffff",
          alignment: "center", padding: "medium",
          source: "manual", visible: true, collapsed: false,
        },
        {
          id: makeId(), type: "image-text", layout: "full-width",
          headline: "Event Details",
          body: "What: [Workshop Name]\nWhen: [Date and Time]\nWhere: [Your Garden Center Address]\n\nJoin us for a hands-on session. Space is limited — register early to save your spot.",
          content: "", title: "", imageUrl: "", ctaText: "", ctaUrl: "",
          source: "manual", visible: true, collapsed: false,
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        },
        {
          id: makeId(), type: "button", layout: "full-width",
          headline: "", body: "", content: "", title: "", imageUrl: "",
          buttonText: "Register Now", buttonUrl: "",
          ctaText: "Register Now", ctaUrl: "",
          buttonColor: color, alignment: "center",
          source: "manual", visible: true, collapsed: false,
        },
      ],
    },
    {
      id: "new-arrivals",
      title: "New Arrivals",
      description: "Arrivals hero, photo gallery, CTA",
      icon: <Sprout className="h-5 w-5" />,
      campaignName: "Fresh Arrivals This Week",
      subjectLine: `Fresh arrivals this week at ${name}`,
      blocks: () => [
        {
          id: makeId(), type: "email-safe-hero", layout: "full-width",
          headline: "Fresh Arrivals This Week",
          subtitle: "Just in — new plants, colours, and varieties you won't want to miss.",
          body: "", content: "", title: "", imageUrl: "", ctaText: "", ctaUrl: "",
          source: "manual", visible: true, collapsed: false,
          backgroundColor: "#f5f5f7", textColor: "#111111",
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        },
        {
          id: makeId(), type: "image-gallery", layout: "full-width",
          headline: "What's New", body: "",
          content: "", title: "", imageUrl: "",
          ctaText: "", ctaUrl: "",
          galleryImages: [],
          galleryLayout: "3-across",
          galleryGap: "medium",
          galleryImageRadius: "medium",
          source: "manual", visible: true, collapsed: false,
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        } as ContentBlock,
        {
          id: makeId(), type: "image-text", layout: "full-width",
          headline: "", body: "Every week we bring in fresh stock from local and regional growers. Availability changes fast — if you see something you like, come grab it before it's gone.",
          content: "", title: "", imageUrl: "", ctaText: "", ctaUrl: "",
          source: "manual", visible: true, collapsed: false,
          shouldFetchImage: false, isGeneratingImage: false, autoImageMode: false,
        },
        {
          id: makeId(), type: "button", layout: "full-width",
          headline: "", body: "", content: "", title: "", imageUrl: "",
          buttonText: "Visit Us", buttonUrl: "",
          ctaText: "Visit Us", ctaUrl: "",
          buttonColor: color, alignment: "center",
          source: "manual", visible: true, collapsed: false,
        },
      ],
    },
  ];
}

// Block-stack diagram: shows coloured bars representing blocks
function BlockDiagram({ blocks }: { blocks: string[] }) {
  const colors: Record<string, string> = {
    hero: "#1abc9c",
    header: "#1abc9c",
    text: "#94a3b8",
    image: "#60a5fa",
    button: "#f59e0b",
    gallery: "#a78bfa",
  };

  return (
    <div className="flex flex-col gap-[3px]">
      {blocks.map((b, i) => (
        <div
          key={i}
          className="rounded-sm"
          style={{
            height: b === "hero" || b === "header" ? 10 : 6,
            backgroundColor: colors[b] || "#cbd5e1",
          }}
        />
      ))}
    </div>
  );
}

const diagramMap: Record<string, string[]> = {
  "weekly-newsletter": ["hero", "image", "text", "button"],
  "seasonal-announcement": ["header", "text", "image", "button"],
  "loyalty-offer": ["hero", "text", "button"],
  "workshop-event": ["header", "text", "button"],
  "new-arrivals": ["hero", "gallery", "text", "button"],
};

export const StructurePicker: React.FC<StructurePickerProps> = ({
  gardenCenterName,
  primaryColor,
  weeklyThemeTitle,
  onSelect,
}) => {
  const options = React.useMemo(
    () => buildOptions(gardenCenterName, primaryColor),
    [gardenCenterName, primaryColor],
  );

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          Choose a starting structure
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a layout to start with — you can change everything after.
        </p>
        {weeklyThemeTitle && (
          <p className="text-xs text-green-700 mt-2">
            🌱 This week's theme: <strong>{weeklyThemeTitle}</strong> — it'll be used as your starting headline
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() =>
              onSelect(opt.blocks(), opt.campaignName, opt.subjectLine)
            }
            className="flex flex-col items-start gap-3 rounded-xl border-2 border-border bg-background p-4 text-left transition-all hover:border-primary/50 hover:shadow-md"
          >
            <div className="flex items-center gap-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              >
                {opt.icon}
              </div>
              <span className="text-sm font-semibold text-foreground">
                {opt.title}
              </span>
            </div>
            <div className="w-full">
              <BlockDiagram blocks={diagramMap[opt.id] || []} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {opt.description}
            </p>
          </button>
        ))}

        {/* Start from scratch */}
        <button
          type="button"
          onClick={() => onSelect([], undefined, undefined)}
          className="flex flex-col items-start gap-3 rounded-xl border-2 border-dashed border-border bg-background p-4 text-left transition-all hover:border-primary/50 hover:shadow-md"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <LayoutTemplate className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-foreground">
              Start from Scratch
            </span>
          </div>
          <div className="w-full">
            <div className="h-[27px] flex items-center justify-center">
              <div className="h-px w-full bg-border" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Blank canvas — add blocks one at a time
          </p>
        </button>
      </div>
    </div>
  );
};
