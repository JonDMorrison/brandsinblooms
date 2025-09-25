import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, X, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export const CompetitorComparison = () => {
  const comparisonData = [
    {
      service: "Email marketing (Mailchimp/Klaviyo)",
      typicalCost: "$1,200–$1,800",
      included: true,
      tooltip: "Professional email campaigns, automation, segmentation, and advanced analytics",
      competitorLogos: ["📧", "🎯"]
    },
    {
      service: "SMS marketing",
      typicalCost: "$600–$1,500",
      included: true,
      tooltip: "Two-way SMS campaigns, automated messaging, and compliance management",
      competitorLogos: ["📱", "💬"]
    },
    {
      service: "Social scheduling (Buffer/Hootsuite)",
      typicalCost: "$1,200",
      included: true,
      tooltip: "Multi-platform posting, content calendar, and engagement tracking",
      competitorLogos: ["📅", "🔄"]
    },
    {
      service: "Website/blog hosting (Squarespace/Shopify)",
      typicalCost: "$360–$600",
      included: true,
      tooltip: "Professional hosting, custom domains, and e-commerce capabilities",
      competitorLogos: ["🌐", "🛍️"]
    },
    {
      service: "CRM (customer relationship management)",
      typicalCost: "$600–$1,200",
      included: true,
      tooltip: "Customer profiles, segmentation, purchase history, and lifecycle tracking",
      competitorLogos: ["👥", "📊"]
    },
    {
      service: "Analytics & ROI tools",
      typicalCost: "$300–$600",
      included: true,
      tooltip: "Performance tracking, revenue attribution, and detailed reporting",
      competitorLogos: ["📈", "💰"]
    },
    {
      service: "Seasonal content & marketing calendar",
      typicalCost: "Not available",
      included: true,
      tooltip: "Garden center-specific seasonal campaigns and content planning",
      competitorLogos: ["🌿", "📅"],
      unique: true
    },
    {
      service: "Human technical support (horticulture experts)",
      typicalCost: "Not available",
      included: true,
      tooltip: "Dedicated support from garden center marketing experts",
      competitorLogos: ["🌱", "🤝"],
      unique: true
    },
    {
      service: "Unlimited access to training courses",
      typicalCost: "Not available",
      included: true,
      tooltip: "Comprehensive training on garden center marketing and operations",
      competitorLogos: ["🎓", "📚"],
      unique: true
    },
    {
      service: "Garden center community",
      typicalCost: "Not available",
      included: true,
      tooltip: "Network with other garden center owners and share best practices",
      competitorLogos: ["🤝", "🌻"],
      unique: true
    }
  ];

  const totalMinCost = 4200;
  const totalMaxCost = 6900;
  const bloomSuiteCost = 2999;

  return (
      <section id="competitor-comparison" className="py-16 px-6 bg-gradient-to-br from-muted/20 via-background/80 to-muted/30">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-accent mb-4">
              How We Compare to Separate Tools
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              See how BloomSuite saves you thousands while providing features you can't get anywhere else
            </p>
          </div>

          {/* Comparison Table */}
          <Card className="mb-12 overflow-hidden shadow-xl border-0 bg-white/90 backdrop-blur-sm">
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    {/* Table Header */}
                    <thead>
                      <tr className="bg-gradient-to-r from-primary/10 to-brand-teal-mint/10 border-b-2 border-primary/20">
                        <th className="text-left py-6 px-8 font-semibold text-accent text-lg">
                          Service / Tool
                        </th>
                        <th className="text-center py-6 px-8 font-semibold text-accent text-lg">
                          Typical Annual Cost
                        </th>
                        <th className="text-center py-6 px-8 font-semibold text-accent text-lg">
                          Included in BloomSuite?
                        </th>
                      </tr>
                    </thead>
                    
                    {/* Table Body */}
                    <tbody>
                      {comparisonData.map((item, index) => (
                        <tr 
                          key={index}
                          className="border-b border-muted/30 hover:bg-primary/5 transition-all duration-200"
                        >
                          <td className="py-5 px-8">
                            <div className="flex items-center gap-3">
                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 cursor-help group">
                                    <span className="font-medium text-foreground">
                                      {item.service}
                                    </span>
                                    <div className="relative">
                                      <HelpCircle className="h-4 w-4 text-muted-foreground/60 hover:text-primary hover:scale-110 transition-all duration-200 group-hover:animate-pulse" />
                                      <div className="pointer-events-none absolute inset-0 rounded-full bg-primary/20 scale-0 group-hover:scale-150 transition-transform duration-300 opacity-0 group-hover:opacity-100"></div>
                                    </div>
                                    {item.unique && (
                                      <Badge variant="secondary" className="bg-gradient-to-r from-primary/20 to-brand-teal-mint/20 text-primary text-xs">
                                        Unique
                                      </Badge>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent 
                                  className="max-w-xs bg-popover/95 backdrop-blur-sm border-primary/20 shadow-xl"
                                  sideOffset={8}
                                >
                                  <div className="flex items-start gap-2">
                                    <HelpCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-sm leading-relaxed">{item.tooltip}</p>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                          
                          <td className="py-5 px-8 text-center">
                            <span className={`font-semibold ${item.typicalCost === 'Not available' ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                              {item.typicalCost}
                            </span>
                          </td>
                          
                          <td className="py-5 px-8">
                            <div className="flex justify-center">
                              {item.included ? (
                                <div className="flex items-center gap-2 text-primary font-medium">
                                  <CheckCircle className="h-5 w-5" />
                                  <span className="text-sm">Yes</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <X className="h-5 w-5" />
                                  <span className="text-sm">No</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4 p-6">
                {comparisonData.map((item, index) => (
                  <Card key={index} className="p-4 border border-muted/30">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="font-medium text-sm">{item.service}</span>
                          {item.unique && (
                            <Badge variant="secondary" className="bg-gradient-to-r from-primary/20 to-brand-teal-mint/20 text-primary text-xs">
                              Unique
                            </Badge>
                          )}
                        </div>
                        {item.included ? (
                          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                        ) : (
                          <X className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                      
                      <div className="text-sm text-muted-foreground">
                        <span className="font-medium">Typical cost: </span>
                        <span>{item.typicalCost}</span>
                      </div>
                      
                      <div className="text-xs text-muted-foreground border-t pt-2">
                        {item.tooltip}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cost Comparison Summary - Enhanced Design */}
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-3 gap-8 items-stretch">
              
              {/* Separate Tools - Expensive Side */}
              <div className="lg:col-span-1">
                <Card className="h-full bg-gradient-to-br from-muted/30 to-muted/50 border-2 border-muted-foreground/20 shadow-xl relative overflow-hidden">
                  {/* Warning pattern background */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-4 right-4 text-muted-foreground text-6xl">⚠️</div>
                  </div>
                  
                  <CardContent className="p-8 relative z-10 h-full flex flex-col">
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center gap-2 bg-muted text-muted-foreground px-4 py-2 rounded-full text-sm font-medium mb-4">
                        <X className="h-4 w-4" />
                        Separate Tools
                      </div>
                      
                      <div className="text-5xl font-black text-foreground mb-2 tracking-tight">
                        ${totalMinCost.toLocaleString()}<span className="text-3xl">–${totalMaxCost.toLocaleString()}+</span>
                      </div>
                      <div className="text-xl font-semibold text-muted-foreground">per year</div>
                    </div>
                    
                    <div className="flex-grow">
                      <h4 className="font-bold text-foreground mb-4 text-center">The Problems:</h4>
                      <div className="space-y-3">
                        {[
                          "Multiple logins to remember",
                          "Separate support teams",
                          "Integration headaches",
                          "Data scattered everywhere",
                          "Hidden fees and add-ons"
                        ].map((problem, idx) => (
                          <div key={idx} className="flex items-center gap-3 text-muted-foreground">
                            <X className="h-4 w-4 flex-shrink-0" />
                            <span className="text-sm">{problem}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* VS Section */}
              <div className="lg:col-span-1 flex items-center justify-center">
                <div className="text-center py-8">
                  <div className="relative">
                    {/* Decorative elements */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-brand-teal-mint/20 to-primary/20 rounded-full blur-3xl scale-150 opacity-30"></div>
                    
                    <div className="relative bg-white rounded-full p-6 shadow-2xl border-4 border-primary/20">
                      <div className="text-4xl font-black text-transparent bg-gradient-to-r from-primary to-brand-teal-mint bg-clip-text">
                        VS
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 text-center">
                    <div className="text-2xl font-bold text-primary mb-2">Why Choose Complexity?</div>
                    <div className="text-lg text-muted-foreground max-w-xs mx-auto leading-relaxed">
                      When you can get <span className="font-semibold text-primary">everything in one place</span> for less money?
                    </div>
                  </div>
                </div>
              </div>

              {/* BloomSuite - Better Solution */}
              <div className="lg:col-span-1">
                <Card className="h-full bg-gradient-to-br from-green-50 to-primary/10 border-2 border-primary/30 shadow-xl relative overflow-hidden">
                  {/* Success pattern background */}
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-4 right-4 text-primary text-6xl">✨</div>
                  </div>
                  
                  <CardContent className="p-8 relative z-10 h-full flex flex-col">
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center gap-2 bg-primary/20 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
                        <CheckCircle className="h-4 w-4" />
                        BloomSuite All-in-One
                      </div>
                      
                      <div className="text-6xl font-black text-primary mb-2 tracking-tight">
                        ${bloomSuiteCost.toLocaleString()}
                      </div>
                      <div className="text-xl font-semibold text-primary/80">per year</div>
                    </div>
                    
                    <div className="flex-grow">
                      <h4 className="font-bold text-primary mb-4 text-center">The Solution:</h4>
                      <div className="space-y-3">
                        {[
                          "One login for everything",
                          "One expert support team",
                          "Built-in integrations",
                          "Unified customer data",
                          "No hidden fees ever"
                        ].map((benefit, idx) => (
                          <div key={idx} className="flex items-center gap-3 text-primary">
                            <CheckCircle className="h-4 w-4 flex-shrink-0" />
                            <span className="text-sm font-medium">{benefit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Massive Savings Highlight */}
            <div className="mt-12 text-center">
              <Card className="inline-block bg-gradient-to-r from-primary via-brand-teal-mint to-primary p-1 rounded-3xl shadow-2xl">
                <div className="bg-white rounded-3xl px-12 py-8">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="text-6xl">💰</div>
                    <div>
                      <div className="text-4xl font-black text-transparent bg-gradient-to-r from-primary to-brand-teal-mint bg-clip-text">
                        Save ${(totalMinCost - bloomSuiteCost).toLocaleString()}–${(totalMaxCost - bloomSuiteCost).toLocaleString()}+
                      </div>
                      <div className="text-xl text-muted-foreground font-semibold">every single year</div>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-primary/10 to-brand-teal-mint/10 rounded-2xl px-6 py-4 inline-block">
                    <span className="text-lg font-bold text-primary">
                      Plus get features you can't find anywhere else
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-12">
            <p className="text-xl text-muted-foreground mb-6">
              <span className="font-semibold text-primary">One login.</span>{" "}
              <span className="font-semibold text-primary">One support team.</span>{" "}
              <span className="font-semibold text-primary">Built for garden centers.</span>
            </p>
            
            <div className="flex flex-wrap justify-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>30-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>No setup fees</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span>Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>
  );
};