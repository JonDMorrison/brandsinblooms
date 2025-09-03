import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, DollarSign, TrendingDown } from "lucide-react";

export const ProblemAgitationSection = () => {
  const problems = [
    {
      icon: Clock,
      title: "Wasting Hours on Marketing",
      description: "You're spending 10+ hours a week creating social media posts, writing emails, and planning campaigns instead of running your business.",
      bgClass: "bg-red-50",
      iconClass: "text-red-600",
      borderClass: "border-red-200"
    },
    {
      icon: DollarSign,
      title: "Paying for Multiple Tools",
      description: "Between social media schedulers, email platforms, CRM systems, and analytics tools, you're paying $200+ per month for scattered solutions.",
      bgClass: "bg-orange-50",
      iconClass: "text-orange-600",
      borderClass: "border-orange-200"
    },
    {
      icon: TrendingDown,
      title: "Missing Sales Opportunities",
      description: "Without proper customer tracking and automated follow-ups, you're losing 30-40% of potential sales from interested customers.",
      bgClass: "bg-rose-50",
      iconClass: "text-rose-600",
      borderClass: "border-rose-200"
    },
    {
      icon: AlertTriangle,
      title: "Generic Marketing That Doesn't Work",
      description: "Standard marketing tools don't understand plant seasons, garden center customers, or nursery-specific campaigns.",
      bgClass: "bg-amber-50",
      iconClass: "text-amber-600",
      borderClass: "border-amber-200"
    }
  ];

  return (
    <section className="py-24 px-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-6 text-gray-900">
            Are You Tired of Marketing That Feels Like Work?
          </h2>
          <p className="text-xl text-[#6B7280] max-w-3xl mx-auto">
            Most garden center owners are frustrated with marketing because they're using the wrong tools. Sound familiar?
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {problems.map((problem, index) => (
            <Card 
              key={index} 
              className={`apple-fade-in-stagger p-8 rounded-2xl border-2 hover:shadow-lg transition-all duration-300 ${problem.bgClass} ${problem.borderClass}`}
              style={{ 
                animationDelay: `${index * 0.1}s`
              }}
            >
              <CardContent className="p-0">
                <div className="flex items-start gap-4">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 mt-1 bg-white border-2"
                  >
                    <problem.icon className={`w-6 h-6 ${problem.iconClass}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-3 text-gray-900">
                      {problem.title}
                    </h3>
                    <p className="text-[#6B7280] leading-relaxed">
                      {problem.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="text-center mt-16">
          <p className="text-lg text-gray-700 font-medium">
            What if there was a better way? A tool built specifically for garden centers that understands your unique needs?
          </p>
        </div>
      </div>
    </section>
  );
};