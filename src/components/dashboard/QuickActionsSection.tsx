import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircle, Sparkles, Calendar, CalendarPlus } from "lucide-react";
import { useState } from "react";
import { NewCampaignDialog } from "@/components/homepage/NewCampaignDialog";
import { AddEventDialog } from "@/components/homepage/AddEventDialog";

interface QuickActionsSectionProps {
  onCampaignCreated: () => void;
}

export const QuickActionsSection = ({
  onCampaignCreated
}: QuickActionsSectionProps) => {
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const [showAddEventDialog, setShowAddEventDialog] = useState(false);

  const handleNewCampaignCreate = (newCampaign: any) => {
    setShowNewCampaignDialog(false);
    onCampaignCreated();
  };

  const handleEventCreated = () => {
    setShowAddEventDialog(false);
    onCampaignCreated();
  };

  const handleViewCalendar = () => {
    window.location.href = '/calendar';
  };

  const handleOpenPublishPortal = () => {
    window.location.href = '/publish';
  };

  const actionItems = [
    {
      id: 'new-campaign',
      icon: PlusCircle,
      title: 'Create Campaign',
      description: 'Build themed marketing campaigns',
      benefit: 'Get 5+ content pieces instantly',
      onClick: () => setShowNewCampaignDialog(true),
    },
    {
      id: 'add-event',
      icon: CalendarPlus,
      title: 'Promote Event',
      description: 'Get help marketing your events',
      benefit: 'Custom promotional content',
      onClick: () => setShowAddEventDialog(true),
    },
    {
      id: 'publish-portal',
      icon: Sparkles,
      title: 'Publish Portal',
      description: 'Schedule and publish your content',
      benefit: 'Professional social media management',
      onClick: handleOpenPublishPortal,
    },
    {
      id: 'view-calendar',
      icon: Calendar,
      title: 'Content Calendar',
      description: 'See your planned content schedule',
      benefit: "Preview what's coming this year",
      onClick: () => { window.location.href = '/calendar'; },
    }
  ];

  return (
    <div>
      <Card className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
        {/* Gradient Background Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60"></div>
        <div className="absolute inset-0 bg-black/5"></div>
        
        {/* Decorative Background Pattern */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-gradient-to-br from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 right-4 opacity-5">
            <Sparkles className="w-32 h-32 text-emerald-600" />
          </div>
        </div>
        
        <CardHeader className="relative z-10 pb-4">
          <CardTitle className="flex items-center gap-3 text-left text-2xl font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-600 bg-clip-text text-transparent tracking-tight">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10 space-y-3">
          {actionItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <div
                key={item.id}
                className="group w-full bg-white/50 backdrop-blur-sm border border-white/30 rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 hover:bg-white/70 hover:border-emerald-200/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
                onClick={item.onClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
              >
                <div className="flex items-start space-x-4 text-left">
                  <div className="relative group/icon">
                    <div className="flex-shrink-0 p-3 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 backdrop-blur-sm rounded-2xl group-hover:scale-110 transition-all duration-300 shadow-lg border border-white/30">
                      <IconComponent className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl blur-xl group-hover/icon:blur-lg transition-all duration-300"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0 space-y-1 text-left">
                    <h3 className="font-bold text-lg bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent tracking-tight">
                      {item.title}
                    </h3>
                    
                    <p className="text-slate-600 text-sm leading-relaxed">
                      {item.description}
                    </p>
                    
                    <p className="text-slate-500 text-xs leading-relaxed font-medium">
                      {item.benefit}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <NewCampaignDialog 
        open={showNewCampaignDialog} 
        onOpenChange={setShowNewCampaignDialog} 
        onCreate={handleNewCampaignCreate} 
      />

      <AddEventDialog 
        open={showAddEventDialog}
        onOpenChange={setShowAddEventDialog}
        onEventCreated={handleEventCreated}
      />
    </div>
  );
};
