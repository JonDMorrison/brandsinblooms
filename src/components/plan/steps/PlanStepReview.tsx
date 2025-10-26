import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Mail, MessageSquare, Facebook, Instagram, AlertTriangle, Rocket, ChevronDown, ChevronUp, Settings, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { usePlanWizard } from '../PlanWizardContext';
import { useTwilioSetup } from '@/components/dashboard/TwilioSetupChecker';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useSenderConfiguration } from '@/hooks/useSenderConfiguration';
import { useNavigate } from 'react-router-dom';
import { AudienceTargetingSection } from '../AudienceTargetingSection';
import { BlogContentViewer } from '../BlogContentViewer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface PlanStepReviewProps {
  onBack: () => void;
  onLaunch: () => void;
  isLaunching?: boolean;
}

const typeConfig = {
  email: { icon: Mail, color: 'bg-primary', label: 'Email' },
  sms: { icon: MessageSquare, color: 'bg-primary', label: 'SMS' },
  facebook: { icon: Facebook, color: 'bg-primary', label: 'Facebook' },
  instagram: { icon: Instagram, color: 'bg-primary', label: 'Instagram' },
  blog: { icon: FileText, color: 'bg-primary', label: 'Blog' }
};

export const PlanStepReview: React.FC<PlanStepReviewProps> = ({ 
  onBack, 
  onLaunch, 
  isLaunching = false 
}) => {
  const { state } = usePlanWizard();
  const { data: twilioData } = useTwilioSetup();
  const { senderConfig } = useSenderConfiguration();
  const { data: dashboardData } = useDashboardData();
  const navigate = useNavigate();
  
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());

  const enabledItems = state.items.filter(item => item.enabled);
  
  // Group items by type
  const itemsByType = enabledItems.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, typeof state.items>);

  // Check guardrails
  const isTwilioConnected = twilioData?.isSetup || false;
  const isDomainVerified = senderConfig.isVerified;
  
  const emailItems = itemsByType.email || [];
  const smsItems = itemsByType.sms || [];
  const socialItems = [...(itemsByType.facebook || []), ...(itemsByType.instagram || [])];
  const blogItems = itemsByType.blog || [];

  const hasBlockedEmail = emailItems.length > 0 && !isDomainVerified;
  const hasBlockedSMS = smsItems.length > 0 && !isTwilioConnected;
  const hasAnyContent = enabledItems.length > 0;

  const monthName = state.month ? format(new Date(state.month), 'MMMM yyyy') : '';
  
  const toggleChannelExpansion = (channel: string) => {
    const newExpanded = new Set(expandedChannels);
    if (newExpanded.has(channel)) {
      newExpanded.delete(channel);
    } else {
      newExpanded.add(channel);
    }
    setExpandedChannels(newExpanded);
  };

  const formatDateRange = (date: Date) => {
    const day = date.getDate();
    if (day <= 10) return `Early ${format(date, 'MMM')}`;
    if (day <= 20) return `Mid ${format(date, 'MMM')}`;
    return `Late ${format(date, 'MMM')}`;
  };

  const truncateTitle = (title: string, maxLength: number = 45) => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength).trim() + '...';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <CheckCircle className="h-8 w-8 text-green-600" />
          <h2 className="text-3xl font-bold">Review Your Plan</h2>
        </div>
        <p className="text-muted-foreground text-lg">
          Your multi-theme marketing plan for {monthName} is ready to launch.
        </p>
      </div>

      {/* Plan Overview */}
      <Card className="bg-gradient-to-br from-accent/5 to-primary/5 border-accent/20">
        <CardHeader>
          <CardTitle className="text-lg">Plan Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {state.themes.map((theme, index) => {
              const themeItems = enabledItems.filter(item => item.themeId === theme.id);
              const emailCount = themeItems.filter(item => item.type === 'email').length;
              const smsCount = themeItems.filter(item => item.type === 'sms').length; 
              const socialCount = themeItems.filter(item => ['facebook', 'instagram'].includes(item.type)).length;
              const blogCount = themeItems.filter(item => item.type === 'blog').length;
              
              const emailReady = !hasBlockedEmail;
              const smsReady = !hasBlockedSMS;
              
              return (
                <div 
                  key={theme.id} 
                  className={`p-4 rounded-lg border ${
                    index === 0 
                      ? 'bg-primary/5 border-primary/30' 
                      : 'bg-background/50 border-border'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="font-medium">{theme.label}</h4>
                    {index === 0 && <Badge variant="outline" className="text-xs">Primary</Badge>}
                  </div>
                  <div className="space-y-2 text-sm">
                    {emailCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span>📧 {emailCount} Email{emailCount > 1 ? 's' : ''}</span>
                        <Badge variant={emailReady ? "outline" : "destructive"} className="text-xs">
                          {emailReady ? "✅" : "⚠️"}
                        </Badge>
                      </div>
                    )}
                    {smsCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span>💬 {smsCount} SMS</span>
                        <Badge variant={smsReady ? "outline" : "destructive"} className="text-xs">
                          {smsReady ? "✅" : "⚠️"}
                        </Badge>
                      </div>
                    )}
                    {socialCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span>📱 {socialCount} Social</span>
                        <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                          ✅
                        </Badge>
                      </div>
                    )}
                     {blogCount > 0 && (
                       <div className="flex items-center justify-between">
                         <span>📝 {blogCount} Blog</span>
                         <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                              ✅
                            </Badge>
                            {themeItems.some(item => item.type === 'blog' && item.enhancedContent) && (
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-8 px-3 text-xs gap-2">
                                    <FileText className="h-4 w-4" />
                                    View Full Blog ({themeItems.find(item => item.type === 'blog' && item.enhancedContent)?.enhancedContent?.readingTime})
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
                                  <DialogHeader>
                                    <DialogTitle>Blog Content Preview</DialogTitle>
                                  </DialogHeader>
                                  <BlogContentViewer 
                                    blogItem={themeItems.find(item => item.type === 'blog' && item.enhancedContent)!}
                                  />
                                </DialogContent>
                              </Dialog>
                            )}
                         </div>
                       </div>
                     )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-center py-4 bg-background/30 rounded-lg border">
            <div className="text-lg font-semibold">Total: {enabledItems.length} items scheduled</div>
          </div>
        </CardContent>
      </Card>

      {/* Audience Targeting */}
      <AudienceTargetingSection />

      {/* Channel Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Email Channel */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <Mail className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Email</CardTitle>
                  <div className="text-sm text-muted-foreground">{emailItems.length} items</div>
                </div>
              </div>
              {hasBlockedEmail ? (
                <Badge variant="destructive" className="text-xs">
                  ⚠️ Setup Required
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  ✅ Ready
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              {emailItems.slice(0, expandedChannels.has('email') ? emailItems.length : 2).map(item => (
                <div key={item.id} className="p-3 bg-muted/30 rounded-lg border-l-2 border-primary">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-primary font-medium mb-1">
                      {formatDateRange(item.date)}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-foreground line-clamp-2">
                    {truncateTitle(item.title)}
                  </div>
                </div>
              ))}
              {emailItems.length > 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleChannelExpansion('email')}
                  className="w-full h-8 text-xs text-muted-foreground hover:bg-muted/50"
                >
                  {expandedChannels.has('email') ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      +{emailItems.length - 2} more
                    </>
                  )}
                </Button>
              )}
            </div>
            {hasBlockedEmail && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings/email')}
                className="w-full text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                Fix Now
              </Button>
            )}
          </CardContent>
        </Card>

        {/* SMS Channel */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">SMS</CardTitle>
                  <div className="text-sm text-muted-foreground">{smsItems.length} items</div>
                </div>
              </div>
              {hasBlockedSMS ? (
                <Badge variant="destructive" className="text-xs">
                  ⚠️ Setup Required
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                  ✅ Ready
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              {smsItems.slice(0, expandedChannels.has('sms') ? smsItems.length : 2).map(item => (
                <div key={item.id} className="p-3 bg-muted/30 rounded-lg border-l-2 border-primary">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-primary font-medium mb-1">
                      {formatDateRange(item.date)}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-foreground line-clamp-2">
                    {truncateTitle(item.title)}
                  </div>
                </div>
              ))}
              {smsItems.length > 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleChannelExpansion('sms')}
                  className="w-full h-8 text-xs text-muted-foreground hover:bg-muted/50"
                >
                  {expandedChannels.has('sms') ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      +{smsItems.length - 2} more
                    </>
                  )}
                </Button>
              )}
            </div>
            {hasBlockedSMS && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/settings/sms')}
                className="w-full text-xs"
              >
                <Settings className="h-3 w-3 mr-1" />
                Fix Now
              </Button>
            )}
            {smsItems.length > 0 && hasBlockedSMS && (
              <div className="text-xs text-muted-foreground">
                Items in this channel will be skipped until setup is complete.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Social Channel */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <Facebook className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Social</CardTitle>
                  <div className="text-sm text-muted-foreground">{socialItems.length} items</div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                ✅ Ready
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              {socialItems.slice(0, expandedChannels.has('social') ? socialItems.length : 2).map(item => (
                <div key={item.id} className="p-3 bg-muted/30 rounded-lg border-l-2 border-primary">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-primary font-medium mb-1">
                      {formatDateRange(item.date)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.type === 'facebook' ? '📘' : '📷'}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-foreground line-clamp-2">
                    {truncateTitle(item.title)}
                  </div>
                </div>
              ))}
              {socialItems.length > 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleChannelExpansion('social')}
                  className="w-full h-8 text-xs text-muted-foreground hover:bg-muted/50"
                >
                  {expandedChannels.has('social') ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      +{socialItems.length - 2} more
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Blog Channel */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Blog</CardTitle>
                  <div className="text-sm text-muted-foreground">{blogItems.length} items</div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                ✅ Ready
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-3">
              {blogItems.slice(0, expandedChannels.has('blog') ? blogItems.length : 2).map(item => (
                 <div key={item.id} className="p-3 bg-muted/30 rounded-lg border-l-2 border-primary">
                   <div className="flex items-center justify-between mb-2">
                     <div className="text-xs text-primary font-medium">
                       {formatDateRange(item.date)}
                     </div>
                     {item.enhancedContent && (
                       <Dialog>
                         <DialogTrigger asChild>
                           <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
                             <FileText className="h-3 w-3" />
                             Preview
                           </Button>
                         </DialogTrigger>
                         <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
                           <DialogHeader>
                             <DialogTitle>Blog Content Preview</DialogTitle>
                           </DialogHeader>
                           <BlogContentViewer blogItem={item} />
                         </DialogContent>
                       </Dialog>
                     )}
                   </div>
                   <div className="text-sm font-medium text-foreground line-clamp-2">
                     {truncateTitle(item.title)}
                   </div>
                 </div>
               ))}
                {blogItems.length > 2 && (
                 <Button
                   variant="ghost"
                   size="sm"
                   onClick={() => toggleChannelExpansion('blog')}
                   className="w-full h-8 text-xs text-muted-foreground hover:bg-muted/50"
                 >
                   {expandedChannels.has('blog') ? (
                     <>
                       <ChevronUp className="h-3 w-3 mr-1" />
                       Show Less
                     </>
                   ) : (
                     <>
                       <ChevronDown className="h-3 w-3 mr-1" />
                       +{blogItems.length - 2} more
                     </>
                   )}
                 </Button>
               )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Launch Section */}
      <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20 mt-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="font-semibold">✅ Plan Ready to Launch</div>
                <div className="text-sm text-muted-foreground">
                  {enabledItems.length} items will be scheduled. No content is sent immediately.
                </div>
              </div>
            </div>
            <Button 
              onClick={onLaunch} 
              disabled={!hasAnyContent || isLaunching}
              size="lg" 
              className="px-8 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              {isLaunching ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Rocket className="h-4 w-4 mr-2" />
                  Launch My Plan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button variant="outline" onClick={onBack} size="lg" className="px-8" disabled={isLaunching}>
          Back
        </Button>
      </div>
    </div>
  );
};