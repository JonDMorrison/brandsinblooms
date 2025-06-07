
import { WeeklyThemeGenerator } from "../theme-generation/WeeklyThemeGenerator";
import { MasterTemplateManager } from "../content-import/MasterTemplateManager";

interface HomepageSidebarProps {
  onThemesGenerated: () => void;
}

export const HomepageSidebar = ({ onThemesGenerated }: HomepageSidebarProps) => {
  return (
    <div className="space-y-6">
      <WeeklyThemeGenerator onThemesGenerated={onThemesGenerated} />
      <MasterTemplateManager />
    </div>
  );
};
