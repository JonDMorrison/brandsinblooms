import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "circular" | "text" | "card";
  animation?: "pulse" | "wave" | "none";
}

function Skeleton({
  className,
  variant = "default",
  animation = "wave",
  ...props
}: SkeletonProps) {
  const variantClasses = {
    default: "rounded-md",
    circular: "rounded-full",
    text: "rounded-sm h-4",
    card: "rounded-lg h-32",
  };

  const animationClasses = {
    pulse: "bloom-skeleton bloom-skeleton--pulse",
    wave: "bloom-skeleton bloom-skeleton--wave",
    none: "bloom-skeleton",
  };

  return (
    <div
      className={cn(
        "block",
        variantClasses[variant],
        animationClasses[animation],
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
