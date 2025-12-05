import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Mail, MessageSquare, Globe, ArrowRight } from "lucide-react";
import { pricingTiers } from "./pricingConfig";
import { cn } from "@/lib/utils";

export const PricingCardsGrid = () => {
  const navigate = useNavigate();

  const handleGetStarted = (tierId: string) => {
    navigate(`/auth?tier=${tierId}`);
  };

  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
          {pricingTiers.map((tier) => {
            const IconComponent = tier.icon;
            
            return (
              <Card 
                key={tier.id}
                className={cn(
                  "relative flex flex-col transition-all duration-300 hover:shadow-xl",
                  tier.recommended 
                    ? "border-2 border-[#2F7A4F] shadow-lg shadow-[#2F7A4F]/10 scale-[1.02]" 
                    : "border border-gray-200 hover:border-[#2F7A4F]/30"
                )}
              >
                {/* Recommended badge */}
                {tier.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-[#2F7A4F] hover:bg-[#2F7A4F] text-white px-4 py-1 text-xs font-semibold">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-4">
                  {/* Tier icon and name */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      tier.recommended 
                        ? "bg-[#2F7A4F] text-white" 
                        : "bg-[#2F7A4F]/10 text-[#2F7A4F]"
                    )}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <span className="text-lg font-semibold text-gray-900">{tier.name}</span>
                  </div>

                  {/* Price */}
                  <div className="mb-3">
                    <span className="text-4xl font-bold text-gray-900">${tier.price}</span>
                    <span className="text-gray-500 ml-1">/month</span>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600">{tier.description}</p>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col pt-0">
                  {/* Best for */}
                  <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium text-gray-900">Best for: </span>
                      {tier.bestFor}
                    </p>
                  </div>

                  {/* Includes */}
                  <div className="space-y-3 mb-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Included
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-sm text-gray-700">
                        <Mail className="w-4 h-4 text-[#2F7A4F]" />
                        {tier.includes.emails}
                      </li>
                      <li className="flex items-center gap-2 text-sm text-gray-700">
                        <MessageSquare className="w-4 h-4 text-[#2F7A4F]" />
                        {tier.includes.sms}
                      </li>
                      {tier.includes.website && (
                        <li className="flex items-center gap-2 text-sm text-gray-700">
                          <Globe className="w-4 h-4 text-[#2F7A4F]" />
                          Website + Ecommerce
                        </li>
                      )}
                    </ul>
                  </div>

                  {/* Overages */}
                  <div className="space-y-2 mb-6 pb-6 border-b border-gray-100">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Overages
                    </p>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>Email: {tier.overages.emails}</p>
                      <p>SMS: {tier.overages.sms}</p>
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="mt-auto">
                    <Button
                      onClick={() => handleGetStarted(tier.id)}
                      className={cn(
                        "w-full group",
                        tier.recommended
                          ? "bg-[#2F7A4F] hover:bg-[#256B42] text-white"
                          : "bg-gray-900 hover:bg-gray-800 text-white"
                      )}
                    >
                      Get Started
                      <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
