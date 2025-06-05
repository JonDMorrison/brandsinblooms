
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Palette } from "lucide-react";
import { EditableTheme } from "./calendar/EditableTheme";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
}

interface Task {
  id: string;
  scheduled_date: string;
  post_type: string;
  status: string;
  campaigns?: {
    title: string;
  };
}

interface CalendarViewProps {
  campaigns: Campaign[];
  tasks?: Task[];
  onDataUpdate?: () => void;
}

export const CalendarView = ({ campaigns, tasks = [], onDataUpdate }: CalendarViewProps) => {
  const [localCampaigns, setLocalCampaigns] = useState(campaigns);

  // Update local campaigns when props change
  useState(() => {
    setLocalCampaigns(campaigns);
  });

  const groupedCampaigns = localCampaigns.reduce((acc, campaign) => {
    const week = `Week ${campaign.week_number}`;
    if (!acc[week]) acc[week] = [];
    acc[week].push(campaign);
    return acc;
  }, {} as Record<string, Campaign[]>);

  const handleThemeUpdate = (campaignId: string, newTheme: string) => {
    setLocalCampaigns(prev => 
      prev.map(campaign => 
        campaign.id.toString() === campaignId 
          ? { ...campaign, theme: newTheme }
          : campaign
      )
    );
    onDataUpdate?.();
  };

  return (
    <div className="space-y-6">
      {/* Weekly Content Themes */}
      <div className="grid gap-4">
        <h3 className="text-xl font-bold text-garden-green-dark flex items-center gap-2">
          <Palette className="w-6 h-6" />
          Weekly Content Themes
        </h3>
        {Object.entries(groupedCampaigns).map(([week, weekCampaigns]) => (
          <Card key={week} className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <CalendarIcon className="w-5 h-5" />
                {week}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-4">
                {weekCampaigns.map((campaign) => (
                  <div 
                    key={campaign.id}
                    className="p-4 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-800 mb-1">{campaign.title}</h4>
                        <p className="text-sm text-gray-500">
                          Starting {new Date(campaign.start_date).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        Active
                      </Badge>
                    </div>
                    
                    <div className="border-t pt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Palette className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Content Theme:</span>
                      </div>
                      <EditableTheme
                        campaignId={campaign.id.toString()}
                        currentTheme={campaign.theme || ""}
                        onThemeUpdate={(newTheme) => handleThemeUpdate(campaign.id.toString(), newTheme)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
