import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Search, 
  AlertTriangle, 
  RefreshCw, 
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Database,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { getCurrentWeekNumber, getWeekDateRange, getDateForWeek } from '@/utils/dateUtils';
import { MASTER_WEEKLY_THEMES } from '@/data/masterWeeklyThemes';

interface MasterTemplate {
  id: string;
  week_number: number;
  title: string;
  theme: string;
  seasonal_focus: string;
  content_ideas: string;
}

interface UserCampaign {
  id: string;
  week_number: number;
  title: string;
  theme?: string;
  start_date: string;
}

interface WeeklyThemesReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export const WeeklyThemesReferenceModal: React.FC<WeeklyThemesReferenceModalProps> = ({
  open,
  onOpenChange,
  onUpdate
}) => {
  const { toast } = useToast();
  const [masterTemplates, setMasterTemplates] = useState<MasterTemplate[]>([]);
  const [userCampaigns, setUserCampaigns] = useState<UserCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [fixingCampaignId, setFixingCampaignId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => void;
  }>({ open: false, title: '', description: '', action: () => {} });

  // Get current week for highlighting
  const currentWeek = getCurrentWeekNumber();

  // Admin check - simple email check (could be enhanced with proper role system)
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminActions, setShowAdminActions] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const adminEmails = ['jon@getclear.ca', 'jeff@brandsinblooms.com']; // Add your admin emails
        if (user && adminEmails.includes(user.email || '')) {
          setIsAdmin(true);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    };
    
    if (open) {
      checkAdminStatus();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch master templates
      const { data: templates, error: templatesError } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .order('week_number');

      if (templatesError) throw templatesError;

      // Fetch user campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from('campaigns')
        .select('id, week_number, title, theme, start_date')
        .order('week_number');

      if (campaignsError) throw campaignsError;

      setMasterTemplates(templates || []);
      setUserCampaigns(campaigns || []);
    } catch (error) {
      console.error('Error fetching themes data:', error);
      toast({
        title: "Error",
        description: "Failed to load themes data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter templates based on search term
  const filteredTemplates = masterTemplates.filter(template =>
    template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.theme.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.seasonal_focus.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Get week date range using dateUtils
  const getWeekDateRangeFormatted = (weekNumber: number) => {
    const { startDate, endDate } = getWeekDateRange(weekNumber, new Date().getFullYear());
    
    return {
      start: format(startDate, 'MMM d'),
      end: format(endDate, 'MMM d')
    };
  };

  // Check if a week has a mismatch
  const getWeekStatus = (masterTemplate: MasterTemplate) => {
    const userCampaign = userCampaigns.find(c => c.week_number === masterTemplate.week_number);
    
    if (!userCampaign) {
      return { type: 'missing', message: 'No campaign scheduled' };
    }

    const sanitizeTheme = (theme: string) => theme.replace(/\s*-\s*Week\s+\d+/i, '').trim();
    const masterTheme = sanitizeTheme(masterTemplate.theme);
    const userTheme = sanitizeTheme(userCampaign.theme || userCampaign.title);

    if (masterTheme.toLowerCase() !== userTheme.toLowerCase()) {
      return { 
        type: 'mismatch', 
        message: `"${userTheme}" should be "${masterTheme}"`,
        campaignId: userCampaign.id
      };
    }

    return { type: 'match', message: 'Aligned with master theme' };
  };

  // Fix campaign theme
  const handleFixCampaign = async (masterTemplate: MasterTemplate, campaignId: string) => {
    setFixingCampaignId(campaignId);
    
    try {
      const sanitizedTheme = masterTemplate.theme.replace(/\s*-\s*Week\s+\d+/i, '').trim();
      
      const { error } = await supabase
        .from('campaigns')
        .update({ 
          theme: masterTemplate.theme,
          title: sanitizedTheme,
          description: masterTemplate.content_ideas 
        })
        .eq('id', campaignId);

      if (error) throw error;

      toast({
        title: "Campaign Updated",
        description: `Campaign aligned with "${sanitizedTheme}" theme`,
      });

      // Refresh data
      await fetchData();
      onUpdate?.();
    } catch (error) {
      console.error('Error fixing campaign:', error);
      toast({
        title: "Error",
        description: "Failed to update campaign",
        variant: "destructive"
      });
    } finally {
      setFixingCampaignId(null);
    }
  };

  // Create missing campaign
  const handleCreateCampaign = async (masterTemplate: MasterTemplate) => {
    const { start } = getWeekDateRangeFormatted(masterTemplate.week_number);
    
    setConfirmDialog({
      open: true,
      title: "Create New Campaign",
      description: `Create a new campaign for Week ${masterTemplate.week_number} (${start}) with theme "${masterTemplate.theme}"?`,
      action: async () => {
        try {
          const weekStartDate = getDateForWeek(masterTemplate.week_number);
          const sanitizedTheme = masterTemplate.theme.replace(/\s*-\s*Week\s+\d+/i, '').trim();

          const { error } = await supabase
            .from('campaigns')
            .insert({
              week_number: masterTemplate.week_number,
              title: sanitizedTheme,
              theme: masterTemplate.theme,
              description: masterTemplate.content_ideas,
              start_date: format(weekStartDate, 'yyyy-MM-dd'),
              status: 'draft'
            });

          if (error) throw error;

          toast({
            title: "Campaign Created",
            description: `New campaign created for Week ${masterTemplate.week_number}`,
          });

          await fetchData();
          onUpdate?.();
        } catch (error) {
          console.error('Error creating campaign:', error);
          toast({
            title: "Error",
            description: "Failed to create campaign",
            variant: "destructive"
          });
        }
      }
    });
  };

  // Admin functions
  const exportCurrentMasterTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('master_campaign_templates')
        .select('*')
        .order('week_number');

      if (error) throw error;

      const csv = [
        ['week_number', 'title', 'theme', 'seasonal_focus', 'content_ideas', 'prompt'].join(','),
        ...(data || []).map(row => [
          row.week_number,
          `"${row.title}"`,
          `"${row.theme || ''}"`,
          `"${row.seasonal_focus || ''}"`,
          `"${row.content_ideas || ''}"`,
          `"${row.prompt || ''}"`
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `master-templates-backup-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Export Complete",
        description: `Exported ${data?.length || 0} master templates`,
      });
    } catch (error) {
      console.error('Error exporting templates:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export master templates",
        variant: "destructive"
      });
    }
  };

  const replaceMasterTemplates = async () => {
    setConfirmDialog({
      open: true,
      title: "Replace Master Templates",
      description: `This will replace all ${masterTemplates.length} existing master templates with ${MASTER_WEEKLY_THEMES.length} curated seasonal themes. Current templates will be exported first. Continue?`,
      action: async () => {
        try {
          setLoading(true);

          // First export current templates as backup
          await exportCurrentMasterTemplates();

          // Delete existing master templates
          const { error: deleteError } = await supabase
            .from('master_campaign_templates')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

          if (deleteError) throw deleteError;

          // Insert curated templates
          const { error: insertError } = await supabase
            .from('master_campaign_templates')
            .insert(MASTER_WEEKLY_THEMES);

          if (insertError) throw insertError;

          toast({
            title: "Master Templates Updated",
            description: `Successfully replaced with ${MASTER_WEEKLY_THEMES.length} curated seasonal themes`,
          });

          // Refresh data
          await fetchData();
          onUpdate?.();
        } catch (error) {
          console.error('Error replacing templates:', error);
          toast({
            title: "Update Failed",
            description: "Failed to update master templates",
            variant: "destructive"
          });
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const getStatusIcon = (status: ReturnType<typeof getWeekStatus>) => {
    switch (status.type) {
      case 'match':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'mismatch':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'missing':
        return <XCircle className="h-4 w-4 text-red-600" />;
    }
  };

  const getStatusColor = (status: ReturnType<typeof getWeekStatus>) => {
    switch (status.type) {
      case 'match':
        return 'bg-green-50 border-green-200';
      case 'mismatch':
        return 'bg-yellow-50 border-yellow-200';
      case 'missing':
        return 'bg-red-50 border-red-200';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Weekly Themes Reference</DialogTitle>
            <DialogDescription>
              View all 52 master campaign themes and compare them with your scheduled campaigns.
              Fix mismatches or create missing campaigns with one click.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Admin Actions */}
            {isAdmin && (
              <div className="border-b pb-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-orange-600" />
                  <span className="font-medium text-orange-800">Admin Actions</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdminActions(!showAdminActions)}
                    className="ml-auto"
                  >
                    {showAdminActions ? 'Hide' : 'Show'}
                  </Button>
                </div>
                
                {showAdminActions && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportCurrentMasterTemplates}
                      className="flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" />
                      Export Current
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={replaceMasterTemplates}
                      className="flex items-center gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                      disabled={loading}
                    >
                      <Database className="h-3 w-3" />
                      Replace with Curated Themes
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search themes by title, theme, or seasonal focus..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {masterTemplates.filter(t => getWeekStatus(t).type === 'match').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Aligned</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {masterTemplates.filter(t => getWeekStatus(t).type === 'mismatch').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Mismatched</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {masterTemplates.filter(t => getWeekStatus(t).type === 'missing').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Missing</div>
                </CardContent>
              </Card>
            </div>

            {/* Themes List */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                    <p>Loading themes...</p>
                  </div>
                ) : (
                  filteredTemplates.map((template) => {
                    const status = getWeekStatus(template);
                    const dateRange = getWeekDateRangeFormatted(template.week_number);
                    const isCurrentWeek = template.week_number === currentWeek;

                    return (
                      <Card key={template.id} className={`${getStatusColor(status)} ${isCurrentWeek ? 'ring-2 ring-blue-500' : ''}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">Week {template.week_number}</Badge>
                                <Badge variant="secondary">{dateRange.start} - {dateRange.end}</Badge>
                                {isCurrentWeek && (
                                  <Badge className="bg-blue-600 text-white">
                                    <Clock className="h-3 w-3 mr-1" />
                                    Current Week
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="space-y-1">
                                <h4 className="font-semibold text-lg">{template.title}</h4>
                                <p className="text-primary font-medium">{template.theme}</p>
                                <p className="text-sm text-muted-foreground">{template.seasonal_focus}</p>
                                
                                <div className="flex items-center gap-2 mt-2">
                                  {getStatusIcon(status)}
                                  <span className="text-sm">{status.message}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              {status.type === 'mismatch' && status.campaignId && (
                                <Button
                                  size="sm"
                                  onClick={() => handleFixCampaign(template, status.campaignId)}
                                  disabled={fixingCampaignId === status.campaignId}
                                  className="min-w-[80px]"
                                >
                                  {fixingCampaignId === status.campaignId ? (
                                    <RefreshCw className="h-3 w-3 animate-spin" />
                                  ) : (
                                    'Fix Theme'
                                  )}
                                </Button>
                              )}
                              
                              {status.type === 'missing' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCreateCampaign(template)}
                                  className="min-w-[80px]"
                                >
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Create
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText="Create Campaign"
        onConfirm={() => {
          confirmDialog.action();
          setConfirmDialog(prev => ({ ...prev, open: false }));
        }}
      />
    </>
  );
};