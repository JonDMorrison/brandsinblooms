
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Users, Edit, TrendingUp, Star, ArrowRight, Calendar, Brain, Zap, MessageSquare, Megaphone, FileCheck, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { UserMenu } from "@/components/UserMenu";

interface LandingPageProps {
  onGetStarted?: () => void;
}

export const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (onGetStarted) {
      onGetStarted();
    } else if (user) {
      navigate('/app');
    } else {
      navigate('/auth');
    }
  };

  const handleSeePricing = () => {
    navigate('/pricing');
  };

  const handleLogin = () => {
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Header */}
      <nav className="flex justify-between items-center px-6 py-4 border-b border-muted">
        <div className="text-2xl font-bold text-primary">
          Garden Center Marketing
        </div>
        <div className="flex items-center gap-4">
          {user ? (
            <UserMenu />
          ) : (
            <Button 
              onClick={handleLogin}
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-primary mb-6 leading-tight">
            Effortless Marketing for Garden Centers
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            In less than a minute, get personalized weekly content for social media, newsletters, blogs, video scripts, and email marketing — all tailored to your voice.
          </p>
          
          <Button 
            onClick={handleGetStarted}
            className="bg-secondary hover:bg-secondary/90 text-primary px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group mb-4"
          >
            Get Started In Less Than A Minute
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <p className="text-sm text-muted-foreground">
            No credit card required. No tech skills needed.
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-12 px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-16 text-primary">
            Transform Your Marketing in 3 Simple Steps
          </h2>
          
          <div className="grid md:grid-cols-3 gap-12">
            <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 rounded-2xl border-muted">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Edit className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-primary">
                  Paste Your Website
                </h3>
                <p className="text-base text-muted-foreground">
                  We'll analyze your site to learn your brand voice and customer style.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 rounded-2xl border-muted">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-primary">
                  Review Your Content
                </h3>
                <p className="text-base text-muted-foreground">
                  Instantly receive ready-to-go posts, emails, and more — all editable and fully tailored.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-2 rounded-2xl border-muted">
              <CardContent className="pt-6">
                <div className="w-16 h-16 bg-secondary/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <TrendingUp className="h-8 w-8 text-secondary" />
                </div>
                <h3 className="text-xl font-semibold mb-4 text-primary">
                  Publish & Grow
                </h3>
                <p className="text-base text-muted-foreground">
                  Share across platforms in one click and track what performs best.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Grid Section */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-16 text-primary">
            Everything You Need to Grow Without Hiring a Marketing Team
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl border-muted">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <Calendar className="h-6 w-6 text-secondary" />
                  <h3 className="text-xl font-semibold text-primary">
                    Weekly Content Engine
                  </h3>
                </div>
                <p className="text-base text-muted-foreground">
                  Fresh content delivered every week, perfectly timed for your garden center's seasonal needs.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl border-muted">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <Brain className="h-6 w-6 text-secondary" />
                  <h3 className="text-xl font-semibold text-primary">
                    Brand Voice Matching
                  </h3>
                </div>
                <p className="text-base text-muted-foreground">
                  AI learns your unique tone and style to create content that sounds authentically you.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl border-muted">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <Edit className="h-6 w-6 text-secondary" />
                  <h3 className="text-xl font-semibold text-primary">
                    Fully Customizable
                  </h3>
                </div>
                <p className="text-base text-muted-foreground">
                  Edit, tweak, and personalize every piece of content to match your exact needs.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl border-muted">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <Megaphone className="h-6 w-6 text-secondary" />
                  <h3 className="text-xl font-semibold text-primary">
                    All-in-One Distribution
                  </h3>
                </div>
                <p className="text-base text-muted-foreground">
                  Post to social media, send newsletters, and update your website all from one place.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl border-muted">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <Zap className="h-6 w-6 text-secondary" />
                  <h3 className="text-xl font-semibold text-primary">
                    Ridiculously Fast Setup
                  </h3>
                </div>
                <p className="text-base text-muted-foreground">
                  Get started in under a minute. No complicated onboarding or technical setup required.
                </p>
              </CardContent>
            </Card>

            <Card className="p-8 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 rounded-2xl border-muted">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <FileCheck className="h-6 w-6 text-secondary" />
                  <h3 className="text-xl font-semibold text-primary">
                    Built for Garden Centers
                  </h3>
                </div>
                <p className="text-base text-muted-foreground">
                  Industry-specific templates and seasonal content designed specifically for garden centers.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 px-6 bg-muted/20">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-16 text-primary">
            What Garden Center Owners Say
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="p-8 relative hover:shadow-xl transition-all duration-300 rounded-2xl border-muted">
              <CardContent className="pt-4">
                <div className="flex mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-secondary text-secondary" />
                  ))}
                </div>
                <p className="text-base text-muted-foreground mb-6 italic leading-relaxed">
                  "This saved us hours every week. We finally look professional online and our customers notice the difference."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-secondary to-secondary/80 rounded-full flex items-center justify-center text-primary font-bold text-lg mr-4">
                    L
                  </div>
                  <div>
                    <div className="font-semibold text-primary">Linda Chen</div>
                    <div className="text-sm text-muted-foreground">Maple Grove Greenhouse</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 relative hover:shadow-xl transition-all duration-300 rounded-2xl border-muted">
              <CardContent className="pt-4">
                <div className="flex mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-secondary text-secondary" />
                  ))}
                </div>
                <p className="text-base text-muted-foreground mb-6 italic leading-relaxed">
                  "We posted our Spring campaign and sold out of everything in three days. Best investment we've made."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg mr-4">
                    C
                  </div>
                  <div>
                    <div className="font-semibold text-primary">Carlos Rodriguez</div>
                    <div className="text-sm text-muted-foreground">Bloom Market Garden Center</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="p-8 relative hover:shadow-xl transition-all duration-300 rounded-2xl border-muted">
              <CardContent className="pt-4">
                <div className="flex mb-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5 fill-secondary text-secondary" />
                  ))}
                </div>
                <p className="text-base text-muted-foreground mb-6 italic leading-relaxed">
                  "The seasonal content is perfect. It's like having a marketing expert on our team without the cost."
                </p>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-secondary/70 to-secondary rounded-full flex items-center justify-center text-primary font-bold text-lg mr-4">
                    M
                  </div>
                  <div>
                    <div className="font-semibold text-primary">Maria Thompson</div>
                    <div className="text-sm text-muted-foreground">Sunshine Nursery & Garden</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Preview Section */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-4 text-primary">
            Simple Pricing. Big Value.
          </h2>
          
          <p className="text-base text-muted-foreground mb-10">
            Tools like this usually cost thousands. We made it affordable for every garden center.
          </p>
          
          <Button 
            onClick={handleSeePricing}
            className="bg-secondary hover:bg-secondary/90 text-primary px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
          >
            See Pricing Plans
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-12 px-6 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-semibold mb-6">
            Ready to Save Hours Every Week?
          </h2>
          
          <p className="text-xl mb-10 opacity-90">
            Try it free and watch your marketing take care of itself.
          </p>
          
          <Button 
            onClick={handleGetStarted}
            className="bg-secondary hover:bg-secondary/90 text-primary px-12 py-4 text-xl rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group mb-6"
          >
            Get Started In Less Than A Minute
            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </Button>
          
          <p className="text-sm opacity-75">
            No credit card required. No tech skills needed.
          </p>
        </div>
      </section>
    </div>
  );
};
