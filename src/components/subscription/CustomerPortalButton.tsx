
import { useMemo, useState } from "react";
import Button from "@mui/joy/Button";
import { CreditCard, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomerPortalButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "sm" | "default" | "lg";
  className?: string;
}

const variantMap = {
  default: "solid",
  outline: "outlined",
  ghost: "plain",
} as const;

const sizeMap = {
  sm: "sm",
  default: "md",
  lg: "lg",
} as const;

export const CustomerPortalButton = ({
  variant = "default",
  size = "default",
  className,
}: CustomerPortalButtonProps) => {
  const [loading, setLoading] = useState(false);
  const resolvedVariant = useMemo(() => variantMap[variant], [variant]);
  const resolvedSize = useMemo(() => sizeMap[size], [size]);

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No portal URL received");
      }
    } catch (error) {
      console.error("Error accessing customer portal:", error);
      toast.error("Failed to access billing portal. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      className={className}
      color="neutral"
      endDecorator={<ExternalLink size={14} />}
      loading={loading}
      onClick={handleManageSubscription}
      size={resolvedSize}
      startDecorator={<CreditCard size={16} />}
      variant={resolvedVariant}
    >
      Manage Billing
    </Button>
  );
};
