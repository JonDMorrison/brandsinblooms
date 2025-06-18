
import { Card, CardContent } from "@/components/ui/card";

export const HowItWorksSection = () => {
  return (
    <section className="py-24 px-6 bg-gradient-to-b from-garden-background/30 to-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20 apple-section-spacing">
          <h2 className="text-4xl font-bold mb-6 text-garden-green-dark apple-headline-large">
            Transform Your Marketing in 3 Simple Steps
          </h2>
          <p className="text-xl text-gray-600 apple-body-enhanced max-w-3xl mx-auto">
            From zero to marketing hero in under a minute. Our streamlined process gets you results immediately.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-10">
          <Card className="apple-fade-in-stagger card-interactive text-center p-10 rounded-3xl bg-white border-2 border-gray-100 hover:border-garden-green/20 apple-warm-neutral shadow-sm hover:shadow-2xl group">
            <CardContent className="pt-8 apple-card-spacing">
              <div className="w-12 h-12 bg-garden-green text-white rounded-full flex items-center justify-center font-bold text-xl mb-6 mx-auto">
                1
              </div>
              <h3 className="text-2xl font-semibold mb-6 text-garden-green-dark apple-headline-medium">
                Share Your Website
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed apple-body-enhanced">
                Simply paste your website URL and we'll instantly analyze your brand voice, style, and customer approach to create perfectly matched content.
              </p>
            </CardContent>
          </Card>

          <Card className="apple-fade-in-stagger card-interactive text-center p-10 rounded-3xl bg-white border-2 border-gray-100 hover:border-garden-green/20 apple-warm-neutral shadow-sm hover:shadow-2xl group" style={{animationDelay: '0.1s'}}>
            <CardContent className="pt-8 apple-card-spacing">
              <div className="w-12 h-12 bg-garden-green text-white rounded-full flex items-center justify-center font-bold text-xl mb-6 mx-auto">
                2
              </div>
              <h3 className="text-2xl font-semibold mb-6 text-garden-green-dark apple-headline-medium">
                Review & Customize
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed apple-body-enhanced">
                Instantly receive ready-to-publish posts, emails, and content — all fully editable and tailored to your garden center's unique personality.
              </p>
            </CardContent>
          </Card>

          <Card className="apple-fade-in-stagger card-interactive text-center p-10 rounded-3xl bg-white border-2 border-gray-100 hover:border-garden-green/20 apple-warm-neutral shadow-sm hover:shadow-2xl group" style={{animationDelay: '0.2s'}}>
            <CardContent className="pt-8 apple-card-spacing">
              <div className="w-12 h-12 bg-garden-green text-white rounded-full flex items-center justify-center font-bold text-xl mb-6 mx-auto">
                3
              </div>
              <h3 className="text-2xl font-semibold mb-6 text-garden-green-dark apple-headline-medium">
                Publish & Thrive
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed apple-body-enhanced">
                Share across all platforms with one click, track performance, and watch your garden center's marketing flourish effortlessly.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
