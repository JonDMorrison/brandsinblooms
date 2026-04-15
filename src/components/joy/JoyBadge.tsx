import JoyBaseBadge, {
  type BadgeProps as JoyBaseBadgeProps,
} from "@mui/joy/Badge";
import type { SxProps } from "@mui/joy/styles/types";

const mergeSx = (...values: Array<SxProps | undefined>) =>
  values.filter(Boolean) as SxProps[];

export type JoyBadgeProps = JoyBaseBadgeProps;

export const JoyBadge = ({
  badgeContent,
  color = "danger",
  max = 99,
  showZero = false,
  sx,
  variant = "solid",
  invisible,
  ...props
}: JoyBadgeProps) => {
  const isEmpty =
    badgeContent === null ||
    badgeContent === undefined ||
    badgeContent === "" ||
    badgeContent === 0;

  return (
    <JoyBaseBadge
      badgeContent={badgeContent}
      color={color}
      invisible={invisible ?? (!showZero && isEmpty)}
      max={max}
      showZero={showZero}
      variant={variant}
      sx={mergeSx(
        {
          "& .MuiBadge-badge": {
            fontSize: "var(--joy-fontSize-xs)",
            fontWeight: "var(--joy-fontWeight-semibold)",
            minWidth: 20,
            height: 20,
            px: 0.75,
            boxShadow: "0 0 0 2px #FFFFFF",
          },
        },
        sx,
      )}
      {...props}
    />
  );
};
