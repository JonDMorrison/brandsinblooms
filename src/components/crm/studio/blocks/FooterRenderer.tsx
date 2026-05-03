import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { formatDraftRichText } from "@/lib/crm/htmlContent";
import {
  SocialIcon,
  SOCIAL_PLATFORM_LABELS,
  SOCIAL_PLATFORM_ORDER,
} from "@/components/crm/studio/icons/SocialIcons";
import { useOptionalDesignSystem } from "@/contexts/DesignSystemContext";
import type { SocialLink, StudioBlock } from "@/types/studioBlocks";

type FooterRendererProps = {
  block: StudioBlock;
};

function getCompanyInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (words.length === 0) {
    return "B";
  }

  return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
}

function hasRichText(value: string | undefined) {
  return Boolean(
    value
      ?.replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim(),
  );
}

function getFooterSocialLinks(
  block: StudioBlock,
  designSystem?: {
    social: { links: SocialLink[]; hasConfiguredLinks: boolean };
  } | null,
) {
  const links = block.footerSocialLinks ?? [];
  const enabledLinks = links.filter((link) => link.enabled);

  if (enabledLinks.length > 0) {
    return { links: enabledLinks, placeholder: false };
  }

  const designSystemLinks =
    designSystem?.social.links.filter((link) => Boolean(link.url)) ?? [];

  if (designSystemLinks.length > 0) {
    return { links: designSystemLinks, placeholder: false };
  }

  return {
    links: SOCIAL_PLATFORM_ORDER.slice(0, 3).map((platform) => {
      const existing = links.find((link) => link.platform === platform);
      return {
        platform,
        enabled: false,
        url: existing?.url ?? "",
      } satisfies SocialLink;
    }),
    placeholder: true,
  };
}

function getFooterContactLines(
  block: StudioBlock,
  designSystem?: {
    company: {
      addressLines: string;
      address: string;
      phone: string;
      email: string;
    };
  } | null,
) {
  const addressSource =
    block.address ||
    designSystem?.company.addressLines ||
    designSystem?.company.address ||
    "123 Main St\nCity, State";
  const lines = addressSource
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (designSystem?.company.phone) {
    lines.push(designSystem.company.phone);
  }

  if (designSystem?.company.email) {
    lines.push(designSystem.company.email);
  }

  return lines;
}

function LogoMark({
  block,
  dark,
  designSystem,
}: {
  block: StudioBlock;
  dark: boolean;
  designSystem?: {
    company: { name: string };
    colors: {
      footerLogoBackground?: string;
      footerLogoText?: string;
    };
  } | null;
}) {
  const businessName =
    block.businessName || designSystem?.company.name || "Your Business";
  const size = block.logoSize ?? 40;

  if (block.logoUrl) {
    return (
      <Box
        component="img"
        src={block.logoUrl}
        alt=""
        sx={{
          display: "block",
          width: "auto",
          maxWidth: size * 2.6,
          height: size,
          objectFit: "contain",
        }}
      />
    );
  }

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: "10px",
        bgcolor:
          designSystem?.colors.footerLogoBackground ||
          (dark ? "rgba(255,255,255,0.12)" : "neutral.100"),
        color:
          designSystem?.colors.footerLogoText || (dark ? "#ffffff" : "#111827"),
        border: "1px solid",
        borderColor: dark ? "rgba(255,255,255,0.18)" : "neutral.200",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--studio-font-brand)",
        fontSize: "14px",
        fontWeight: 800,
        lineHeight: 1,
        flex: "0 0 auto",
      }}
    >
      {getCompanyInitials(businessName)}
    </Box>
  );
}

function FooterLinks({
  block,
  centered = false,
  designSystem,
}: {
  block: StudioBlock;
  centered?: boolean;
  designSystem?: {
    company: { websiteUrl: string };
  } | null;
}) {
  const linkColor = block.linkColor || (centered ? "#0f766e" : "#cbd5e1");
  const websiteUrl = block.websiteUrl || designSystem?.company.websiteUrl || "";
  const links = [
    { label: "Unsubscribe", href: "#unsubscribe", visible: true },
    {
      label: "Manage Preferences",
      href: "#preferences",
      visible: block.showManagePreferences !== false,
    },
    {
      label: "Website",
      href: websiteUrl || "#website",
      visible: Boolean(block.showWebsiteLink || websiteUrl),
    },
  ].filter((link) => link.visible);

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      flexWrap="wrap"
      justifyContent={centered ? "center" : "flex-start"}
      sx={{ color: linkColor }}
    >
      {links.map((link, index) => (
        <Box key={link.label} sx={{ display: "inline-flex", gap: 1 }}>
          {index > 0 ? (
            <Typography sx={{ color: "inherit", opacity: 0.45 }}>|</Typography>
          ) : null}
          <Typography
            component="a"
            href={link.href}
            onClick={(event) => event.preventDefault()}
            sx={{
              color: "inherit",
              fontFamily: "var(--studio-font-button)",
              fontSize: "12px",
              fontWeight: 700,
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            {link.label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function FooterSocialIcons({
  block,
  centered = false,
  designSystem,
}: {
  block: StudioBlock;
  centered?: boolean;
  designSystem?: {
    social: { links: SocialLink[]; hasConfiguredLinks: boolean };
  } | null;
}) {
  if (!block.showSocialInFooter && !designSystem?.social.hasConfiguredLinks) {
    return null;
  }

  const { links, placeholder } = getFooterSocialLinks(block, designSystem);
  const iconColor = block.footerIconColor || (centered ? "#64748b" : "#cbd5e1");

  return (
    <Stack
      direction="row"
      spacing={1.1}
      useFlexGap
      flexWrap="wrap"
      justifyContent={centered ? "center" : "flex-start"}
      sx={{ width: "100%" }}
    >
      {links.map((link) => (
        <Box
          key={link.platform}
          component={link.url ? "a" : "span"}
          href={link.url || undefined}
          aria-label={SOCIAL_PLATFORM_LABELS[link.platform]}
          onClick={(event) => event.preventDefault()}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: iconColor,
            textDecoration: "none",
            opacity: placeholder ? 0.38 : 1,
          }}
        >
          <SocialIcon
            platform={link.platform}
            size={30}
            color={iconColor}
            variant={block.footerIconStyle ?? "filled"}
          />
        </Box>
      ))}
    </Stack>
  );
}

function FooterComplianceText({
  content,
  color,
  centered = false,
}: {
  content: string;
  color: string;
  centered?: boolean;
}) {
  if (!hasRichText(content)) {
    return (
      <Typography
        sx={{
          color,
          fontFamily: "var(--studio-font-body)",
          fontSize: "12px",
          lineHeight: 1.6,
          textAlign: centered ? "center" : "left",
          opacity: 0.92,
        }}
      >
        {content}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        color,
        fontFamily: "var(--studio-font-body)",
        fontSize: "12px",
        lineHeight: 1.6,
        textAlign: centered ? "center" : "left",
        "& p": { m: 0 },
        "& p + p": { mt: 0.75 },
        "& a": {
          color: "inherit",
          textDecoration: "underline",
          textUnderlineOffset: "2px",
        },
      }}
      dangerouslySetInnerHTML={{ __html: formatDraftRichText(content) }}
    />
  );
}

export default function FooterRenderer({ block }: FooterRendererProps) {
  const designSystem = useOptionalDesignSystem()?.designSystem;
  const layout = block.layout || "standard-dark";
  const dark = layout === "standard-dark";
  const centered = layout === "centered-branded";
  const businessName =
    block.businessName || designSystem?.company.name || "Your Business";
  const contactLines = getFooterContactLines(block, designSystem);
  const contactStack = contactLines.join("\n");
  const contactInline = contactLines.join(" · ");
  const complianceText = (
    block.complianceText ||
    designSystem?.company.footerLegalText ||
    "You are receiving this email because you opted in to receive updates from our business."
  ).replace("{name}", businessName);
  const copyrightText =
    block.copyright ||
    block.copyrightText ||
    `© ${new Date().getFullYear()} ${businessName}`;
  const backgroundColor =
    block.backgroundColor ||
    designSystem?.colors.footerBackground ||
    (dark ? "#1e293b" : "#ffffff");
  const textColor =
    block.textColor ||
    designSystem?.colors.footerText ||
    (dark ? "#ffffff" : "#111827");
  const mutedColor = dark ? "rgba(255,255,255,0.68)" : "#64748b";
  const dividerColor =
    block.dividerBelowColor ||
    designSystem?.colors.footerDivider ||
    (dark ? "rgba(255,255,255,0.16)" : "#e2e8f0");
  const paddingY = block.verticalPadding ?? 32;

  if (layout === "light-minimal") {
    return (
      <Box
        sx={{
          bgcolor: backgroundColor,
          px: 3,
          py: `${paddingY}px`,
          color: textColor,
        }}
      >
        <Stack spacing={1.1}>
          <Stack direction="row" spacing={1.25} alignItems="center">
            <LogoMark block={block} dark={false} designSystem={designSystem} />
            <Typography
              sx={{
                color: textColor,
                fontFamily: "var(--studio-font-headline)",
                fontSize: "15px",
                fontWeight: 800,
              }}
            >
              {businessName}
            </Typography>
          </Stack>
          <Typography
            sx={{
              color: mutedColor,
              fontFamily: "var(--studio-font-body)",
              fontSize: "12px",
              lineHeight: 1.5,
            }}
          >
            {contactInline}
          </Typography>
          <FooterSocialIcons block={block} designSystem={designSystem} />
          <FooterLinks block={block} designSystem={designSystem} />
          <Typography
            sx={{
              color: mutedColor,
              fontFamily: "var(--studio-font-body)",
              fontSize: "11px",
              lineHeight: 1.5,
            }}
          >
            {copyrightText}
          </Typography>
        </Stack>
      </Box>
    );
  }

  if (centered) {
    return (
      <Box
        sx={{
          bgcolor: backgroundColor,
          px: 3,
          py: `${paddingY}px`,
          color: textColor,
        }}
      >
        <Stack spacing={1.5} alignItems="center" sx={{ textAlign: "center" }}>
          <LogoMark block={block} dark={false} designSystem={designSystem} />
          <Stack spacing={0.35}>
            <Typography
              sx={{
                color: textColor,
                fontFamily: "var(--studio-font-headline)",
                fontSize: "16px",
                fontWeight: 800,
              }}
            >
              {businessName}
            </Typography>
            <Typography
              sx={{
                color: mutedColor,
                fontFamily: "var(--studio-font-body)",
                fontSize: "12px",
                lineHeight: 1.55,
                whiteSpace: "pre-line",
              }}
            >
              {contactStack}
            </Typography>
          </Stack>
          <FooterSocialIcons
            block={block}
            centered
            designSystem={designSystem}
          />
          <FooterLinks block={block} centered designSystem={designSystem} />
          <Box
            sx={{
              width: "100%",
              maxWidth: 520,
              height: "1px",
              bgcolor: dividerColor,
            }}
          />
          <FooterComplianceText
            content={complianceText}
            color={mutedColor}
            centered
          />
          <Typography
            sx={{
              color: mutedColor,
              fontFamily: "var(--studio-font-body)",
              fontSize: "11px",
              lineHeight: 1.5,
            }}
          >
            {copyrightText}
          </Typography>
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        bgcolor: backgroundColor,
        px: 3,
        py: `${paddingY}px`,
        color: textColor,
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", sm: "flex-start" }}
          justifyContent="space-between"
        >
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ minWidth: 0 }}
          >
            <LogoMark block={block} dark designSystem={designSystem} />
            <Typography
              sx={{
                color: textColor,
                fontFamily: "var(--studio-font-headline)",
                fontSize: "15px",
                fontWeight: 800,
              }}
            >
              {businessName}
            </Typography>
          </Stack>
          <Typography
            sx={{
              color: mutedColor,
              fontFamily: "var(--studio-font-body)",
              fontSize: "12px",
              lineHeight: 1.55,
              whiteSpace: "pre-line",
              textAlign: { xs: "left", sm: "right" },
            }}
          >
            {contactStack}
          </Typography>
        </Stack>
        <Box sx={{ height: "1px", bgcolor: dividerColor }} />
        <Stack spacing={1.5}>
          <FooterComplianceText content={complianceText} color={mutedColor} />
          <FooterSocialIcons block={block} designSystem={designSystem} />
          <FooterLinks block={block} designSystem={designSystem} />
          <Typography
            sx={{
              color: mutedColor,
              fontFamily: "var(--studio-font-body)",
              fontSize: "11px",
              lineHeight: 1.5,
            }}
          >
            {copyrightText}
          </Typography>
        </Stack>
      </Stack>
    </Box>
  );
}
