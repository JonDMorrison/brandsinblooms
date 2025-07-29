import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Plus, Calendar, BarChart3, Eye, Trash2 } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { useToast } from '@/hooks/use-toast';

export const CRMCampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchCRMCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching CRM campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (campaign: any) => {
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!campaignToDelete) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('crm_campaigns')
        .delete()
        .eq('id', campaignToDelete.id);

      if (error) throw error;

      setCampaigns(campaigns.filter(c => c.id !== campaignToDelete.id));
      toast({
        title: "Campaign deleted",
        description: `${campaignToDelete.name} has been deleted successfully.`,
      });
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    } catch (error) {
      console.error('Error deleting campaign:', error);
      toast({
        title: "Error deleting campaign",
        description: "There was an error deleting the campaign. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCRMCampaigns();
    }
  }, [user]);

  const activeCampaigns = campaigns.filter(c => c.status === 'active' || c.status === 'sent').length;
  const scheduledCampaigns = campaigns.filter(c => c.status === 'scheduled').length;
  const draftCampaigns = campaigns.filter(c => c.status === 'draft' || !c.status).length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Campaigns</h1>
        <Button asChild>
          <NavLink to="/crm/campaigns/new">
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </NavLink>
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Campaigns</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              Running campaigns
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              Campaigns scheduled
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Campaigns</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{draftCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              In progress
            </p>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-6">
            <p>Loading campaigns...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Your CRM Campaigns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {campaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">{campaign.name}</h3>
                        <p className="text-sm text-muted-foreground">{campaign.subject_line}</p>
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                        <span className={`inline-block text-xs px-2 py-1 rounded mt-1 ${
                          campaign.status === 'draft' 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : campaign.status === 'sent' 
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {campaign.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <NavLink to={`/crm/campaigns/${campaign.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            Edit
                          </NavLink>
                        </Button>
                        {campaign.status === 'draft' && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleDeleteClick(campaign)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {campaigns.length === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Campaign Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Create, manage, and track your email marketing campaigns. Build engaging newsletters, promotional emails, and automated sequences.
                  </p>
                  <Button asChild variant="outline">
                    <NavLink to="/crm/campaigns/new">
                      Get Started with Your First Campaign
                    </NavLink>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Campaign"
        description={`Are you sure you want to delete "${campaignToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        loading={isDeleting}
      />
    </div>
  );
};