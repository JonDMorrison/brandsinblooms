import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui-legacy/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Badge } from "@/components/ui-legacy/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-legacy/tabs";
import {
  CheckCircle,
  PlusIcon,
  Send,
  SettingsIcon,
  Smartphone,
  Target,
  Zap,
} from "lucide-react";
import { useTwilioSetup } from "@/components/dashboard/TwilioSetupChecker";
import { useSMSStats } from "@/hooks/useSMSStats";
import { SMSStatCards } from "@/components/sms/SMSStatCards";
import { SMSCampaignsTable } from "@/components/sms/SMSCampaignsTable";
import { SMSRecentMessages } from "@/components/sms/SMSRecentMessages";
import { SMSQueueStatus } from "@/components/sms/SMSQueueStatus";
import { SMSQuickSend } from "@/components/sms/SMSQuickSend";
import { SMSSetupWizard } from "@/components/sms/SMSSetupWizard";
import { SendATextCard } from "@/components/sms/SendATextCard";
import { SendToSegmentCard } from "@/components/sms/SendToSegmentCard";

export default function SMSDashboard() {
  const navigate = useNavigate();
  const { data: twilioSetup } = useTwilioSetup();
  const { data: stats, isLoading, refetch } = useSMSStats();

  const statsData = stats || {
    subscribers: 0,
    subscribersGrowth: 0,
    credits: 0,
    creditsUsed: 0,
    deliverability: 0,
    deliverabilityGrowth: 0,
    clicks: 0,
    clicksGrowth: 0,
    queuedMessages: 0,
    recentCampaigns: [],
    recentMessages: [],
  };

  const handleCreateCampaign = () => {
    if (!twilioSetup?.isSetup) {
      navigate("/dashboard/integrations");
      return;
    }
    navigate("/sms/new");
  };

  const handleCardClick = (cardType: string) => {
    const targetId =
      {
        subscribers: "campaigns",
        credits: "actions",
        deliverability: "campaigns",
        clicks: "messages",
        queue: "queue",
      }[cardType] || "campaigns";

    const element = document.getElementById(targetId);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-[30px] border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 lg:py-7">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              SMS Campaigns
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-500 sm:text-base">
              Create, launch, and monitor SMS marketing from one polished
              command center.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {twilioSetup?.isSetup ? (
              <Badge className="h-10 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 hover:bg-emerald-50">
                <CheckCircle className="mr-2 h-4 w-4" />
                SMS Ready
              </Badge>
            ) : (
              <SMSSetupWizard
                trigger={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-xl border-gray-200 px-4 text-gray-700 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Setup Wizard
                  </Button>
                }
                onComplete={() => window.location.reload()}
              />
            )}
            <Button
              variant="outline"
              onClick={() => navigate("/sms/automations")}
              className="h-11 rounded-xl border-gray-300 px-5 text-gray-700 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-700"
            >
              <SettingsIcon className="h-4 w-4 mr-2" />
              Automations
            </Button>
            <Button
              onClick={handleCreateCampaign}
              className="h-11 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-sm hover:bg-emerald-700"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        </div>
      </section>

      {!twilioSetup?.isSetup && (
        <Card className="rounded-[28px] border-amber-200 bg-amber-50 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-amber-950">
              <Smartphone className="h-5 w-5" />
              <span>SMS Setup Required</span>
            </CardTitle>
            <CardDescription className="text-amber-800">
              Complete SMS setup to start creating campaigns
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <SMSSetupWizard
              trigger={
                <Button className="rounded-xl bg-amber-600 hover:bg-amber-700">
                  <Zap className="h-4 w-4 mr-2" />
                  Start Setup Wizard
                </Button>
              }
              onComplete={() => window.location.reload()}
            />
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard/integrations")}
            >
              Manual Setup
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <Card
              key={i}
              className="animate-pulse rounded-[24px] border border-gray-100"
            >
              <CardContent className="p-6">
                <div className="h-28 rounded-2xl bg-gray-100"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <SMSStatCards stats={statsData} onCardClick={handleCardClick} />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.95fr)] xl:items-start">
        <div className="space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              <Card className="animate-pulse rounded-[28px] border border-gray-100">
                <CardContent className="p-6">
                  <div className="h-48 rounded-3xl bg-gray-100"></div>
                </CardContent>
              </Card>
              <Card className="animate-pulse rounded-[28px] border border-gray-100">
                <CardContent className="p-6">
                  <div className="h-72 rounded-3xl bg-gray-100"></div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <SMSCampaignsTable
                campaigns={statsData.recentCampaigns}
                onCreateCampaign={handleCreateCampaign}
              />
              <SMSRecentMessages messages={statsData.recentMessages} />
            </>
          )}
        </div>

        <div className="space-y-6">
          <Card
            id="actions"
            className="rounded-[28px] border border-gray-100 bg-white shadow-sm"
          >
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold text-gray-900">
                Send & Test
              </CardTitle>
              <CardDescription className="text-sm text-gray-500">
                Keep sending tools close by without dominating the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs defaultValue="send-text" className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-gray-100 p-1.5">
                  <TabsTrigger
                    value="send-text"
                    className="gap-2 rounded-xl data-[state=active]:text-emerald-700"
                  >
                    <Send className="h-4 w-4" />
                    Send Text
                  </TabsTrigger>
                  <TabsTrigger
                    value="quick-send"
                    className="gap-2 rounded-xl data-[state=active]:text-emerald-700"
                  >
                    <Zap className="h-4 w-4" />
                    Quick Send
                  </TabsTrigger>
                  <TabsTrigger
                    value="segments"
                    className="gap-2 rounded-xl data-[state=active]:text-emerald-700"
                  >
                    <Target className="h-4 w-4" />
                    Segments
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="send-text" className="mt-4">
                  <SendATextCard onSent={() => refetch()} />
                </TabsContent>
                <TabsContent value="quick-send" className="mt-4">
                  <SMSQuickSend onSent={() => refetch()} />
                </TabsContent>
                <TabsContent value="segments" className="mt-4">
                  <SendToSegmentCard />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {isLoading ? (
            <Card className="animate-pulse rounded-[24px] border border-gray-100">
              <CardContent className="p-4">
                <div className="h-16 rounded-2xl bg-gray-100"></div>
              </CardContent>
            </Card>
          ) : (
            <SMSQueueStatus
              queuedMessages={statsData.queuedMessages}
              onRefresh={() => refetch()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
