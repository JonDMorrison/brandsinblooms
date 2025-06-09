
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Edit, TrendingUp } from "lucide-react";

export const HowItWorksSection = () => {
  return (
    <section className="py-12 px-6 bg-white/60">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-center mb-16 text-garden-green-dark">
          Transform Your Marketing in 3 Simple Steps
        </h2>
        
        <div className="grid md:grid-cols-3 gap-12">
          <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
                <Edit className="h-8 w-8 text-garden-green" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                Paste Your Website
              </h3>
              <p className="text-base text-gray-600">
                We'll analyze your site to learn your brand voice and customer style.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-8 w-8 text-garden-green" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                Review Your Content
              </h3>
              <p className="text-base text-gray-600">
                Instantly receive ready-to-go posts, emails, and more — all editable and fully tailored.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-6">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="h-8 w-8 text-garden-green" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                Publish & Grow
              </h3>
              <p className="text-base text-gray-600">
                Share across platforms in one click and track what performs best.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
