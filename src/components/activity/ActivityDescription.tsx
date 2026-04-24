import * as React from "react";
import Link from "@mui/joy/Link";
import Typography, { type TypographyProps } from "@mui/joy/Typography";
import type { SxProps } from "@mui/joy/styles/types";
import { Link as RouterLink } from "react-router-dom";
import type {
  ActivityDescription as ActivityDescriptionType,
  ActivityDescriptionPart,
} from "@/types/activity";
import { isInternalHref } from "@/components/activity/activityPresentation";

type ActivityDescriptionProps = {
  description?: ActivityDescriptionType | null;
  maxCharacters?: number;
  level?: TypographyProps["level"];
  color?: TypographyProps["color"];
  sx?: SxProps;
};

function truncateText(value: string, maxCharacters: number) {
  if (value.length <= maxCharacters) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxCharacters - 1)).trimEnd()}…`;
}

function getPartText(part: ActivityDescriptionPart) {
  if (part.type === "text" && typeof part.text === "string") {
    return part.text;
  }

  if (part.type === "link" && typeof part.text === "string") {
    return part.text;
  }

  if (part.type === "mention" && typeof part.label === "string") {
    return part.label;
  }

  return typeof part === "object" ? JSON.stringify(part) : String(part);
}

function updatePartText(part: ActivityDescriptionPart, value: string) {
  if (part.type === "text") {
    return { ...part, text: value };
  }

  if (part.type === "link") {
    return { ...part, text: value };
  }

  if (part.type === "mention") {
    return { ...part, label: value };
  }

  return { type: "text", text: value };
}

function truncateParts(
  parts: ActivityDescriptionPart[],
  maxCharacters?: number,
) {
  if (!maxCharacters || maxCharacters <= 0) {
    return parts;
  }

  const nextParts: ActivityDescriptionPart[] = [];
  let remaining = maxCharacters;

  for (const part of parts) {
    const text = getPartText(part);

    if (text.length <= remaining) {
      nextParts.push(part);
      remaining = Math.max(0, remaining - text.length - 1);
      continue;
    }

    nextParts.push(updatePartText(part, truncateText(text, remaining)));
    break;
  }

  return nextParts;
}

function renderPart(part: ActivityDescriptionPart, idx: number) {
  if (part.type === "text" && typeof part.text === "string") {
    return <React.Fragment key={idx}>{part.text}</React.Fragment>;
  }

  if (
    part.type === "link" &&
    typeof part.href === "string" &&
    typeof part.text === "string"
  ) {
    if (isInternalHref(part.href)) {
      return (
        <Link
          key={idx}
          component={RouterLink}
          to={part.href}
          underline="hover"
          sx={{ fontWeight: 500 }}
        >
          {part.text}
        </Link>
      );
    }

    const target = typeof part.target === "string" ? part.target : "_blank";

    return (
      <Link
        key={idx}
        href={part.href}
        target={target}
        rel={target === "_blank" ? "noreferrer" : undefined}
        underline="hover"
        sx={{ fontWeight: 500 }}
      >
        {part.text}
      </Link>
    );
  }

  if (part.type === "mention" && typeof part.label === "string") {
    if (typeof part.href === "string" && part.href) {
      if (isInternalHref(part.href)) {
        return (
          <Link
            key={idx}
            component={RouterLink}
            to={part.href}
            underline="hover"
            sx={{ fontWeight: 600 }}
          >
            {part.label}
          </Link>
        );
      }

      return (
        <Link
          key={idx}
          href={part.href}
          underline="hover"
          sx={{ fontWeight: 600 }}
        >
          {part.label}
        </Link>
      );
    }

    return (
      <Typography
        key={idx}
        component="span"
        level="body-sm"
        sx={{ display: "inline", fontWeight: 600, color: "text.primary" }}
      >
        {part.label}
      </Typography>
    );
  }

  return <React.Fragment key={idx}>{getPartText(part)}</React.Fragment>;
}

export function ActivityDescription({
  description,
  maxCharacters,
  level = "body-sm",
  color = "neutral",
  sx,
}: ActivityDescriptionProps) {
  const parts = Array.isArray(description?.parts) ? description.parts : [];

  if (!parts.length) {
    return null;
  }

  const renderedParts = truncateParts(parts, maxCharacters);

  return (
    <Typography
      component="span"
      level={level}
      color={color}
      sx={{ display: "inline", lineHeight: 1.6, ...sx }}
    >
      {renderedParts.map((part, idx) => (
        <React.Fragment key={idx}>
          {renderPart(part, idx)}
          {idx < renderedParts.length - 1 ? " " : null}
        </React.Fragment>
      ))}
    </Typography>
  );
}
