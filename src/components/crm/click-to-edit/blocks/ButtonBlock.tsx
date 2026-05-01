import React from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import { NativeSelect } from "@/components/ui-legacy/NativeSelect";
import { Switch } from "@/components/ui-legacy/switch";
import { Button } from "@/components/ui-legacy/button";
import { cn } from "@/lib/utils";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
import { ColorPickerWithSwatches } from "../shared/ColorPickerWithSwatches";
import { TipBox } from "@/components/ui/TipBox";

interface ButtonBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

export const ButtonBlock: React.FC<ButtonBlockProps> = ({
  block,
  onUpdate,
  isPreview,
}) => {
  const headline = sanitizeWeekNumbers(block.headline || "");
  const body = sanitizeWeekNumbers(block.body || "");
  const buttonText = block.buttonText || "Click Here";
  const buttonUrl = block.buttonUrl || "#";
  const alignment = block.textAlign || "center";
  const buttonColor = block.buttonColor || "#000000";
  const buttonSize = block.buttonSize || "medium";
  const isRounded = block.isRounded !== false;

  if (isPreview) {
    const paddingClass = {
      none: "p-0",
      small: "p-4",
      medium: "p-6",
      large: "p-8",
    }[block.padding || "medium"];

    const sizeClass = {
      small: "px-4 py-2 text-sm",
      medium: "px-6 py-3 text-base",
      large: "px-8 py-4 text-lg",
    }[buttonSize];

    return (
      <div
        className={cn(
          paddingClass,
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
        <Button
          asChild
          className={cn(sizeClass, isRounded ? "rounded-full" : "rounded-md")}
          style={{
            backgroundColor: buttonColor,
            color: "#ffffff",
          }}
        >
          <a href={buttonUrl} target="_blank" rel="noopener noreferrer">
            {buttonText}
          </a>
        </Button>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="buttonText">Button Text</Label>
          <Input
            id="buttonText"
            value={buttonText}
            onChange={(e) => onUpdate({ buttonText: e.target.value })}
            placeholder="Enter button text"
          />
          <TipBox>
            Action verbs work best: "Get the guide", "Book a call", "See the
            offer"
          </TipBox>
        </div>
        <div className="space-y-1">
          <Label htmlFor="buttonUrl">Link URL</Label>
          <Input
            id="buttonUrl"
            value={buttonUrl}
            onChange={(e) => onUpdate({ buttonUrl: e.target.value })}
            placeholder="https://your-domain.test"
          />
          <TipBox>
            Add UTM parameters to track clicks:
            ?utm_source=email&utm_medium=newsletter
          </TipBox>
        </div>
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
          label="Button Color"
          id="buttonColor"
          value={buttonColor}
          onChange={(color) => onUpdate({ buttonColor: color })}
          defaultValue="#22c55e"
        />

        <div className="space-y-2">
          <Label>Size</Label>
          <NativeSelect
            value={buttonSize}
            onChange={(e) => onUpdate({ buttonSize: e.target.value })}
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            checked={isRounded}
            onCheckedChange={(checked) => onUpdate({ isRounded: checked })}
          />
          <Label>Rounded corners</Label>
        </div>

        <div className="space-y-2">
          <Label>Padding</Label>
          <NativeSelect
            value={block.padding || "medium"}
            onChange={(e) => onUpdate({ padding: e.target.value as any })}
            options={[
              { value: "none", label: "None" },
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
