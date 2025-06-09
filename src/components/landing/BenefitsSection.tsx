
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Brain, Edit, Megaphone, Zap, FileCheck } from "lucide-react";

export const BenefitsSection = () => {
  return (
    <section className="py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-center mb-16 text-garden-green-dark">
          Everything You Need to Grow Without Hiring a Marketing Team
        </h2>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="h-6 w-6 text-garden-green" />
                <h3 className="text-xl font-semibold text-garden-green-dark">
                  Weekly Content Engine
                </h3>
              </div>
              <p className="text-base text-gray-600">
                Fresh content delivered every week, perfectly timed for your garden center's seasonal needs.
              </p>
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="h-6 w-6 text-garden-green" />
                <h3 className="text-xl font-semibold text-garden-green-dark">
                  Brand Voice Matching
                </h3>
              </div>
              <p className="text-base text-gray-600">
                AI learns your unique tone and style to create content that sounds authentically you.
              </p>
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <Edit className="h-6 w-6 text-garden-green" />
                <h3 className="text-xl font-semibold text-garden-green-dark">
                  Fully Customizable
                </h3>
              </div>
              <p className="text-base text-gray-600">
                Edit, tweak, and personalize every piece of content to match your exact needs.
              </p>
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <Megaphone className="h-6 w-6 text-garden-green" />
                <h3 className="text-xl font-semibold text-garden-green-dark">
                  All-in-One Distribution
                </h3>
              </div>
              <p className="text-base text-gray-600">
                Post to social media, send newsletters, and update your website all from one place.
              </p>
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <Zap className="h-6 w-6 text-garden-green" />
                <h3 className="text-xl font-semibold text-garden-green-dark">
                  Ridiculously Fast Setup
                </h3>
              </div>
              <p className="text-base text-gray-600">
                Get started in under a minute. No complicated onboarding or technical setup required.
              </p>
            </CardContent>
          </Card>

          <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 mb-4">
                <FileCheck className="h-6 w-6 text-garden-green" />
                <h3 className="text-xl font-semibold text-garden-green-dark">
                  Built for Garden Centers
                </h3>
              </div>
              <p className="text-base text-gray-600">
                Industry-specific templates and seasonal content designed specifically for garden centers.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
