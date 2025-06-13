
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, CheckCircle } from "lucide-react";

interface OnboardingContentLoaderProps {
  isCompleting: boolean;
}

export const OnboardingContentLoader = ({ isCompleting }: OnboardingContentLoaderProps) => {
  if (!isCompleting) return null;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
      <CardContent className="p-8 text-center">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <Sparkles className="w-16 h-16 text-green-600 animate-pulse" />
            <Loader2 className="w-8 h-8 text-green-800 animate-spin absolute top-4 left-4" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-green-800 mb-4">
          🌱 Creating Your Garden Center Content
        </h2>
        
        <p className="text-green-700 mb-6 text-lg">
          Our AI is analyzing your business and generating personalized marketing content for your garden center...
        </p>
        
        <div className="space-y-3 max-w-md mx-auto">
          <div className="flex items-center gap-3 text-left">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800">Creating company profile</span>
          </div>
          <div className="flex items-center gap-3 text-left">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800">Generating 52 weekly garden themes</span>
          </div>
          <div className="flex items-center gap-3 text-left">
            <Loader2 className="w-5 h-5 text-green-600 animate-spin" />
            <span className="text-green-800 font-medium">Crafting your first 5 marketing posts</span>
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-white rounded-lg border border-green-200">
          <p className="text-sm text-green-700">
            <strong>Almost done!</strong> Your AI assistant is creating newsletter, social media, and email content 
            tailored specifically for your garden center and the current gardening season.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
