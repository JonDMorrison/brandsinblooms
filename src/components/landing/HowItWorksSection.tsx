
import { Card, CardContent } from "@/components/ui/card";
import { LandingPageIcon, ConnectedIcons } from "./LandingPageIcon";
import { Globe, Eye, Rocket } from "lucide-react";

export const HowItWorksSection = () => {
  return (
    <section className="py-12 px-6 bg-white/60">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-center mb-16 text-garden-green-dark">
          Transform Your Marketing in 3 Simple Steps
        </h2>
        
        {/* Connected visual flow for desktop */}
        <div className="hidden md:block mb-12">
          <ConnectedIcons className="max-w-4xl mx-auto">
            <LandingPageIcon icon={Globe} variant="section" theme="spring" />
            <LandingPageIcon icon={Eye} variant="section" theme="summer" />
            <LandingPageIcon icon={Rocket} variant="section" theme="autumn" />
          </ConnectedIcons>
        </div>
        
        <div className="grid md:grid-cols-3 gap-12">
          <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 rounded-2xl bg-garden-sage border border-gray-200 group">
            <CardContent className="pt-6">
              <div className="flex justify-center mb-6 md:hidden">
                <LandingPageIcon icon={Globe} variant="section" theme="spring" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                Paste Your Website
              </h3>
              <p className="text-base text-gray-600">
                We'll analyze your site to learn your brand voice and customer style.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 rounded-2xl bg-garden-sage border border-gray-200 group">
            <CardContent className="pt-6">
              <div className="flex justify-center mb-6 md:hidden">
                <LandingPageIcon icon={Eye} variant="section" theme="summer" />
              </div>
              <h3 className="text-xl font-semibold mb-4 text-garden-green-dark">
                Review Your Content
              </h3>
              <p className="text-base text-gray-600">
                Instantly receive ready-to-go posts, emails, and more — all editable and fully tailored.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 rounded-2xl bg-garden-sage border border-gray-200 group">
            <CardContent className="pt-6">
              <div className="flex justify-center mb-6 md:hidden">
                <LandingPageIcon icon={Rocket} variant="section" theme="autumn" />
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
