
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserMenu } from "@/components/UserMenu";
import { LandingPage } from "@/components/LandingPage";

interface DashboardTabsProps {
  children: React.ReactNode;
}

export const DashboardTabs = ({ children }: DashboardTabsProps) => {
  return (
    <div className="min-h-screen bg-background">
      <Tabs defaultValue="app" className="w-full">
        <div className="border-b border-border bg-background px-6 py-2">
          <div className="flex justify-between items-center">
            <TabsList className="grid w-fit grid-cols-2">
              <TabsTrigger value="app">App View</TabsTrigger>
              <TabsTrigger value="landing">Landing Preview</TabsTrigger>
            </TabsList>
            <UserMenu />
          </div>
        </div>

        <TabsContent value="app" className="mt-0">
          {children}
        </TabsContent>

        <TabsContent value="landing" className="mt-0">
          <div className="min-h-screen overflow-auto">
            <LandingPage />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
