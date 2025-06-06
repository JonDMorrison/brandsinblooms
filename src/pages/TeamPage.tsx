
import { TeamPage as TeamPageComponent } from "@/components/TeamPage";

const TeamPage = () => {
  return (
    <div className="min-h-screen bg-garden-background">
      <div className="p-6 border-b border-green-200 bg-white">
        <h1 className="text-3xl font-bold text-garden-green-dark">Team Management</h1>
        <p className="text-garden-green font-medium">Manage your team members and collaboration</p>
      </div>
      <div className="p-6">
        <TeamPageComponent />
      </div>
    </div>
  );
};

export default TeamPage;
