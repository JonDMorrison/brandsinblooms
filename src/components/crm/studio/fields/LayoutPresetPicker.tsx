import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Check } from "lucide-react";
import type { LayoutPreset } from "@/lib/studio/layoutPresets";

type LayoutPresetPickerProps = {
  presets: LayoutPreset[];
  selectedKey?: string;
  onSelect: (preset: LayoutPreset) => void;
};

function getThumbnailSx(preset: LayoutPreset) {
  switch (preset.thumbnail) {
    case "gradient-warm":
      return {
        background: `linear-gradient(135deg, ${preset.fields.gradientFrom ?? "#ff6b6b"}, ${preset.fields.gradientTo ?? "#ffd93d"})`,
      };
    case "image-overlay":
      return {
        background:
          "linear-gradient(135deg, rgba(0,0,0,0.72), rgba(0,0,0,0.42)), linear-gradient(45deg, #78909C, #263238)",
      };
    case "light-minimal":
    case "newsletter-minimal":
      return {
        bgcolor: "#f8f9fa",
        border: "1px solid",
        borderColor: "neutral.200",
      };
    case "brand-green":
      return { bgcolor: "#2E7D32" };
    case "image-rounded":
      return { bgcolor: "neutral.200", borderRadius: "8px" };
    case "graphic-full-bleed":
      return { bgcolor: "#0f172a" };
    case "graphic-rounded-card":
      return {
        bgcolor: "#ffffff",
        border: "1px solid",
        borderColor: "neutral.200",
      };
    case "graphic-text-overlay":
      return {
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(15,23,42,0.72))",
      };
    case "graphic-caption-bar":
      return {
        bgcolor: "#ffffff",
        border: "1px solid",
        borderColor: "neutral.200",
      };
    case "graphic-framed-shadow":
      return {
        bgcolor: "#f8fafc",
        border: "1px solid",
        borderColor: "neutral.200",
      };
    case "image-padded":
    case "image-caption":
      return {
        bgcolor: "neutral.50",
        border: "1px solid",
        borderColor: "neutral.200",
      };
    case "newsletter-centered":
      return {
        bgcolor: "#ffffff",
        border: "1px solid",
        borderColor: "neutral.200",
      };
    case "newsletter-banner":
      return { bgcolor: preset.fields.backgroundColor ?? "#1a1a2e" };
    case "image-text-overlay":
      return {
        background:
          "linear-gradient(135deg, rgba(17,24,39,0.86), rgba(17,24,39,0.5)), linear-gradient(45deg, #d1d5db, #6b7280)",
      };
    case "plain-boxed":
    case "quote-avatar":
    case "product-centered":
      return {
        bgcolor: "#ffffff",
        border: "1px solid",
        borderColor: "neutral.200",
      };
    case "plain-accent":
    case "quote-classic":
    case "product-minimal":
    case "cta-centered-hero":
    case "cta-inline-button":
    case "cta-stacked-double":
    case "social-icon-row":
    case "social-label-row":
    case "social-vertical-list":
    case "divider-simple":
    case "divider-dashed":
    case "divider-dotted":
    case "divider-ornamental":
    case "spacer-tight":
    case "spacer-standard":
    case "spacer-airy":
    case "spacer-large":
    case "footer-light-minimal":
    case "footer-centered-branded":
    case "gallery-grid-3":
    case "gallery-grid-4":
    case "gallery-grid-6":
    case "gallery-feature-grid":
    case "product-gallery-standard":
    case "product-gallery-three-column":
    case "product-gallery-feature":
      return { bgcolor: "#ffffff" };
    case "footer-standard-dark":
      return { bgcolor: preset.fields.backgroundColor ?? "#1e293b" };
    case "cta-banner":
      return { bgcolor: preset.fields.backgroundColor ?? "#111827" };
    case "cta-split":
      return { bgcolor: "#f8fafc" };
    default:
      return { bgcolor: preset.fields.backgroundColor ?? "#1a1a2e" };
  }
}

function MiniLine({ width = 24 }: { width?: number }) {
  return (
    <Box
      sx={{
        width,
        height: 3,
        borderRadius: 999,
        bgcolor: "currentColor",
        opacity: 0.38,
      }}
    />
  );
}

function ThumbnailLines({ preset }: { preset: LayoutPreset }) {
  const isLight =
    preset.thumbnail.includes("light") ||
    preset.thumbnail.includes("minimal") ||
    preset.thumbnail.includes("centered") ||
    preset.thumbnail.includes("caption") ||
    preset.thumbnail.includes("padded");
  const lineColor = isLight ? "rgba(26,26,46,0.38)" : "rgba(255,255,255,0.72)";

  if (preset.thumbnail.startsWith("image")) {
    if (preset.thumbnail.startsWith("image-text")) {
      const overlay = preset.thumbnail === "image-text-overlay";
      const minimal = preset.thumbnail === "image-text-minimal";
      const stacked = minimal || preset.thumbnail === "image-text-top";
      const reversed = preset.thumbnail === "image-text-right";

      if (overlay) {
        return (
          <Stack spacing={0.45} sx={{ color: "#ffffff", width: 36 }}>
            <MiniLine width={24} />
            <MiniLine width={34} />
            <Box
              sx={{
                width: 16,
                height: 5,
                borderRadius: 999,
                bgcolor: "currentColor",
                opacity: 0.8,
              }}
            />
          </Stack>
        );
      }

      return (
        <Stack
          spacing={0.45}
          direction={stacked ? "column" : reversed ? "row-reverse" : "row"}
          alignItems="center"
          justifyContent="center"
          sx={{ color: "#111827", width: "100%" }}
        >
          <Box
            sx={{
              width: stacked ? (minimal ? 30 : 42) : 20,
              height: stacked ? (minimal ? 14 : 18) : 28,
              borderRadius: minimal ? "8px" : "4px",
              bgcolor: "neutral.300",
            }}
          />
          <Stack spacing={0.35} alignItems={stacked ? "center" : "flex-start"}>
            <MiniLine width={stacked ? 30 : 20} />
            <MiniLine width={stacked ? 22 : 16} />
            <MiniLine width={stacked ? 16 : 12} />
          </Stack>
        </Stack>
      );
    }

    return (
      <Box
        sx={{
          width: preset.thumbnail === "image-padded" ? 30 : 40,
          height: preset.thumbnail === "image-caption" ? 26 : 30,
          borderRadius: preset.thumbnail === "image-rounded" ? "7px" : "3px",
          bgcolor: isLight ? "neutral.300" : "rgba(255,255,255,0.45)",
          boxShadow:
            preset.thumbnail === "image-caption"
              ? "0 10px 0 -8px rgba(0,0,0,0.28)"
              : "none",
        }}
      />
    );
  }

  if (preset.thumbnail.startsWith("graphic")) {
    if (preset.thumbnail === "graphic-full-bleed") {
      return (
        <Box
          sx={{
            width: 44,
            height: 32,
            bgcolor: "rgba(255,255,255,0.16)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
          }}
        />
      );
    }

    if (preset.thumbnail === "graphic-rounded-card") {
      return (
        <Box
          sx={{
            width: 44,
            height: 32,
            p: 0.5,
            boxSizing: "border-box",
          }}
        >
          <Box
            sx={{
              width: "100%",
              height: "100%",
              borderRadius: "8px",
              bgcolor: "#0f172a",
            }}
          />
        </Box>
      );
    }

    if (preset.thumbnail === "graphic-text-overlay") {
      return (
        <Box
          sx={{
            position: "relative",
            width: 44,
            height: 32,
            borderRadius: "5px",
            overflow: "hidden",
            bgcolor: "rgba(255,255,255,0.12)",
          }}
        >
          <Stack
            spacing={0.35}
            alignItems="center"
            justifyContent="center"
            sx={{
              position: "absolute",
              inset: 0,
              color: "rgba(255,255,255,0.88)",
            }}
          >
            <MiniLine width={22} />
            <MiniLine width={16} />
            <Box
              sx={{
                width: 14,
                height: 5,
                borderRadius: 999,
                bgcolor: "currentColor",
                opacity: 0.92,
              }}
            />
          </Stack>
        </Box>
      );
    }

    if (preset.thumbnail === "graphic-caption-bar") {
      return (
        <Box
          sx={{
            width: 44,
            height: 32,
            borderRadius: "5px",
            overflow: "hidden",
            boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.08)",
          }}
        >
          <Box sx={{ width: "100%", height: 22, bgcolor: "#0f172a" }} />
          <Stack
            spacing={0.25}
            alignItems="flex-start"
            justifyContent="center"
            sx={{
              width: "100%",
              height: 10,
              px: 0.5,
              boxSizing: "border-box",
              bgcolor: "#1e293b",
              color: "rgba(255,255,255,0.78)",
            }}
          >
            <MiniLine width={18} />
          </Stack>
        </Box>
      );
    }

    return (
      <Box
        sx={{
          width: 44,
          height: 32,
          p: 0.75,
          boxSizing: "border-box",
        }}
      >
        <Box
          sx={{
            width: "100%",
            height: "100%",
            borderRadius: "8px",
            bgcolor: "#0f172a",
            boxShadow: "0 4px 10px rgba(15,23,42,0.18)",
          }}
        />
      </Box>
    );
  }

  if (preset.thumbnail.startsWith("plain")) {
    return (
      <Stack
        spacing={0.45}
        alignItems={
          preset.thumbnail === "plain-centered" ? "center" : "flex-start"
        }
        sx={{
          width: preset.thumbnail === "plain-boxed" ? 42 : 36,
          color: "#111827",
          borderLeft:
            preset.thumbnail === "plain-accent" ? "3px solid currentColor" : 0,
          borderRadius: preset.thumbnail === "plain-boxed" ? "5px" : 0,
          bgcolor:
            preset.thumbnail === "plain-boxed" ? "neutral.100" : "transparent",
          p: preset.thumbnail === "plain-boxed" ? 0.65 : 0,
          pl: preset.thumbnail === "plain-accent" ? 0.65 : undefined,
        }}
      >
        <MiniLine width={30} />
        <MiniLine width={34} />
        <MiniLine width={24} />
      </Stack>
    );
  }

  if (preset.thumbnail.startsWith("quote")) {
    return (
      <Stack
        spacing={0.45}
        alignItems={
          preset.thumbnail === "quote-centered" ? "center" : "flex-start"
        }
        sx={{
          width: 40,
          color: "#111827",
          borderLeft:
            preset.thumbnail === "quote-classic" ? "3px solid currentColor" : 0,
          borderRadius: preset.thumbnail === "quote-avatar" ? "6px" : 0,
          bgcolor:
            preset.thumbnail === "quote-avatar" ? "neutral.100" : "transparent",
          p: preset.thumbnail === "quote-avatar" ? 0.65 : 0,
          pl: preset.thumbnail === "quote-classic" ? 0.65 : undefined,
        }}
      >
        {preset.thumbnail === "quote-centered" ? (
          <Typography sx={{ fontSize: "20px", lineHeight: 0.8, opacity: 0.3 }}>
            &quot;
          </Typography>
        ) : null}
        <MiniLine width={30} />
        <MiniLine width={24} />
        {preset.thumbnail === "quote-avatar" ? (
          <Stack direction="row" spacing={0.4} alignItems="center">
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: "neutral.400",
              }}
            />
            <MiniLine width={18} />
          </Stack>
        ) : (
          <MiniLine width={18} />
        )}
      </Stack>
    );
  }

  if (preset.thumbnail.startsWith("cta")) {
    const banner = preset.thumbnail === "cta-banner";
    const inline = preset.thumbnail === "cta-inline-button";
    const split = preset.thumbnail === "cta-split";
    const double = preset.thumbnail === "cta-stacked-double";

    if (inline) {
      return (
        <Box
          sx={{
            width: 32,
            height: 10,
            borderRadius: 999,
            border: "2px solid currentColor",
            color: "#111827",
          }}
        />
      );
    }

    return (
      <Stack
        direction={split || banner ? "row" : "column"}
        spacing={0.5}
        alignItems="center"
        justifyContent="center"
        sx={{
          width: 44,
          color: banner ? "rgba(255,255,255,0.9)" : "#111827",
        }}
      >
        <Stack spacing={0.35} sx={{ flex: split || banner ? 1 : undefined }}>
          <MiniLine width={split || banner ? 20 : 32} />
          {!banner ? <MiniLine width={split ? 14 : 24} /> : null}
        </Stack>
        <Stack spacing={0.35} alignItems="center">
          <Box
            sx={{
              width: banner ? 16 : 22,
              height: 7,
              borderRadius: 999,
              bgcolor: "currentColor",
              opacity: 0.78,
            }}
          />
          {double ? <MiniLine width={18} /> : null}
        </Stack>
      </Stack>
    );
  }

  if (preset.thumbnail.startsWith("social")) {
    const vertical = preset.thumbnail === "social-vertical-list";
    const withLabel = preset.thumbnail === "social-label-row";

    return (
      <Stack
        direction={vertical ? "column" : "row"}
        spacing={vertical ? 0.35 : 0.55}
        alignItems={vertical ? "stretch" : "center"}
        justifyContent="center"
        sx={{ width: 42, color: "#111827" }}
      >
        {withLabel ? <MiniLine width={28} /> : null}
        {Array.from({ length: vertical ? 3 : 4 }).map((_item, index) => (
          <Stack
            key={`social-thumb-${preset.key}-${index}`}
            direction="row"
            spacing={0.4}
            alignItems="center"
          >
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius:
                  preset.thumbnail === "social-icon-row" ? "50%" : "3px",
                bgcolor: "currentColor",
                opacity: 0.6 + index * 0.08,
              }}
            />
            {vertical ? <MiniLine width={22} /> : null}
          </Stack>
        ))}
      </Stack>
    );
  }

  if (preset.thumbnail.startsWith("divider")) {
    const ornamental = preset.thumbnail === "divider-ornamental";
    const borderStyle =
      preset.thumbnail === "divider-dashed"
        ? "dashed"
        : preset.thumbnail === "divider-dotted"
          ? "dotted"
          : "solid";

    return (
      <Stack
        direction="row"
        spacing={0.65}
        alignItems="center"
        justifyContent="center"
        sx={{ width: 44, color: "#111827" }}
      >
        <Box
          sx={{
            flex: 1,
            borderTop: `2px ${borderStyle} currentColor`,
            opacity: 0.42,
          }}
        />
        {ornamental ? (
          <Typography sx={{ fontSize: "12px", lineHeight: 1, opacity: 0.6 }}>
            ✦
          </Typography>
        ) : null}
        {ornamental ? (
          <Box
            sx={{ flex: 1, borderTop: "2px solid currentColor", opacity: 0.42 }}
          />
        ) : null}
      </Stack>
    );
  }

  if (preset.thumbnail.startsWith("spacer")) {
    const height =
      preset.thumbnail === "spacer-tight"
        ? 12
        : preset.thumbnail === "spacer-standard"
          ? 18
          : preset.thumbnail === "spacer-airy"
            ? 24
            : 30;

    return (
      <Box
        sx={{
          width: 40,
          height,
          border: "1.5px dashed",
          borderColor: "neutral.300",
          borderRadius: "4px",
          bgcolor: "neutral.50",
        }}
      />
    );
  }

  if (preset.thumbnail.startsWith("footer")) {
    const dark = preset.thumbnail === "footer-standard-dark";
    const centered = preset.thumbnail === "footer-centered-branded";
    const color = dark ? "rgba(255,255,255,0.72)" : "#111827";

    return (
      <Stack
        spacing={0.45}
        alignItems={centered ? "center" : "flex-start"}
        justifyContent="center"
        sx={{ width: 42, color }}
      >
        {centered ? (
          <Box
            sx={{
              width: 14,
              height: 10,
              borderRadius: "3px",
              bgcolor: "currentColor",
              opacity: 0.42,
            }}
          />
        ) : null}
        <MiniLine width={centered ? 30 : 24} />
        <MiniLine width={centered ? 24 : 34} />
        {dark ? (
          <Box
            sx={{
              width: 36,
              height: 1,
              bgcolor: "currentColor",
              opacity: 0.34,
            }}
          />
        ) : null}
        <Stack direction="row" spacing={0.4}>
          <MiniLine width={14} />
          <MiniLine width={18} />
        </Stack>
      </Stack>
    );
  }

  if (preset.thumbnail.startsWith("gallery")) {
    const feature = preset.thumbnail === "gallery-feature-grid";
    const cells =
      preset.thumbnail === "gallery-grid-6"
        ? 6
        : preset.thumbnail === "gallery-grid-4"
          ? 4
          : 3;

    if (feature) {
      return (
        <Stack
          direction="row"
          spacing={0.45}
          alignItems="stretch"
          sx={{ width: 44, height: 32 }}
        >
          <Box sx={{ flex: 2, borderRadius: "4px", bgcolor: "neutral.300" }} />
          <Stack spacing={0.45} sx={{ flex: 1 }}>
            <Box
              sx={{ flex: 1, borderRadius: "4px", bgcolor: "neutral.300" }}
            />
            <Box
              sx={{ flex: 1, borderRadius: "4px", bgcolor: "neutral.300" }}
            />
          </Stack>
        </Stack>
      );
    }

    return (
      <Box
        sx={{
          width: 42,
          display: "grid",
          gridTemplateColumns: `repeat(${cells === 3 ? 3 : cells === 4 ? 2 : 3}, 1fr)`,
          gap: "3px",
        }}
      >
        {Array.from({ length: cells }).map((_item, index) => (
          <Box
            key={`gallery-thumb-${preset.key}-${index}`}
            sx={{
              height: cells === 3 ? 24 : 12,
              borderRadius: "3px",
              bgcolor: "neutral.300",
            }}
          />
        ))}
      </Box>
    );
  }

  if (preset.thumbnail.startsWith("product")) {
    const centered = preset.thumbnail === "product-centered";
    const minimal = preset.thumbnail === "product-minimal";
    const galleryFeature = preset.thumbnail === "product-gallery-feature";
    const galleryThree = preset.thumbnail === "product-gallery-three-column";

    if (galleryFeature) {
      return (
        <Stack
          direction="row"
          spacing={0.5}
          alignItems="center"
          sx={{ width: 44, color: "#111827" }}
        >
          <Box
            sx={{
              width: 20,
              height: 28,
              borderRadius: "4px",
              bgcolor: "neutral.300",
            }}
          />
          <Stack spacing={0.35}>
            <MiniLine width={18} />
            <MiniLine width={12} />
            <Box
              sx={{
                width: 14,
                height: 5,
                borderRadius: 999,
                bgcolor: "currentColor",
                opacity: 0.72,
              }}
            />
          </Stack>
        </Stack>
      );
    }

    if (preset.thumbnail.startsWith("product-gallery")) {
      const count = galleryThree ? 3 : 4;

      return (
        <Box
          sx={{
            width: 42,
            display: "grid",
            gridTemplateColumns: `repeat(${galleryThree ? 3 : 2}, 1fr)`,
            gap: "3px",
          }}
        >
          {Array.from({ length: count }).map((_item, index) => (
            <Stack
              key={`product-gallery-thumb-${preset.key}-${index}`}
              spacing={0.25}
            >
              <Box
                sx={{ height: 9, borderRadius: "3px", bgcolor: "neutral.300" }}
              />
              <MiniLine width={galleryThree ? 8 : 12} />
            </Stack>
          ))}
        </Box>
      );
    }

    return (
      <Stack
        direction={minimal || centered ? "column" : "row"}
        spacing={0.5}
        alignItems={centered ? "center" : "flex-start"}
        justifyContent="center"
        sx={{ width: 42, color: "#111827" }}
      >
        {!minimal ? (
          <Box
            sx={{
              width: centered ? 34 : 16,
              height: centered ? 16 : 28,
              borderRadius: "4px",
              bgcolor: "neutral.300",
            }}
          />
        ) : null}
        <Stack
          spacing={0.35}
          alignItems={centered ? "center" : "flex-start"}
          sx={{ flex: 1 }}
        >
          <MiniLine width={minimal ? 34 : 22} />
          <MiniLine width={minimal ? 18 : 14} />
          <Box
            sx={{
              width: 16,
              height: 5,
              borderRadius: 999,
              bgcolor: "currentColor",
              opacity: 0.72,
            }}
          />
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack spacing={0.5} alignItems="center" sx={{ width: "100%" }}>
      <Box
        sx={{ width: 28, height: 3, borderRadius: 999, bgcolor: lineColor }}
      />
      <Box
        sx={{ width: 40, height: 3, borderRadius: 999, bgcolor: lineColor }}
      />
      <Box
        sx={{
          width: 22,
          height: 3,
          borderRadius: 999,
          bgcolor: lineColor,
          opacity: 0.7,
        }}
      />
    </Stack>
  );
}

export default function LayoutPresetPicker({
  presets,
  selectedKey,
  onSelect,
}: LayoutPresetPickerProps) {
  return (
    <Stack
      spacing={0.9}
      sx={{
        px: 2.5,
        pt: 2.25,
        pb: 1.25,
        width: "100%",
        maxWidth: "100%",
        minWidth: 0,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <Typography
        level="body-xs"
        sx={{
          fontSize: "10px",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "primary.400",
        }}
      >
        Layout Presets
      </Typography>
      <Box
        sx={{
          width: "100%",
          maxWidth: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          overflowY: "hidden",
          pb: 0.75,
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {presets.map((preset) => {
          const selected = selectedKey === preset.key;

          return (
            <Sheet
              key={preset.key}
              component="button"
              type="button"
              variant="plain"
              title={preset.description}
              onClick={() => onSelect(preset)}
              sx={{
                position: "relative",
                width: 76,
                height: 88,
                flex: "0 0 auto",
                p: 0,
                border: "1px solid",
                borderColor: selected ? "primary.400" : "neutral.200",
                outline: selected ? "2px solid" : "0 solid transparent",
                outlineColor: selected ? "primary.100" : "transparent",
                outlineOffset: 1,
                borderRadius: "8px",
                overflow: "hidden",
                bgcolor: "background.surface",
                cursor: "pointer",
                boxShadow: selected
                  ? "0 8px 22px -16px var(--joy-palette-primary-500)"
                  : "none",
                transition:
                  "border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
                "&:hover": {
                  borderColor: "primary.400",
                  boxShadow: "0 8px 22px -18px var(--joy-palette-primary-500)",
                  transform: "translateY(-1px)",
                },
                "&:focus-visible": {
                  outline: "2px solid",
                  outlineColor: "primary.400",
                  outlineOffset: 2,
                },
              }}
            >
              {selected ? (
                <Box
                  sx={{
                    position: "absolute",
                    top: 5,
                    right: 5,
                    zIndex: 2,
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    bgcolor: "primary.500",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 0 0 2px #ffffff",
                  }}
                >
                  <Check size={11} strokeWidth={3} />
                </Box>
              ) : null}
              <Box
                sx={{
                  height: 56,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  ...getThumbnailSx(preset),
                }}
              >
                <ThumbnailLines preset={preset} />
              </Box>
              <Box
                sx={{
                  height: 32,
                  px: 0.65,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Typography
                  level="body-xs"
                  sx={{
                    fontSize: "10px",
                    fontWeight: 650,
                    lineHeight: 1.1,
                    color: selected ? "primary.700" : "neutral.700",
                    textAlign: "center",
                  }}
                >
                  {preset.name}
                </Typography>
              </Box>
            </Sheet>
          );
        })}
      </Box>
    </Stack>
  );
}
