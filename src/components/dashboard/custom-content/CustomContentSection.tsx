import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Clock, Calendar, Target, Users, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { toast } from '@/utils/toast';
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { NewCampaignModal } from "@/components/homepage/NewCampaignModal";

interface CustomContentSectionProps {
  userCreatedCampaigns: any[];
  onContentGenerated?: () => void;
  onCampaignUpdate?: () => void;
  className?: string;
}

export const CustomContentSection = ({
  userCreatedCampaigns,
  onContentGenerated,
  onCampaignUpdate,
  className
}: CustomContentSectionProps) => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [showCustomCampaignModal, setShowCustomCampaignModal] = useState(false);

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('campaigns')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });

        if (tenant?.id) {
          query = query.eq('tenant_id', tenant.id);
        } else {
          query = query.is('tenant_id', null);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error fetching campaigns:", error);
          toast.error("Failed to load campaigns.");
        } else {
          setCampaigns(data || []);
        }
      } catch (error) {
        console.error("Unexpected error fetching campaigns:", error);
        toast.error("Failed to load campaigns due to an unexpected error.");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchCampaigns();
    }
  }, [user, tenant]);

  const toggleCampaignExpansion = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId);
      } else {
        newSet.add(campaignId);
      }
      return newSet;
    });
  };

  const formatDate = (dateStr: string): string => {
    try {
      return format(new Date(dateStr), 'MMMM d, yyyy');
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Invalid Date";
    }
  };

  const handleCustomCampaignClick = () => {
    console.log('🔍 Custom Campaign button clicked');
    console.log('🔍 Current showCustomCampaignModal state:', showCustomCampaignModal);
    setShowCustomCampaignModal(true);
    console.log('🔍 Setting showCustomCampaignModal to true');
  };

  const handleNewCampaignCreate = () => {
    console.log('🔍 New campaign created, closing modal');
    setShowCustomCampaignModal(false);
    if (onCampaignUpdate) {
      onCampaignUpdate();
    }
  };

  const handleModalOpenChange = (open: boolean) => {
    console.log('🔍 Modal open change:', open);
    setShowCustomCampaignModal(open);
  };

  const shouldShowEmptyState = !loading && campaigns.length === 0;

  if (shouldShowEmptyState) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">Your Custom Content</h2>
        </div>
        
        <Card className="bg-white border-gray-200">
          <CardContent className="p-8 text-center">
            <div className="flex flex-col items-center space-y-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Your Custom Content Goes Here</h3>
                <p className="text-muted-foreground max-w-md">
                  When you create a new campaign or event, this is where your content goes. 
                  Highlight your garden center's special events, promotions, or seasonal specials.
                </p>
              </div>
              <button
                onClick={handleCustomCampaignClick}
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Custom Campaign
              </button>
              <p className="text-xs text-muted-foreground">
                Perfect for promoting sales, workshops, new arrivals, or community events
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Debug info */}
        <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
          Debug: showCustomCampaignModal = {showCustomCampaignModal.toString()}
        </div>

        {/* New Campaign Modal */}
        <NewCampaignModal 
          open={showCustomCampaignModal} 
          onOpenChange={handleModalOpenChange} 
          onCampaignCreated={handleNewCampaignCreate} 
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-foreground">Your Custom Content</h2>
        <Button onClick={handleCustomCampaignClick} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      <div className="space-y-4">
        {campaigns.map(campaign => (
          <Collapsible 
            key={campaign.id} 
            open={expandedCampaigns.has(campaign.id)} 
            onOpenChange={() => toggleCampaignExpansion(campaign.id)}
          >
            <Card className="bg-white border-gray-200">
              <CardHeader className="px-4 py-3 flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">{campaign.title}</CardTitle>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    {expandedCampaigns.has(campaign.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent className="pl-4 pr-2">
                <CardContent className="py-2 space-y-2">
                  <div className="text-sm text-muted-foreground">{campaign.description}</div>
                  <Separator />
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Start Date: {formatDate(campaign.start_date)}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Theme: {campaign.theme || 'Not specified'}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Created: {format(new Date(campaign.created_at), 'MMMM d, yyyy')}</span>
                  </div>
                  {campaign.tenant_id && (
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tenant ID: {campaign.tenant_id}</span>
                    </div>
                  )}
                  <div className="flex justify-end pt-4">
                    <Button variant="outline" size="sm" onClick={() => toggleCampaignExpansion(campaign.id)}>
                      Manage Content
                    </Button>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>

      <NewCampaignModal
        open={showCustomCampaignModal}
        onOpenChange={handleModalOpenChange}
        onCampaignCreated={handleNewCampaignCreate}
      />
    </div>
  );
};
