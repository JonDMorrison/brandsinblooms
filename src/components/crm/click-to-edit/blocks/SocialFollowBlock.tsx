import React from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import { NativeSelect } from "@/components/ui-legacy/NativeSelect";
import { Switch } from "@/components/ui-legacy/switch";
import { Button } from "@/components/ui-legacy/button";
import { Facebook, Twitter, Instagram, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
import { ColorPickerWithSwatches } from "../shared/ColorPickerWithSwatches";

interface SocialFollowBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

interface SocialPlatform {
  name: string;
  icon: React.ComponentType<any>;
  enabled: boolean;
  url: string;
}

export const SocialFollowBlock: React.FC<SocialFollowBlockProps> = ({
  block,
  onUpdate,
  isPreview,
}) => {
  const headline = sanitizeWeekNumbers(block.headline || "");
  const body = sanitizeWeekNumbers(block.body || "");
  const socialLinks = block.socialLinks || {
    facebook: { enabled: false, url: "" },
    twitter: { enabled: false, url: "" },
    instagram: { enabled: false, url: "" },
    youtube: { enabled: false, url: "" },
  };

  const iconColor = block.iconColor || "#000000";
  const iconSize = block.iconSize || "medium";
  const alignment = block.textAlign || "center";

  const platforms: Record<
    string,
    { icon: React.ComponentType<any>; label: string }
  > = {
    facebook: { icon: Facebook, label: "Facebook" },
    twitter: { icon: Twitter, label: "X (Twitter)" },
    instagram: { icon: Instagram, label: "Instagram" },
    youtube: { icon: Youtube, label: "YouTube" },
  };

  const updateSocialLink = (
    platform: string,
    field: "enabled" | "url",
    value: boolean | string,
  ) => {
    onUpdate({
      socialLinks: {
        ...socialLinks,
        [platform]: {
          ...socialLinks[platform],
          [field]: value,
        },
      },
    });
  };

  if (isPreview) {
    const enabledPlatforms = Object.entries(socialLinks).filter(
      ([_, data]) => data.enabled && data.url,
    );

    if (enabledPlatforms.length === 0) {
      return (
        <div className="p-6 text-center text-muted-foreground">
          No social platforms enabled
        </div>
      );
    }

    const sizeClass = {
      small: "h-6 w-6",
      medium: "h-8 w-8",
      large: "h-10 w-10",
    }[iconSize];

    return (
      <div
        className={cn(
          "p-6",
          alignment === "center" && "text-center",
          alignment === "right" && "text-right",
        )}
      >
        {headline && (
          <h3
            className="text-xl font-semibold mb-2"
            style={{ color: "#1f2937" }}
          >
            {headline}
          </h3>
        )}
        {body && (
          <div
            className="mb-4 leading-relaxed"
            style={{ color: "#6b7280" }}
            dangerouslySetInnerHTML={{ __html: formatDraftRichText(body) }}
          />
        )}
        <div
          className={cn(
            "flex gap-4",
            alignment === "center" && "justify-center",
            alignment === "right" && "justify-end",
          )}
        >
          {enabledPlatforms.map(([platform, data]) => {
            const PlatformIcon = platforms[platform].icon;
            return (
              <a
                key={platform}
                href={data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:opacity-70 transition-opacity"
              >
                <PlatformIcon
                  className={sizeClass}
                  style={{ color: iconColor }}
                />
              </a>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={headline}
            onChange={(e) => onUpdate({ headline: e.target.value })}
            placeholder="Enter headline (optional)"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="body">Body Text</Label>
          <Input
            id="body"
            value={body}
            onChange={(e) => onUpdate({ body: e.target.value })}
            placeholder="Enter body text (optional)"
          />
        </div>
      </div>

      <div className="space-y-4">
        <Label>Social Platforms</Label>
        {Object.entries(platforms).map(([platform, { icon: Icon, label }]) => (
          <div key={platform} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Switch
                checked={socialLinks[platform]?.enabled || false}
                onCheckedChange={(checked) =>
                  updateSocialLink(platform, "enabled", checked)
                }
              />
              <Icon className="h-4 w-4" />
              <Label>{label}</Label>
            </div>
            {socialLinks[platform]?.enabled && (
              <Input
                value={socialLinks[platform]?.url || ""}
                onChange={(e) =>
                  updateSocialLink(platform, "url", e.target.value)
                }
                placeholder={`Enter ${label} URL`}
                className="ml-6"
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Alignment</Label>
          <NativeSelect
            value={alignment}
            onChange={(e) => onUpdate({ textAlign: e.target.value as any })}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
        </div>

        <ColorPickerWithSwatches
          label="Icon Color"
          id="iconColor"
          value={iconColor}
          onChange={(color) => onUpdate({ iconColor: color })}
          defaultValue="#1f2937"
        />

        <div className="space-y-2">
          <Label>Icon Size</Label>
          <NativeSelect
            value={iconSize}
            onChange={(e) => onUpdate({ iconSize: e.target.value })}
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
          />
        </div>
      </div>
    </div>
  );
};
