
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle } from "lucide-react";

interface WebsiteAnalysisLoaderProps {
  isAnalyzing: boolean;
}

export const WebsiteAnalysisLoader = ({ isAnalyzing }: WebsiteAnalysisLoaderProps) => {
  const [visibleItems, setVisibleItems] = useState(0);

  const extractionItems = [
    "Business name and location",
    "About us / company description", 
    "Brand voice and tone from your content",
    "Annual events and promotions",
    "Services and specializations"
  ];

  // Animation effect for checklist items
  useEffect(() => {
    if (isAnalyzing) {
      setVisibleItems(0);
      const timer = setInterval(() => {
        setVisibleItems(prev => {
          if (prev < extractionItems.length) {
            return prev + 1;
          } else {
            clearInterval(timer);
            return prev;
          }
        });
      }, 600); // Show each item every 600ms

      return () => clearInterval(timer);
    } else {
      setVisibleItems(0);
    }
  }, [isAnalyzing, extractionItems.length]);

  if (!isAnalyzing) return null;

  return (
    <Card className="shadow-md rounded-lg border mb-4 bg-white">
      <CardContent className="p-6">
        <div className="text-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-3" />
          <h3 className="text-lg font-semibold mb-3 text-black">Analyzing your website...</h3>
          <p className="text-sm text-gray-600 mb-4">
            Just a second here, we are collecting your:
          </p>
          <div className="space-y-2 text-left max-w-sm mx-auto">
            {extractionItems.map((item, index) => (
              <div 
                key={index} 
                className={`flex items-center gap-2 text-sm transition-all duration-500 ${
                  index < visibleItems 
                    ? 'opacity-100 translate-y-0' 
                    : 'opacity-0 translate-y-4'
                }`}
              >
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-black">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
