import { AlertTriangle, Clock, DollarSign, TrendingDown } from "lucide-react";

export const ProblemAgitationSection = () => {
  const problems = [
    {
      icon: Clock,
      title: "Wasting Hours on Marketing",
      description: "You're spending 10+ hours a week creating social media posts, writing emails, and planning campaigns instead of running your business.",
      colorVariant: "secondary"
    },
    {
      icon: DollarSign,
      title: "Paying for Multiple Tools",
      description: "Between social media schedulers, email platforms, CRM systems, and analytics tools, you're paying $200+ per month for scattered solutions.",
      colorVariant: "primary"
    },
    {
      icon: TrendingDown,
      title: "Missing Sales Opportunities",
      description: "Without proper customer tracking and automated follow-ups, you're losing 30-40% of potential sales from interested customers.",
      colorVariant: "accent"
    },
    {
      icon: AlertTriangle,
      title: "Generic Marketing That Doesn't Work",
      description: "Standard marketing tools don't understand plant seasons, garden center customers, or nursery-specific campaigns.",
      colorVariant: "secondary"
    }
  ];

  return (
    <section className="py-24 px-6 bg-offwhite">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-6 text-accent">
            Are You Tired of Marketing That Feels Like Work?
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Most garden center owners are frustrated with marketing because they're using the wrong tools. Sound familiar?
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {problems.map((problem, index) => (
            <div
              key={index}
              className="apple-fade-in-stagger relative overflow-hidden rounded-2xl bg-white/40 backdrop-blur-xl border border-white/20 shadow-lg hover:shadow-xl hover:ring-2 hover:ring-white/30 transition-all duration-300 p-8"
              style={{ 
                animationDelay: `${index * 0.1}s`
              }}
            >
              {/* Gradient top border */}
              <div 
                className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-secondary via-accent to-primary" 
                aria-hidden="true"
              />
              
              {/* Subtle gradient blob inside */}
              <div 
                className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-${problem.colorVariant}/5 blur-3xl`}
                aria-hidden="true"
              />
              
              <div className="relative flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 mt-1 bg-white/60 backdrop-blur-sm border border-white/40 text-${problem.colorVariant}`}>
                  <problem.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-3 text-accent">
                    {problem.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {problem.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-16">
          <p className="text-lg text-accent font-medium">
            What if there was a better way? A tool built specifically for garden centers that understands your unique needs?
          </p>
        </div>
      </div>
    </section>
  );
};