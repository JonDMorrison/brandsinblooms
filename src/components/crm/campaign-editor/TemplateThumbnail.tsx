import Box from "@mui/joy/Box";
import type { CampaignTemplateThumbnailBlock } from "@/lib/studio/campaignTemplates";

function toRgba(hexColor: string, alpha: number) {
  const normalized = hexColor.replace("#", "").trim();

  if (normalized.length !== 6) {
    return `rgba(23, 23, 23, ${alpha})`;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function TemplateLine({
  width = "100%",
  height = 8,
  color,
  outlined = false,
}: {
  width?: string;
  height?: number;
  color: string;
  outlined?: boolean;
}) {
  return (
    <Box
      sx={{
        width,
        height,
        borderRadius: height >= 14 ? "999px" : "sm",
        backgroundColor: outlined ? "transparent" : color,
        border: outlined ? "1px solid" : undefined,
        borderColor: outlined ? color : undefined,
      }}
    />
  );
}

export function TemplateThumbnail({
  blocks,
  accentColor,
}: {
  blocks: CampaignTemplateThumbnailBlock[];
  accentColor: string;
}) {
  const solidTone = toRgba(accentColor, 0.18);
  const outlineTone = toRgba(accentColor, 0.28);
  const softTone = toRgba(accentColor, 0.1);
  const accentTone = toRgba(accentColor, 0.42);

  return (
    <Box
      aria-hidden="true"
      sx={{
        height: 120,
        borderRadius: "lg",
        px: 1.25,
        py: 1,
        border: "1px solid",
        borderColor: "neutral.200",
        background: `linear-gradient(180deg, ${toRgba(accentColor, 0.14)} 0%, rgba(255,255,255,0.96) 34%, rgba(244,244,245,0.98) 100%)`,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        overflow: "hidden",
      }}
    >
      {blocks.map((block, index) => {
        if (block.kind === "eyebrow") {
          return (
            <TemplateLine
              key={`${block.kind}-${index}`}
              width={block.width || "36%"}
              height={block.height || 10}
              color={outlineTone}
            />
          );
        }

        if (block.kind === "newsletter-header") {
          return (
            <Box
              key={`${block.kind}-${index}`}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 0.75,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.55,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: accentTone,
                    boxShadow: `0 0 0 4px ${softTone}`,
                    flexShrink: 0,
                  }}
                />
                <TemplateLine
                  width={block.width || "48%"}
                  height={8}
                  color={outlineTone}
                />
              </Box>
              <TemplateLine width="24%" height={14} color={solidTone} />
            </Box>
          );
        }

        if (block.kind === "hero") {
          return (
            <Box
              key={`${block.kind}-${index}`}
              sx={{
                borderRadius: "md",
                border: "1px solid",
                borderColor: outlineTone,
                backgroundColor: solidTone,
                px: 1,
                py: 0.9,
                minHeight: block.height || 44,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 0.75,
              }}
            >
              <TemplateLine width="52%" height={8} color={outlineTone} />
              <TemplateLine width="86%" height={10} color={accentTone} />
              <TemplateLine width="74%" height={8} color={outlineTone} />
            </Box>
          );
        }

        if (block.kind === "text") {
          return (
            <Box
              key={`${block.kind}-${index}`}
              sx={{ display: "flex", flexDirection: "column", gap: 0.55 }}
            >
              <TemplateLine width={block.width || "100%"} color={softTone} />
              <TemplateLine width="88%" color={softTone} />
              <TemplateLine width="64%" color={softTone} />
            </Box>
          );
        }

        if (block.kind === "image-text") {
          return (
            <Box
              key={`${block.kind}-${index}`}
              sx={{
                display: "grid",
                gridTemplateColumns: "40% minmax(0, 1fr)",
                gap: 0.7,
                minHeight: block.height || 34,
                alignItems: "stretch",
              }}
            >
              <Box
                sx={{
                  borderRadius: "md",
                  border: "1px solid",
                  borderColor: outlineTone,
                  backgroundColor: solidTone,
                }}
              />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.45 }}>
                <TemplateLine width="94%" color={softTone} />
                <TemplateLine width="72%" color={softTone} />
                <TemplateLine width="48%" height={7} color={outlineTone} />
              </Box>
            </Box>
          );
        }

        if (block.kind === "product-gallery") {
          return (
            <Box
              key={`${block.kind}-${index}`}
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 0.55,
                minHeight: block.height || 34,
              }}
            >
              {Array.from({ length: 3 }, (_, cardIndex) => (
                <Box
                  key={`gallery-card-${cardIndex}`}
                  sx={{
                    borderRadius: "md",
                    border: "1px solid",
                    borderColor: outlineTone,
                    backgroundColor: "rgba(255,255,255,0.88)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: block.height || 34,
                  }}
                >
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 18,
                      backgroundColor: cardIndex === 1 ? accentTone : solidTone,
                    }}
                  />
                  <Box
                    sx={{
                      px: 0.45,
                      py: 0.35,
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.25,
                    }}
                  >
                    <TemplateLine width="88%" height={5} color={softTone} />
                    <TemplateLine width="60%" height={5} color={outlineTone} />
                  </Box>
                </Box>
              ))}
            </Box>
          );
        }

        if (block.kind === "quote") {
          return (
            <Box
              key={`${block.kind}-${index}`}
              sx={{
                borderRadius: "md",
                border: "1px solid",
                borderColor: "neutral.200",
                backgroundColor: "rgba(255,255,255,0.9)",
                px: 1,
                py: 0.85,
                display: "flex",
                gap: 0.85,
                alignItems: "stretch",
              }}
            >
              <Box
                sx={{
                  width: 3,
                  borderRadius: "999px",
                  backgroundColor: outlineTone,
                }}
              />
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0.5,
                  flex: 1,
                }}
              >
                <TemplateLine width="90%" color={softTone} />
                <TemplateLine width="76%" color={softTone} />
                <TemplateLine width="40%" height={7} color={outlineTone} />
              </Box>
            </Box>
          );
        }

        if (block.kind === "divider") {
          return (
            <TemplateLine
              key={`${block.kind}-${index}`}
              width="100%"
              height={1}
              color={outlineTone}
            />
          );
        }

        if (block.kind === "cta") {
          return (
            <Box
              key={`${block.kind}-${index}`}
              sx={{ display: "flex", justifyContent: "center" }}
            >
              <TemplateLine
                width={block.width || "44%"}
                height={block.height || 16}
                color={toRgba(accentColor, 0.34)}
              />
            </Box>
          );
        }

        if (block.kind === "social-follow") {
          return (
            <Box
              key={`${block.kind}-${index}`}
              sx={{
                mt: "auto",
                pt: 0.85,
                borderTop: "1px solid",
                borderColor: "neutral.200",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 0.75,
              }}
            >
              <Box sx={{ display: "flex", gap: 0.4, alignItems: "center" }}>
                {Array.from({ length: 4 }, (_, iconIndex) => (
                  <Box
                    key={`social-icon-${iconIndex}`}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor:
                        iconIndex === 0 ? accentTone : outlineTone,
                    }}
                  />
                ))}
              </Box>
              <TemplateLine width="34%" height={7} color={softTone} />
            </Box>
          );
        }

        return (
          <Box
            key={`${block.kind}-${index}`}
            sx={{
              mt: "auto",
              pt: 0.85,
              borderTop: "1px solid",
              borderColor: "neutral.200",
              display: "flex",
              gap: 0.5,
              alignItems: "center",
            }}
          >
            <TemplateLine
              width="16%"
              height={12}
              color={outlineTone}
              outlined
            />
            <TemplateLine width="58%" height={7} color={softTone} />
          </Box>
        );
      })}
    </Box>
  );
}
