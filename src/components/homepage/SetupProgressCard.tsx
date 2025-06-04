
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SetupProgressCardProps {
  setupProgress: any;
}

export const SetupProgressCard = ({ setupProgress }: SetupProgressCardProps) => {
  return (
    <Card className="shadow-lg border-green-200 rounded-xl bg-gradient-to-br from-green-50 to-blue-50">
      <CardHeader>
        <CardTitle className="text-lg text-black font-bold flex items-center gap-2">
          <span className="text-2xl">🌼</span>
          You're {setupProgress.percentage}% set up!
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {setupProgress.steps.map((step: any, index: number) => (
            <div key={index} className="flex items-center gap-3">
              <span className="text-lg">
                {step.completed ? "✅" : "⬜️"}
              </span>
              <span className={`text-sm font-medium ${step.completed ? 'text-green-700' : 'text-gray-600'}`}>
                {step.label}
              </span>
            </div>
          ))}
        </div>
        {setupProgress.percentage < 100 && (
          <Button className="w-full bg-primary hover:bg-primary-600 text-white shadow-md">
            Complete Setup
          </Button>
        )}
      </CardContent>
    </Card>
  );
};
