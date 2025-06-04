
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
}

interface CalendarViewProps {
  campaigns: Campaign[];
}

export const CalendarView = ({ campaigns }: CalendarViewProps) => {
  const groupedCampaigns = campaigns.reduce((acc, campaign) => {
    const week = `Week ${campaign.week_number}`;
    if (!acc[week]) acc[week] = [];
    acc[week].push(campaign);
    return acc;
  }, {} as Record<string, Campaign[]>);

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {Object.entries(groupedCampaigns).map(([week, weekCampaigns]) => (
          <Card key={week} className="border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Calendar className="w-5 h-5" />
                {week}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid gap-3">
                {weekCampaigns.map((campaign) => (
                  <div 
                    key={campaign.id}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200 hover:shadow-sm transition-shadow"
                  >
                    <div>
                      <h4 className="font-medium text-gray-800">{campaign.title}</h4>
                      <p className="text-sm text-gray-600">
                        Starting {new Date(campaign.start_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        Active
                      </Badge>
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
