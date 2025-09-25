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
    <TooltipProvider>
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
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 cursor-help">
                                    <span className="font-medium text-foreground">
                                      {item.service}
                                    </span>
                                    <HelpCircle className="h-4 w-4 text-muted-foreground/60 hover:text-primary transition-colors" />
                                    {item.unique && (
                                      <Badge variant="secondary" className="bg-gradient-to-r from-primary/20 to-brand-teal-mint/20 text-primary text-xs">
                                        Unique
                                      </Badge>
                                    )}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs">
                                  <p>{item.tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </td>
                          
                          <td className="py-5 px-8 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-xs opacity-50">
                                {item.competitorLogos.join(" ")}
                              </span>
                              <span className={`font-semibold ${item.typicalCost === 'Not available' ? 'text-muted-foreground italic' : 'text-foreground'}`}>
                                {item.typicalCost}
                              </span>
                            </div>
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

          {/* Cost Comparison Summary */}
          <div className="max-w-4xl mx-auto">
            <Card className="overflow-hidden shadow-2xl border-0 bg-gradient-to-r from-white via-white to-muted/20">
              <CardContent className="p-8">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  
                  {/* Separate Tools Cost */}
                  <div className="text-center md:text-left">
                    <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                      Total cost of separate tools:
                    </h3>
                    <div className="text-3xl md:text-4xl font-bold text-destructive mb-2">
                      ${totalMinCost.toLocaleString()}–${totalMaxCost.toLocaleString()}+
                    </div>
                    <div className="text-lg text-destructive/80">per year</div>
                    <div className="mt-4 text-sm text-muted-foreground">
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                        <span className="bg-muted/50 px-2 py-1 rounded text-xs">Multiple logins</span>
                        <span className="bg-muted/50 px-2 py-1 rounded text-xs">Separate support teams</span>
                        <span className="bg-muted/50 px-2 py-1 rounded text-xs">Integration headaches</span>
                      </div>
                    </div>
                  </div>

                  {/* VS Divider */}
                  <div className="flex justify-center">
                    <div className="hidden md:block w-px h-24 bg-gradient-to-b from-transparent via-muted to-transparent"></div>
                    <div className="md:hidden h-px w-24 bg-gradient-to-r from-transparent via-muted to-transparent"></div>
                  </div>

                  {/* BloomSuite Cost */}
                  <div className="text-center md:text-right">
                    <h3 className="text-lg font-semibold text-primary mb-2">
                      BloomSuite All-in-One:
                    </h3>
                    <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                      ${bloomSuiteCost.toLocaleString()}
                    </div>
                    <div className="text-lg text-primary/80">per year</div>
                    <div className="mt-4 text-sm text-primary/80">
                      <div className="flex flex-wrap gap-2 justify-center md:justify-end">
                        <span className="bg-primary/10 px-2 py-1 rounded text-xs">One login</span>
                        <span className="bg-primary/10 px-2 py-1 rounded text-xs">One support team</span>
                        <span className="bg-primary/10 px-2 py-1 rounded text-xs">Built for garden centers</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Savings Highlight */}
                <div className="mt-8 pt-8 border-t border-muted/30">
                  <div className="text-center">
                    <div className="inline-flex items-center gap-3 bg-gradient-to-r from-primary/10 to-brand-teal-mint/10 px-6 py-4 rounded-2xl">
                      <CheckCircle className="h-6 w-6 text-primary" />
                      <div>
                        <span className="text-lg font-semibold text-primary">
                          Save ${(totalMinCost - bloomSuiteCost).toLocaleString()}–${(totalMaxCost - bloomSuiteCost).toLocaleString()}+ per year
                        </span>
                        <div className="text-sm text-muted-foreground">
                          Plus get features you can't find anywhere else
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
    </TooltipProvider>
  );
};