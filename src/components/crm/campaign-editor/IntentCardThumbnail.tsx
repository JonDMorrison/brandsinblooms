import Box from "@mui/joy/Box";
import type {
  CampaignIntentKey,
  CampaignTemplate,
} from "@/lib/studio/campaignTemplates";
import type { StudioBlock } from "@/types/studioBlocks";

export interface IntentCardThumbnailProps {
  template: CampaignTemplate | null;
  intent?: CampaignIntentKey;
  blocks?: StudioBlock[];
  emptyLabel?: string | null;
  variant?: "preview" | "blank";
}

/** Illustrative layout previews, not screenshots of the finished email. */
export function IntentCardThumbnail({
  template,
  intent,
  blocks,
  emptyLabel,
  variant = "preview",
}: IntentCardThumbnailProps) {
  const green = "#244d46";
  const line = (y: number, width = 170, x = 35) => (
    <rect x={x} y={y} width={width} height="3" rx="1.5" fill="#ccd3d1" />
  );
  const cta = (y: number, label: string) => (
    <g>
      <rect x="78" y={y} width="84" height="17" rx="4" fill={green} />
      <text
        x="120"
        y={y + 11}
        textAnchor="middle"
        fill="white"
        fontSize="6"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  );
  const plant = (x: number, y: number, scale = 1) => (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path
        d="M0 20V-10M0 4Q-25 0-18-15Q0-15 0 4M0-3Q22-8 18-23Q0-21 0-3"
        fill="#aabeb1"
        stroke="#617e6e"
        strokeWidth="1.5"
      />
      <path d="M-13 18H13L9 40H-9Z" fill="#d5dcd7" />
    </g>
  );
  const kind = intent ?? (blocks ? "saved" : "newsletter");
  const blank = variant === "blank";
  return (
    <Box
      aria-hidden
      data-testid={
        blank
          ? "intent-thumbnail-blank"
          : template
            ? `intent-thumbnail-${template.id}`
            : blocks
              ? "saved-template-thumbnail"
              : "intent-thumbnail-empty"
      }
      sx={{
        height: 176,
        borderRadius: "md",
        bgcolor: "#f0f3f2",
        border: "1px solid",
        borderColor: "neutral.200",
        overflow: "hidden",
        display: "grid",
        placeItems: "center",
      }}
    >
      {!template && !blocks && !blank ? (
        <Box sx={{ color: "neutral.600", fontSize: 14 }}>
          {emptyLabel ?? "Coming soon"}
        </Box>
      ) : (
        <svg
          viewBox="0 0 240 176"
          width="100%"
          height="100%"
          fontFamily="Arial, sans-serif"
        >
          <rect
            x="23"
            y="8"
            width="194"
            height="164"
            rx="4"
            fill="white"
            stroke="#e0e6e3"
          />
          {blank ? (
            <g>
              <rect
                x="36"
                y="22"
                width="168"
                height="136"
                rx="3"
                fill="none"
                stroke="#c3cfca"
                strokeDasharray="4 4"
              />
              <text
                x="120"
                y="96"
                textAnchor="middle"
                fontSize="28"
                fill={green}
              >
                +
              </text>
              <text
                x="120"
                y="123"
                textAnchor="middle"
                fontSize="8"
                fill="#65766d"
              >
                Your design starts here
              </text>
            </g>
          ) : (
            <>
              <text
                x="120"
                y="23"
                textAnchor="middle"
                fontSize="7"
                letterSpacing="2"
                fill={green}
              >
                YOUR GARDEN CENTRE
              </text>
              {kind === "sale" ? (
                <>
                  <rect x="30" y="31" width="180" height="85" fill="#e7ece8" />
                  {plant(181, 72, 0.65)}
                  <text x="44" y="53" fontSize="7" fill={green}>
                    A LITTLE SOMETHING FOR YOU
                  </text>
                  <text
                    x="43"
                    y="87"
                    fontSize="31"
                    fontWeight="700"
                    fill={green}
                  >
                    20% OFF
                  </text>
                  <text x="44" y="103" fontSize="7" fill="#53665d">
                    Make room for something green.
                  </text>
                  {cta(125, "SHOP THE SALE")}
                  {line(153, 110, 65)}
                </>
              ) : kind === "new-arrivals" ? (
                <>
                  <text
                    x="120"
                    y="43"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill={green}
                  >
                    Fresh finds have arrived
                  </text>
                  {[61, 120, 179].map((x) => (
                    <g key={x}>
                      <rect
                        x={x - 25}
                        y="53"
                        width="50"
                        height="58"
                        rx="3"
                        fill="#edf1ee"
                      />
                      {plant(x, 80, 0.55)}
                      {line(119, 39, x - 20)}
                      {line(127, 25, x - 13)}
                    </g>
                  ))}
                  {cta(143, "MEET THE NEW ARRIVALS")}
                </>
              ) : kind === "event" ? (
                <>
                  <rect x="30" y="31" width="180" height="59" fill="#dfe8e1" />
                  {plant(165, 57, 0.7)}
                  <rect
                    x="41"
                    y="43"
                    width="35"
                    height="37"
                    rx="3"
                    fill="white"
                  />
                  <text
                    x="58"
                    y="55"
                    textAnchor="middle"
                    fontSize="7"
                    fill={green}
                  >
                    NOV
                  </text>
                  <text
                    x="58"
                    y="72"
                    textAnchor="middle"
                    fontSize="17"
                    fill={green}
                  >
                    14
                  </text>
                  <text
                    x="120"
                    y="108"
                    textAnchor="middle"
                    fontSize="13"
                    fontWeight="700"
                    fill={green}
                  >
                    Let's grow together
                  </text>
                  <text
                    x="120"
                    y="122"
                    textAnchor="middle"
                    fontSize="7"
                    fill="#65766d"
                  >
                    A hands-on workshop at the garden centre
                  </text>
                  {cta(136, "RESERVE YOUR SPOT")}
                </>
              ) : kind === "thank-you" ? (
                <>
                  <text x="42" y="52" fontSize="18" fill={green}>
                    Thank you.
                  </text>
                  <text x="42" y="72" fontSize="7" fill="#53665d">
                    Dear garden friend,
                  </text>
                  {[84, 93, 102, 117].map((y) => (
                    <g key={y}>{line(y, y === 117 ? 106 : 150, 42)}</g>
                  ))}
                  <text
                    x="42"
                    y="143"
                    fontSize="11"
                    fontStyle="italic"
                    fill={green}
                  >
                    Your garden centre team
                  </text>
                </>
              ) : kind === "saved" ? (
                <>
                  {(blocks ?? []).slice(0, 7).map((block, i) => (
                    <g key={i}>
                      <rect
                        x="36"
                        y={33 + i * 18}
                        width="168"
                        height={/image|hero|gallery/.test(block.type) ? 14 : 4}
                        rx="2"
                        fill={
                          /image|hero|gallery/.test(block.type)
                            ? "#dfe8e1"
                            : "#ccd3d1"
                        }
                      />
                      {/cta|action/.test(block.type) && (
                        <rect
                          x="87"
                          y={30 + i * 18}
                          width="66"
                          height="12"
                          rx="3"
                          fill={green}
                        />
                      )}
                    </g>
                  ))}
                </>
              ) : (
                <>
                  <rect x="30" y="31" width="180" height="47" fill="#e4ebe5" />
                  {plant(175, 50, 0.55)}
                  <text x="41" y="50" fontSize="7" fill={green}>
                    FROM OUR GARDEN TO YOURS
                  </text>
                  <text
                    x="41"
                    y="67"
                    fontSize="13"
                    fontWeight="700"
                    fill={green}
                  >
                    The garden journal
                  </text>
                  {[87, 117].map((y, i) => (
                    <g key={y}>
                      <rect
                        x="36"
                        y={y}
                        width="43"
                        height="23"
                        rx="2"
                        fill="#d7e2d9"
                      />
                      {line(y + 3, 107, 88)}
                      {line(y + 11, 94, 88)}
                      {line(y + 19, 72, 88)}
                    </g>
                  ))}
                  {cta(148, "READ MORE")}
                </>
              )}
            </>
          )}
        </svg>
      )}
    </Box>
  );
}
