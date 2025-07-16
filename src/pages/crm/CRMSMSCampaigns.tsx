import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Plus, Search, Calendar, Users, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Link } from "react-router-dom";

interface SMSCampaign {
  id: string;
  name: string;
  message: string;
  status: string;
  created_at: string;
  scheduled_at: string | null;
  sent_at: string | null;
  segment_id: string | null;
  metrics: any;
  crm_segments?: {
    name: string;
  };
}

export default function CRMSMSCampaigns() {
  const [campaigns, setCampaigns] = useState<SMSCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_sms_campaigns")
        .select(`
          *,
          crm_segments (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error("Error fetching SMS campaigns:", error);
      toast({
        title: "Error",
        description: "Failed to load SMS campaigns",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      draft: "outline",
      scheduled: "secondary",
      sent: "default",
      failed: "destructive",
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const filteredCampaigns = campaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    campaign.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">SMS Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            Send promotional texts to your opted-in customers
          </p>
        </div>
        <Button asChild className="bg-primary hover:bg-primary/90">
          <Link to="/crm/sms-campaigns/new">
            <Plus className="h-4 w-4 mr-2" />
            Create SMS Campaign
          </Link>
        </Button>
      </div>

      <div className="flex items-center space-x-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No SMS Campaigns Found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "No campaigns match your search" : "Get started by creating your first SMS campaign"}
            </p>
            <Button asChild>
              <Link to="/crm/sms-campaigns/new">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First SMS Campaign
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{campaign.name}</CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      {campaign.crm_segments && (
                        <div className="flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          {campaign.crm_segments.name}
                        </div>
                      )}
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Created {format(new Date(campaign.created_at), "MMM d, yyyy")}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(campaign.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Message Preview</label>
                    <div className="mt-1 p-3 bg-muted rounded-lg">
                      <p className="text-sm">{campaign.message}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      {campaign.scheduled_at && (
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          Scheduled: {format(new Date(campaign.scheduled_at), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                      )}
                      {campaign.sent_at && (
                        <div className="flex items-center">
                          <Send className="h-4 w-4 mr-1" />
                          Sent: {format(new Date(campaign.sent_at), "MMM d, yyyy 'at' h:mm a")}
                        </div>
                      )}
                    </div>
                    
                    {campaign.metrics && (
                      <div className="flex items-center space-x-4 text-sm">
                        <span>Sent: {campaign.metrics.messages_sent || 0}</span>
                        <span>Delivered: {campaign.metrics.delivered || 0}</span>
                        <span>Failed: {campaign.metrics.failed || 0}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}