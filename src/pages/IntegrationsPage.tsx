import { IntegrationHub } from "@/components/integrations/IntegrationHub";
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const IntegrationsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");

    if (connected === "lightspeed") {
      toast({ title: "Lightspeed connected successfully" });
      queryClient.invalidateQueries({ queryKey: ["lightspeed-connection"] });
      // Clear the query params
      setSearchParams({});
    } else if (error) {
      toast({ 
        title: "Connection failed", 
        description: decodeURIComponent(error),
        variant: "destructive" 
      });
      // Clear the query params
      setSearchParams({});
    }
  }, [searchParams, toast, queryClient, setSearchParams]);

  return (
    <div className="py-6">
      <IntegrationHub />
    </div>
  );
};

export default IntegrationsPage;