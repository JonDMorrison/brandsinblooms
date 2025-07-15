
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
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
          {/* Left Column - Enhanced Icon */}
          <div className="flex justify-center md:justify-start">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center shadow-lg">
                <Sparkles className="w-8 h-8 text-purple-600 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full bg-purple-600/10 animate-ping"></div>
            </div>
          </div>
          
          {/* Right Column - Content */}
          <div className="space-y-3 text-center md:text-left">
            <div>
              <HeadlineLarge className="text-gray-800 mb-1">
                Weekly Theme Generator
              </HeadlineLarge>
              <BodyMedium className="text-gray-600">
                AI-powered seasonal content themes for your garden center
              </BodyMedium>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600 justify-center md:justify-start">
              <Calendar className="w-4 h-4" />
              <span>Current week themes available</span>
            </div>
            
            <Button 
              onClick={handleGenerateThemes}
              disabled={loading}
              className="w-full md:w-auto"
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
