
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { HeadlineLarge, BodyMedium } from "@/components/ui/typography";
import { Sparkles, Calendar } from "lucide-react";

export const SmartThemeSelector = () => {
  const [loading, setLoading] = React.useState(false);

  const handleGenerateThemes = () => {
    setLoading(true);
    // Placeholder for theme generation
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <HeadlineLarge className="text-gray-800">
              Weekly Theme Generator
            </HeadlineLarge>
            <BodyMedium className="text-gray-600 text-sm">
              AI-powered seasonal content themes
            </BodyMedium>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>Current week themes available</span>
          </div>
          
          <Button 
            onClick={handleGenerateThemes}
            disabled={loading}
            className="w-full"
            variant="outline"
          >
            {loading ? (
              <>
                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                Generating Themes...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Weekly Themes
              </>
            )}
          </Button>
          
          <BodyMedium className="text-gray-500 text-xs text-center">
            Generate seasonal content themes for your garden center
          </BodyMedium>
        </div>
      </CardContent>
    </Card>
  );
};
