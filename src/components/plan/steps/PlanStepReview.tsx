import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Mail, MessageSquare, Facebook, Instagram, AlertTriangle, Rocket, ChevronDown, ChevronUp, Settings, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { usePlanWizard } from '../PlanWizardContext';
import { useTwilioSetup } from '@/components/dashboard/TwilioSetupChecker';
import { useDashboardData } from '@/hooks/useDashboardData';
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
  email: { icon: Mail, color: 'bg-blue-500', label: 'Email' },
  sms: { icon: MessageSquare, color: 'bg-green-500', label: 'SMS' },
  facebook: { icon: Facebook, color: 'bg-blue-600', label: 'Facebook' },
  instagram: { icon: Instagram, color: 'bg-pink-500', label: 'Instagram' },
  blog: { icon: FileText, color: 'bg-purple-500', label: 'Blog' }
};

export const PlanStepReview: React.FC<PlanStepReviewProps> = ({ 
  onBack, 
  onLaunch, 
  isLaunching = false 
}) => {
  const { state } = usePlanWizard();
  const { data: twilioData } = useTwilioSetup();
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
  const isDomainVerified = dashboardData?.socialConnections?.some(conn => conn.platform === 'email') || false;
  
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
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                          ✅
                        </Badge>
                      </div>
                    )}
                     {blogCount > 0 && (
                       <div className="flex items-center justify-between">
                         <span>📝 {blogCount} Blog</span>
                         <div className="flex items-center gap-2">
                           <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                             ✅
                           </Badge>
                           {themeItems.some(item => item.type === 'blog' && item.enhancedContent) && (
                             <Dialog>
                               <DialogTrigger asChild>
                                 <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                                   <ExternalLink className="h-3 w-3 mr-1" />
                                   Preview
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
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
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
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  ✅ Ready
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {emailItems.slice(0, expandedChannels.has('email') ? emailItems.length : 3).map(item => (
                <div key={item.id} className="text-sm text-muted-foreground flex justify-between">
                  <span>{formatDateRange(item.date)} - {item.title}</span>
                </div>
              ))}
              {emailItems.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleChannelExpansion('email')}
                  className="w-full h-8 text-xs text-muted-foreground"
                >
                  {expandedChannels.has('email') ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      +{emailItems.length - 3} more
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
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
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
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                  ✅ Ready
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {smsItems.slice(0, expandedChannels.has('sms') ? smsItems.length : 3).map(item => (
                <div key={item.id} className="text-sm text-muted-foreground flex justify-between">
                  <span>{formatDateRange(item.date)} - {item.title}</span>
                </div>
              ))}
              {smsItems.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleChannelExpansion('sms')}
                  className="w-full h-8 text-xs text-muted-foreground"
                >
                  {expandedChannels.has('sms') ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      +{smsItems.length - 3} more
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
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-pink-500 rounded-full flex items-center justify-center">
                  <Facebook className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Social</CardTitle>
                  <div className="text-sm text-muted-foreground">{socialItems.length} items</div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                ✅ Ready
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {socialItems.slice(0, expandedChannels.has('social') ? socialItems.length : 3).map(item => (
                <div key={item.id} className="text-sm text-muted-foreground flex justify-between">
                  <span>{formatDateRange(item.date)} - {item.title}</span>
                </div>
              ))}
              {socialItems.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleChannelExpansion('social')}
                  className="w-full h-8 text-xs text-muted-foreground"
                >
                  {expandedChannels.has('social') ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      +{socialItems.length - 3} more
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
                <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base">Blog</CardTitle>
                  <div className="text-sm text-muted-foreground">{blogItems.length} items</div>
                </div>
              </div>
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                ✅ Ready
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              {blogItems.slice(0, expandedChannels.has('blog') ? blogItems.length : 3).map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {formatDateRange(item.date)} - {item.title}
                  </span>
                  {item.enhancedContent && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
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
              ))}
              {blogItems.length > 3 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleChannelExpansion('blog')}
                  className="w-full h-8 text-xs text-muted-foreground"
                >
                  {expandedChannels.has('blog') ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      +{blogItems.length - 3} more
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-8">
        <Button variant="outline" onClick={onBack} size="lg" className="px-8" disabled={isLaunching}>
          Back
        </Button>
      </div>
      
      {/* Sticky Footer - Ready to Launch */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-4 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
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
            className="px-8 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
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
      </div>
      
      {/* Spacer for sticky footer */}
      <div className="h-20"></div>
    </div>
  );
};