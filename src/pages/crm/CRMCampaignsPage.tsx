import React, { useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Plus, Calendar, BarChart3, Eye } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useAuth } from '@/contexts/AuthContext';

export const CRMCampaignsPage: React.FC = () => {
  const { campaigns, loading, fetchCampaigns } = useCampaigns();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchCampaigns(user.id);
    }
  }, [user, fetchCampaigns]);

  // Separate user campaigns from templates
  const userCampaigns = campaigns.filter(c => c.source === 'quick_action' || c.prompt);
  const templateCampaigns = campaigns.filter(c => c.source !== 'quick_action' && !c.prompt);

  const activeCampaigns = userCampaigns.filter(c => c.status === 'active' || c.status === 'sent').length;
  const scheduledCampaigns = userCampaigns.filter(c => c.status === 'scheduled').length;
  const draftCampaigns = userCampaigns.filter(c => c.status === 'draft' || !c.status).length;

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
          {userCampaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Your Campaigns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userCampaigns.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h3 className="font-semibold">{campaign.title}</h3>
                        <p className="text-sm text-muted-foreground">{campaign.description || campaign.prompt}</p>
                        <p className="text-xs text-muted-foreground">
                          Created: {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                          Your Campaign
                        </span>
                        <Button variant="outline" size="sm" asChild>
                          <NavLink to={`/crm/campaigns/${campaign.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </NavLink>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {templateCampaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Seasonal Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Pre-built seasonal campaign templates to inspire your marketing
                  </p>
                  {templateCampaigns.map((template) => (
                    <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                      <div>
                        <h3 className="font-semibold">{template.title}</h3>
                        <p className="text-sm text-muted-foreground">{template.theme}</p>
                        {template.start_date && (
                          <p className="text-xs text-muted-foreground">
                            Start date: {new Date(template.start_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-secondary">
                          Week {template.week_number}
                        </span>
                        <Button variant="outline" size="sm" asChild>
                          <NavLink to={`/crm/campaigns/${template.id}`}>
                            <Eye className="h-4 w-4 mr-1" />
                            Preview
                          </NavLink>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          
          {userCampaigns.length === 0 && (
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
    </div>
  );
};