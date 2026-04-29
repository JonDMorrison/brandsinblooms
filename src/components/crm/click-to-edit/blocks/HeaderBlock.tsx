import React, { useRef } from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { Input } from "@/components/ui-legacy/input";
import { Label } from "@/components/ui-legacy/label";
import { Textarea } from "@/components/ui-legacy/textarea";
import { NativeSelect } from "@/components/ui-legacy/NativeSelect";
import { Slider } from "@/components/ui-legacy/slider";
import {
  MediaSelectorImage,
  MediaSelectorImageHandle,
} from "@/components/crm/MediaSelectorImage";
import { Edit, Copy, Trash2, RefreshCw, Sparkles } from "lucide-react";
import { TipBox } from "@/components/ui/TipBox";
import { cn } from "@/lib/utils";
import { ContextualToolbar } from "../contextual/ContextualToolbar";
import { EditMode } from "@/hooks/useBlockEditMode";
import { sanitizeWeekNumbers } from "@/utils/weekNumberSanitizer";
import { useAutoBackgroundImage } from "@/hooks/useAutoBackgroundImage";
import { SafeHtml } from "@/components/ui-legacy/safe-html";
import { ColorPickerWithSwatches } from "../shared/ColorPickerWithSwatches";
import { AIImageLoadingOverlay } from "../AIImageLoadingOverlay";

interface HeaderBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  isPreview: boolean;
  editMode?: EditMode;
  onModeChange?: (mode: EditMode) => void;
  isGeneratingImage?: boolean;
}

export const HeaderBlock: React.FC<HeaderBlockProps> = ({
  block,
  onUpdate,
  onDuplicate,
  onDelete,
  isPreview,
  editMode,
  onModeChange,
  isGeneratingImage = false,
}) => {
  const mediaSelectorRef = useRef<MediaSelectorImageHandle>(null);

  // Use auto background image hook
  const { isLoading: isLoadingBgImage, refetchImage } = useAutoBackgroundImage({
    headline: block.headline || block.title,
    currentBackgroundUrl: block.backgroundImageUrl,
    onImageSelected: (imageUrl, metadata) => {
      onUpdate({
        backgroundImageUrl: imageUrl,
        // Set a subtle dark overlay for better text readability (using dark gray instead of black)
        backgroundColor: "#1f2937",
        colorOverlayOpacity: 40,
        backgroundOpacity: 60,
      });
    },
    enabled: !isPreview,
    shouldAutoFetch: false, // Disable automatic fetching for existing blocks
  });
  // Live preview component that can be reused
  const PreviewContent = () => (
    <div className="relative overflow-hidden rounded-lg group min-h-[300px]">
      {/* Background Image - bottom layer */}
      {block.backgroundImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${block.backgroundImageUrl})`,
            opacity: (block.backgroundOpacity || 100) / 100,
          }}
        />
      )}

      {/* Color Overlay - middle layer */}

      {block.backgroundColor ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: block.backgroundColor,
            opacity: (block.colorOverlayOpacity || 50) / 100,
          }}
        />
      ) : null}

      {/* Custom Image Overlay from overlay dialog - supports overlayColor/overlayOpacity */}
      {block.overlayOpacity && block.overlayOpacity > 0 && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: block.overlayColor || "#000000",
            opacity: block.overlayOpacity / 100,
          }}
        />
      )}

      {/* Contextual Toolbar - only show when onModeChange is available */}
      {onModeChange && (
        <ContextualToolbar
          editMode={editMode}
          onModeChange={onModeChange}
          onImageEdit={() => {
            mediaSelectorRef.current?.openDialog();
          }}
          showTextEdit={true}
          showImageEdit={true}
          showFormatEdit={false}
        />
      )}

      {/* Content - top layer */}
      <div
        className={cn(
          "relative z-10 p-12 text-white flex items-center justify-center min-h-[300px]",
          // Use a beautiful gradient fallback instead of grey when no background
          !block.backgroundImageUrl &&
            !block.backgroundColor && [
              "bg-gradient-to-br from-blue-600 via-purple-600 to-blue-800",
              "bg-[length:400%_400%] animate-gradient-x",
            ],
          block.textAlign === "center" && "text-center",
          block.textAlign === "right" && "text-right",
        )}
      >
        <div className="max-w-2xl">
          <SafeHtml
            content={sanitizeWeekNumbers(
              block.headline || block.title || "Your Headline Here",
            )}
            className="text-4xl md:text-5xl font-bold mb-4 leading-tight drop-shadow-lg [&>*]:m-0"
            type="general"
          />
          {(block.body || block.subtitle || block.content) && (
            <SafeHtml
              content={sanitizeWeekNumbers(
                block.body || block.subtitle || block.content || "",
              )}
              className="text-lg md:text-xl opacity-90 leading-relaxed drop-shadow-md [&>*]:m-0"
              type="general"
            />
          )}
        </div>
      </div>

      {/* Legacy Action Buttons - only show when not using contextual toolbar */}
      {!isPreview && !onModeChange && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
          <button
            className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-md transition-colors"
            title="Edit"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={onDuplicate}
            className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-md transition-colors"
            title="Duplicate"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={onDelete}
            className="bg-gray-600 hover:bg-gray-700 text-white p-2 rounded-md transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </div>
  );

  if (isPreview) {
    return <PreviewContent />;
  }

  return (
    <div className="space-y-6">
      {/* Live Preview Section */}
      <div className="space-y-2">
        <Label>Live Preview</Label>
        <div className="border rounded-lg overflow-hidden">
          <PreviewContent />
        </div>
      </div>

      {/* Editor Controls */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="headline">Headline</Label>
          <Input
            id="headline"
            value={block.headline || ""}
            onChange={(e) => onUpdate({ headline: e.target.value })}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Enter headline"
            maxLength={80}
          />
          <TipBox>Keep under 60 characters — longer headlines get cut on mobile</TipBox>
        </div>
        <div className="space-y-2">
          <Label htmlFor="alignment">Text Alignment</Label>
          <NativeSelect
            value={block.textAlign || "left"}
            onChange={(e) => onUpdate({ textAlign: e.target.value as any })}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="body">Body Text</Label>
        <Textarea
          id="body"
          value={block.body || ""}
          onChange={(e) => onUpdate({ body: e.target.value })}
          placeholder="Enter subtitle or description"
          rows={3}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Background Image</Label>
          <div className="flex items-center gap-2">
            {isLoadingBgImage && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Finding image...</span>
              </div>
            )}
            <button
              onClick={refetchImage}
              disabled={isLoadingBgImage || !block.headline}
              className="flex items-center gap-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Find new background image based on headline"
            >
              <Sparkles className="h-3 w-3" />
              Auto-select
            </button>
            {block.backgroundImageUrl && (
              <button
                onClick={() => onUpdate({ backgroundImageUrl: undefined })}
                className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-md transition-colors"
              >
                Remove Image
              </button>
            )}
          </div>
        </div>

        {/* Auto-background info */}
        {!block.backgroundImageUrl && block.headline && (
          <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md border border-blue-200">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-800">Smart Background</p>
                <p>
                  We'll automatically find a beautiful background image based on
                  your headline: "<em>{block.headline}</em>"
                </p>
              </div>
            </div>
          </div>
        )}

        <MediaSelectorImage
          ref={mediaSelectorRef}
          src={block.backgroundImageUrl}
          onChange={(imageUrl, metadata) => {
            onUpdate({ backgroundImageUrl: imageUrl });
          }}
          contentContext={block.headline || block.body || "header background"}
          className="h-32"
        />
        {block.backgroundImageUrl && (
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
        )}
      </div>

      <div className="space-y-3">
        <Label>Text Contrast</Label>
        <div className="grid grid-cols-4 gap-2">
          {([
            { key: "none", label: "None", bg: "#000000", opacity: 0 },
            { key: "light", label: "Light", bg: "#ffffff", opacity: 30 },
            { key: "dark", label: "Dark", bg: "#000000", opacity: 40 },
            { key: "strong", label: "Strong", bg: "#000000", opacity: 65 },
          ] as const).map((preset) => {
            const current = block.colorOverlayOpacity ?? 50;
            const currentBg = (block.backgroundColor || "#000000").toLowerCase();
            const isActive =
              (preset.key === "none" && current <= 5) ||
              (preset.key === "light" && currentBg.startsWith("#fff") && current > 5 && current <= 35) ||
              (preset.key === "dark" && !currentBg.startsWith("#fff") && current > 5 && current <= 50) ||
              (preset.key === "strong" && current > 50);
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() =>
                  onUpdate({
                    backgroundColor: preset.bg,
                    colorOverlayOpacity: preset.opacity,
                  })
                }
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg border-2 px-2 py-2 text-xs font-medium transition-all",
                  isActive
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40",
                )}
              >
                <div
                  className="h-6 w-full rounded"
                  style={{
                    background:
                      preset.key === "none"
                        ? "linear-gradient(135deg,#f97316,#ec4899)"
                        : `linear-gradient(135deg, rgba(${preset.bg === "#ffffff" ? "255,255,255" : "0,0,0"},${preset.opacity / 100}), rgba(${preset.bg === "#ffffff" ? "255,255,255" : "0,0,0"},${preset.opacity / 100})), linear-gradient(135deg,#f97316,#ec4899)`,
                  }}
                />
                {preset.label}
              </button>
            );
          })}
        </div>
        <TipBox>Dark backgrounds with white text increase readability for promotional emails</TipBox>
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
  );
};
