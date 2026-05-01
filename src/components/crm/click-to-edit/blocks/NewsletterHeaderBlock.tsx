import React, { useState } from "react";
import { AlignmentType, ContentBlock, SpacingType } from "@/types/emailBuilder";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import { Textarea } from "@/components/ui-legacy/textarea";
import { NativeSelect } from "@/components/ui-legacy/NativeSelect";
import { Slider } from "@/components/ui-legacy/slider";
import { MediaSelectorImage } from "@/components/crm/MediaSelectorImage";
import { cn } from "@/lib/utils";
import { ContextualToolbar } from "../contextual/ContextualToolbar";
import { EditMode } from "@/hooks/useBlockEditMode";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
import { Calendar } from "lucide-react";
import { AIImageLoadingOverlay } from "../AIImageLoadingOverlay";
import {
  OPACITY_DEFAULTS,
  normalizeOpacityToDecimal,
} from "@/utils/opacityUtils";
import { normalizeDateInputValue } from "@/utils/dateInputValue";

interface NewsletterHeaderBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  isPreview: boolean;
  editMode?: EditMode;
  onModeChange?: (mode: EditMode) => void;
  isGeneratingImage?: boolean;
}

export const NewsletterHeaderBlock: React.FC<NewsletterHeaderBlockProps> = ({
  block,
  onUpdate,
  onDuplicate,
  onDelete,
  isPreview,
  editMode,
  onModeChange,
  isGeneratingImage = false,
}) => {
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [tempDate, setTempDate] = useState(
    normalizeDateInputValue(block.publishDate),
  );

  // Handle nested content structure from database
  const content =
    typeof block.content === "object" && block.content !== null
      ? (block.content as Partial<ContentBlock>)
      : {};
  const title =
    block.title || content.title || block.headline || content.headline || "";
  const subtitle = block.subtitle || content.subtitle || "";
  const publishDate = normalizeDateInputValue(
    block.publishDate || content.publishDate || "",
  );
  const textColor = block.textColor || "#ffffff";
  const ctaText = block.ctaText || block.buttonText || "";
  const ctaUrl = block.ctaUrl || block.buttonUrl || "";
  const hasCta = Boolean(ctaText && ctaUrl);
  const publishDateLabel = publishDate
    ? new Date(`${publishDate}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";
  const textAlign = block.textAlign || block.alignment || "center";
  const contentAlignmentClass =
    textAlign === "right"
      ? "text-right items-end"
      : textAlign === "left"
        ? "text-left items-start"
        : "text-center items-center";
  const ctaAlignmentClass =
    textAlign === "right"
      ? "justify-end"
      : textAlign === "left"
        ? "justify-start"
        : "justify-center";

  const renderPreviewContent = () => {
    // Use shared opacity utility for WYSIWYG consistency with email generation
    const backgroundOpacityDecimal = normalizeOpacityToDecimal(
      block.backgroundOpacity,
      OPACITY_DEFAULTS.backgroundImage,
    );
    const colorOverlayDecimal = normalizeOpacityToDecimal(
      block.colorOverlayOpacity,
      OPACITY_DEFAULTS.colorOverlay,
    );
    const darkOverlayDecimal = normalizeOpacityToDecimal(
      block.darkOverlayOpacity,
      OPACITY_DEFAULTS.darkOverlay,
    );
    const imageOverlayDecimal = normalizeOpacityToDecimal(
      block.overlayOpacity,
      OPACITY_DEFAULTS.imageOverlay,
    );

    return (
      <div className="relative overflow-hidden rounded-lg group min-h-[400px]">
        {/* Background Image - bottom layer */}
        {block.backgroundImageUrl && (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${block.backgroundImageUrl})`,
              opacity: backgroundOpacityDecimal,
            }}
          />
        )}

        {/* Dark Overlay - for text contrast */}
        {block.backgroundImageUrl && darkOverlayDecimal > 0 && (
          <div
            className="absolute inset-0 bg-black"
            style={{
              opacity: darkOverlayDecimal,
            }}
          />
        )}

        {/* Color Overlay - middle layer */}
        {block.backgroundColor && (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: block.backgroundColor,
              opacity: colorOverlayDecimal,
            }}
          />
        )}

        {/* Custom Image Overlay from overlay dialog */}
        {imageOverlayDecimal > 0 && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: block.overlayColor || "#000000",
              opacity: imageOverlayDecimal,
            }}
          />
        )}

        {/* Contextual Toolbar - only show when onModeChange is available */}
        {onModeChange && (
          <ContextualToolbar
            editMode={editMode}
            onModeChange={onModeChange}
            onImageEdit={() => {
              setTimeout(() => {
                const mediaSelector = document.querySelector(
                  "[data-media-selector-button]",
                ) as HTMLButtonElement;
                if (mediaSelector) {
                  mediaSelector.click();
                }
              }, 50);
            }}
            showTextEdit={true}
            showImageEdit={true}
            showFormatEdit={false}
          />
        )}

        {/* Newsletter Header Content - top layer */}
        <div
          className={cn(
            "relative z-10 p-12 flex flex-col justify-center min-h-[400px]",
            // Add dark background only if no background image or color
            !block.backgroundImageUrl &&
              !block.backgroundColor &&
              "bg-gradient-to-br from-primary to-primary-dark",
            contentAlignmentClass,
          )}
          style={{ color: textColor }}
        >
          <div
            className={cn("max-w-3xl w-full space-y-6", contentAlignmentClass)}
          >
            {/* Newsletter Title */}
            <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">
              {sanitizeWeekNumbers(title || "Newsletter Title")}
            </h1>

            {/* Subtitle */}
            {subtitle && (
              <p className="text-xl md:text-2xl opacity-90 leading-relaxed">
                {sanitizeWeekNumbers(
                  typeof subtitle === "string"
                    ? subtitle.replace(/<[^>]*>/g, "")
                    : subtitle,
                )}
              </p>
            )}

            {/* Publish Date */}
            {publishDate && (
              <div
                className={cn(
                  "flex items-center text-lg opacity-80 mt-8",
                  ctaAlignmentClass,
                )}
              >
                <div className="flex items-center gap-2">
                  {isPreview && isEditingDate ? (
                    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 border border-white/20">
                      <Input
                        type="date"
                        value={tempDate}
                        onChange={(e) => setTempDate(e.target.value)}
                        onBlur={() => {
                          onUpdate({ publishDate: tempDate });
                          setIsEditingDate(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onUpdate({ publishDate: tempDate });
                            setIsEditingDate(false);
                          } else if (e.key === "Escape") {
                            setTempDate(
                              normalizeDateInputValue(
                                block.publishDate || content.publishDate || "",
                              ),
                            );
                            setIsEditingDate(false);
                          }
                        }}
                        className="bg-white text-gray-900 border-none h-8 w-40"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <span
                      className={cn(
                        isPreview &&
                          "cursor-pointer hover:bg-white/10 px-3 py-1 rounded-lg transition-colors",
                      )}
                      onClick={() => {
                        if (isPreview) {
                          setTempDate(
                            normalizeDateInputValue(
                              block.publishDate || content.publishDate || "",
                            ),
                          );
                          setIsEditingDate(true);
                        }
                      }}
                    >
                      <Calendar className="inline-block w-4 h-4 mr-2" />
                      {publishDateLabel}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* CTA Button */}
            {hasCta && (
              <div className={cn("mt-8 flex", ctaAlignmentClass)}>
                <a
                  href={ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border-2 px-6 py-3 text-lg font-medium transition-colors"
                  style={{
                    color: textColor,
                    borderColor: textColor,
                    backgroundColor: "transparent",
                  }}
                >
                  {ctaText}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isPreview) {
    return renderPreviewContent();
  }

  return (
    <div className="space-y-6">
      {/* Live Preview Section */}
      <div className="space-y-2">
        <Label>Live Preview</Label>
        <div className="border rounded-lg overflow-hidden">
          {renderPreviewContent()}
        </div>
      </div>

      {/* Editor Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Newsletter Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) =>
              onUpdate({ title: e.target.value, headline: e.target.value })
            }
            placeholder="Enter newsletter title"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="alignment">Text Alignment</Label>
          <NativeSelect
            value={block.textAlign || "center"}
            onChange={(e) =>
              onUpdate({ textAlign: e.target.value as AlignmentType })
            }
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="subtitle">Subtitle</Label>
        <Textarea
          id="subtitle"
          value={typeof subtitle === "string" ? subtitle : ""}
          onChange={(e) => onUpdate({ subtitle: e.target.value })}
          placeholder="Enter newsletter subtitle"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="publishDate">Publish Date</Label>
        <Input
          id="publishDate"
          type="date"
          value={publishDate}
          onChange={(e) => onUpdate({ publishDate: e.target.value })}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Background Image</Label>
          {block.backgroundImageUrl && (
            <button
              onClick={() => onUpdate({ backgroundImageUrl: undefined })}
              className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-md transition-colors"
            >
              Remove Image
            </button>
          )}
        </div>
        <MediaSelectorImage
          src={block.backgroundImageUrl}
          onChange={(imageUrl, metadata) => {
            onUpdate({ backgroundImageUrl: imageUrl });
          }}
          contentContext={block.title || "newsletter header background"}
          className="h-32"
        />
        {block.backgroundImageUrl && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="imageOpacity">Image Opacity</Label>
                <span className="text-sm text-muted-foreground">
                  {block.backgroundOpacity || 100}%
                </span>
              </div>
              <Slider
                value={[block.backgroundOpacity || 100]}
                onValueChange={(value) =>
                  onUpdate({ backgroundOpacity: value[0] })
                }
                max={100}
                min={1}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="darkOverlay">
                  Dark Overlay (for text contrast)
                </Label>
                <span className="text-sm text-muted-foreground">
                  {block.darkOverlayOpacity || 0}%
                </span>
              </div>
              <Slider
                id="darkOverlay"
                value={[block.darkOverlayOpacity || 0]}
                onValueChange={(value) =>
                  onUpdate({ darkOverlayOpacity: value[0] })
                }
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Adds a dark overlay to improve text readability
              </p>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4">
        <Label>Color Overlay</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bgColor">Overlay Color</Label>
            <Input
              id="bgColor"
              type="color"
              value={block.backgroundColor || "#000000"}
              onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="colorOpacity">Overlay Opacity</Label>
              <span className="text-sm text-muted-foreground">
                {block.colorOverlayOpacity || 50}%
              </span>
            </div>
            <Slider
              value={[block.colorOverlayOpacity || 50]}
              onValueChange={(value) =>
                onUpdate({ colorOverlayOpacity: value[0] })
              }
              max={100}
              min={1}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Custom Image Overlay - Newsletter Header Only Feature */}
      <div className="space-y-4 pt-2 border-t">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">
            Image Overlay (Optional)
          </Label>
          <p className="text-xs text-muted-foreground">
            Add a custom color overlay on top of your background image
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="overlayColor">Overlay Color</Label>
            <div className="flex items-center gap-2">
              <Input
                id="overlayColor"
                type="color"
                value={block.overlayColor || "#000000"}
                onChange={(e) => onUpdate({ overlayColor: e.target.value })}
                className="w-16 h-10 p-1 border rounded"
              />
              <Input
                value={block.overlayColor || "#000000"}
                onChange={(e) => onUpdate({ overlayColor: e.target.value })}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="overlayOpacity">Overlay Opacity</Label>
              <span className="text-sm text-muted-foreground">
                {block.overlayOpacity || 0}%
              </span>
            </div>
            <Slider
              id="overlayOpacity"
              value={[block.overlayOpacity || 0]}
              onValueChange={(value) => onUpdate({ overlayOpacity: value[0] })}
              max={100}
              min={0}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Set to 0 to disable overlay
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Padding</Label>
        <NativeSelect
          value={block.padding || "large"}
          onChange={(e) => onUpdate({ padding: e.target.value as SpacingType })}
          options={[
            { value: "none", label: "None" },
            { value: "small", label: "Small" },
            { value: "medium", label: "Medium" },
            { value: "large", label: "Large" },
          ]}
        />
      </div>
    </div>
  );
};
