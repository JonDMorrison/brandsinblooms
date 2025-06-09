
import { AnalyticsSnapshot } from "./AnalyticsSnapshot";
import { WeeklyThemeGenerator } from "@/components/theme-generation/WeeklyThemeGenerator";

interface HomepageSidebarProps {
  onThemesGenerated: () => void;
}

export const HomepageSidebar = ({ onThemesGenerated }: HomepageSidebarProps) => {
  return (
    <div className="space-y-6">
      <AnalyticsSnapshot />
      
      <div className="bg-white p-6 rounded-lg border border-border shadow-sm">
        <h3 className="text-lg font-semibold text-foreground mb-4">
          Theme Generator
        </h3>
        <WeeklyThemeGenerator onThemesGenerated={onThemesGenerated} />
      </div>
    </div>
  );
};
