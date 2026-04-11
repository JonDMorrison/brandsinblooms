import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Eye, MessageSquare, PlusIcon } from "lucide-react";
import { format } from "date-fns";
import type { SMSStats } from "@/hooks/useSMSStats";

interface SMSCampaignsTableProps {
  campaigns: SMSStats["recentCampaigns"];
  onCreateCampaign: () => void;
}

export const SMSCampaignsTable: React.FC<SMSCampaignsTableProps> = ({
  campaigns,
  onCreateCampaign,
}) => {
  const navigate = useNavigate();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="default">Sent</Badge>;
      case "sending":
        return <Badge className="bg-blue-100 text-blue-800">Sending</Badge>;
      case "scheduled":
        return <Badge variant="outline">Scheduled</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card
      id="campaigns"
      className="rounded-[28px] border border-gray-100 bg-white shadow-sm"
    >
      <CardHeader className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-xl font-semibold text-gray-900">
            Recent Campaigns
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            Your latest SMS marketing campaigns, delivery health, and quick
            actions.
          </CardDescription>
        </div>
        <Button
          onClick={onCreateCampaign}
          size="sm"
          variant="outline"
          className="h-10 rounded-xl border-gray-200 px-4 text-gray-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          New Campaign
        </Button>
      </CardHeader>
      <CardContent className="p-6">
        {campaigns.length === 0 ? (
          <div className="flex min-h-[176px] flex-col items-center justify-center rounded-[24px] border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-400 shadow-sm">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">
              No campaigns yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Create your first SMS campaign and start reaching customers
              faster.
            </p>
            <Button
              onClick={onCreateCampaign}
              className="mt-5 h-10 rounded-xl bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700"
            >
              Create Campaign
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const deliveryRate =
                campaign.sent > 0
                  ? Math.round((campaign.delivered / campaign.sent) * 100)
                  : 0;

              return (
                <div
                  key={campaign.id}
                  className="rounded-[22px] border border-gray-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                          <MessageSquare className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-base font-semibold text-gray-900">
                              {campaign.name}
                            </h3>
                            {getStatusBadge(campaign.status)}
                          </div>
                          <p className="text-sm text-gray-500">
                            Sent to {campaign.sent.toLocaleString()} subscribers
                            ·{" "}
                            {format(
                              new Date(campaign.created_at),
                              "MMM d, yyyy",
                            )}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs font-medium">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
                              {deliveryRate}% delivered
                            </span>
                            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">
                              {campaign.clicked.toLocaleString()} clicks
                            </span>
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                              {campaign.delivered.toLocaleString()} delivered
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 lg:pl-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 rounded-xl px-3 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        onClick={() => navigate(`/sms/${campaign.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
