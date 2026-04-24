import type { ReactNode } from "react";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  IntegrationCard,
  type HubIntegrationCardProps,
} from "@/components/integrations/IntegrationCard";

type LegacyFeaturedCardProps = {
  title: string;
  description: string;
  icon: ReactNode;
  badge?: {
    label: string;
    className?: string;
  };
  features?: string[];
  children?: ReactNode;
  onClick?: () => void;
};

export type FeaturedCardProps =
  | HubIntegrationCardProps
  | LegacyFeaturedCardProps;

function isHubProps(
  props: FeaturedCardProps,
): props is HubIntegrationCardProps {
  return "item" in props;
}

export function FeaturedCard(props: FeaturedCardProps) {
  if (isHubProps(props)) {
    return <IntegrationCard {...props} featured />;
  }

  return (
    <IntegrationCard
      title={props.title}
      description={props.description}
      icon={props.icon}
      badge={
        props.badge ? (
          <Chip color="neutral" size="sm" variant="soft">
            {props.badge.label}
          </Chip>
        ) : undefined
      }
      featured
      onClick={props.onClick}
    >
      {props.features?.length ? (
        <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
          {props.features.map((feature) => (
            <Chip key={feature} color="neutral" size="sm" variant="outlined">
              {feature}
            </Chip>
          ))}
        </Stack>
      ) : null}

      {props.children ? (
        <Typography level="body-sm" sx={{ color: "text.secondary" }}>
          {props.children}
        </Typography>
      ) : null}
    </IntegrationCard>
  );
}
