import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  normalizeSocialLinks,
  resolveSocialFollowIcon,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_ORDER,
} from "@/lib/studio/socialIcons";
import { useOptionalDesignSystem } from "@/contexts/DesignSystemContext";
import type { SocialLink, StudioBlock } from "@/types/studioBlocks";

type SocialFollowRendererProps = {
  block: StudioBlock;
};

function getIconSize(
  size: StudioBlock["iconSize"] | StudioBlock["socialIconSize"],
) {
  switch (size) {
    case "sm":
      return 28;
    case "lg":
      return 42;
    default:
      return 34;
  }
}

function SocialIconImage({
  block,
  link,
  size,
  designSystem,
}: {
  block: StudioBlock;
  link: SocialLink;
  size: number;
  designSystem?: { colors: { text?: string } } | null;
}) {
  // The exact image the email uses (src/lib/studio/socialIcons).
  const { src } = resolveSocialFollowIcon(
    block,
    link.platform,
    designSystem?.colors.text || block.textColor,
  );
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ display: "block", width: size, height: size }}
    />
  );
}

function getVisibleLinks(
  block: StudioBlock,
  designSystem?: { social: { links: SocialLink[] } } | null,
) {
  const designSystemLinks = designSystem?.social.links ?? [];
  const blockLinks = normalizeSocialLinks(
    block.socialLinks,
    block.socialLinkOrder,
  );
  const links = blockLinks.length
    ? blockLinks
    : designSystemLinks.length
      ? designSystemLinks
      : SOCIAL_PLATFORM_ORDER.map((platform) => ({
          platform,
          enabled: false,
          url: "",
        }));
  const mergedLinks = links.map((link) => {
    const fallbackUrl =
      designSystemLinks.find(
        (candidate) => candidate.platform === link.platform,
      )?.url || "";

    return {
      ...link,
      url: link.url || fallbackUrl,
      enabled: link.enabled || Boolean(link.url || fallbackUrl),
    } satisfies SocialLink;
  });
  const enabledLinks = mergedLinks.filter((link) => link.enabled);

  if (enabledLinks.length > 0) {
    return { links: enabledLinks, placeholder: false };
  }

  return { links: mergedLinks.slice(0, 4), placeholder: true };
}

function IconAnchor({
  block,
  link,
  placeholder,
  designSystem,
}: {
  block: StudioBlock;
  link: SocialLink;
  placeholder: boolean;
  designSystem?: { colors: { text?: string } } | null;
}) {
  const iconSize = getIconSize(block.iconSize ?? block.socialIconSize);

  return (
    <Box
      component={link.url ? "a" : "span"}
      href={link.url || undefined}
      aria-label={SOCIAL_PLATFORM_LABELS[link.platform]}
      onClick={(event) => event.preventDefault()}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: block.textColor || "#111827",
        textDecoration: "none",
        opacity: placeholder ? 0.34 : 1,
      }}
    >
      <SocialIconImage
        block={block}
        link={link}
        size={iconSize}
        designSystem={designSystem}
      />
    </Box>
  );
}

export default function SocialFollowRenderer({
  block,
}: SocialFollowRendererProps) {
  const designSystem = useOptionalDesignSystem()?.designSystem;
  const { links, placeholder } = getVisibleLinks(block, designSystem);
  const textColor = block.textColor || "#111827";
  const label = block.socialLabel?.trim();
  const paddingY = block.verticalPadding ?? 24;
  const align = block.textAlign || "center";
  const alignItems =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const justifyContent =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const layout = block.layout || "icon-row";
  const iconSpacing = block.iconSpacing ?? 12;

  if (layout === "vertical-list") {
    return (
      <Box
        sx={{
          bgcolor: block.backgroundColor || "#ffffff",
          px: 2,
          py: `${paddingY}px`,
        }}
      >
        <Stack spacing={1.25} alignItems={alignItems}>
          <Typography
            sx={{
              color: textColor,
              fontFamily: "var(--studio-font-subheading)",
              fontSize: "14px",
              fontWeight: 760,
              lineHeight: 1.25,
              opacity: label ? 0.84 : 0.34,
            }}
          >
            {label || "Connect with us"}
          </Typography>
          <Stack spacing={0.75} sx={{ width: "100%", minWidth: 0 }}>
            {links.map((link) => (
              <Box
                key={link.platform}
                component={link.url ? "a" : "span"}
                href={link.url || undefined}
                onClick={(event) => event.preventDefault()}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: `${Math.max(8, iconSpacing - 2)}px`,
                  color: textColor,
                  fontFamily: "var(--studio-font-body)",
                  textDecoration: "none",
                  fontSize: "14px",
                  fontWeight: 650,
                  lineHeight: 1.2,
                  opacity: placeholder ? 0.34 : 0.88,
                }}
              >
                <SocialIconImage
                  block={block}
                  link={link}
                  size={getIconSize(block.iconSize ?? block.socialIconSize)}
                  designSystem={designSystem}
                />
                <span>{SOCIAL_PLATFORM_LABELS[link.platform]}</span>
              </Box>
            ))}
          </Stack>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: block.backgroundColor || "#ffffff",
        px: 2,
        py: `${paddingY}px`,
      }}
    >
      <Stack spacing={1.35} alignItems={alignItems}>
        {layout === "label-row" || label ? (
          <Typography
            sx={{
              color: textColor,
              fontFamily: "var(--studio-font-subheading)",
              fontSize: "14px",
              fontWeight: 760,
              lineHeight: 1.25,
              opacity: label ? 0.84 : 0.34,
              textAlign: align,
            }}
          >
            {label || "Follow us"}
          </Typography>
        ) : null}
        <Stack
          direction="row"
          alignItems="center"
          justifyContent={justifyContent}
          useFlexGap
          sx={{ width: "100%", flexWrap: "wrap", gap: `${iconSpacing}px` }}
        >
          {links.map((link) => (
            <IconAnchor
              key={link.platform}
              block={block}
              link={link}
              placeholder={placeholder}
              designSystem={designSystem}
            />
          ))}
        </Stack>
      </Stack>
    </Box>
  );
}
