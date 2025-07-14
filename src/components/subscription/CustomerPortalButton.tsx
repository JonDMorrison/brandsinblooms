
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// Removed sonner import - using global toast replacement

interface CustomerPortalButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export const CustomerPortalButton = ({ 
  variant = 'default', 
  size = 'default',
  className 
}: CustomerPortalButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) {
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL received');
      }
    } catch (error) {
      console.error('Error accessing customer portal:', error);
      toast.error('Failed to access billing portal. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleManageSubscription}
      disabled={loading}
      variant={variant}
      size={size}
      className={className}
    >
      <CreditCard className="h-4 w-4 mr-2" />
      {loading ? 'Loading...' : 'Manage Billing'}
      <ExternalLink className="h-3 w-3 ml-1" />
    </Button>
  );
};
