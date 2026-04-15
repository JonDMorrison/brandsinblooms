import { UsageDashboard } from "@/components/subscription/UsageDashboard";
import { UsageWarningBanner } from "@/components/subscription/UsageWarningBanner";
import { UsageAlertSettings } from "@/components/settings/UsageAlertSettings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-legacy/tabs";
import { BarChart3, Settings } from "lucide-react";

const UsagePage = () => {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <UsageWarningBanner dismissible={false} />
      
      <Tabs defaultValue="usage" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Usage Overview
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Alert Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="usage" className="mt-6">
          <UsageDashboard />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <UsageAlertSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default UsagePage;
