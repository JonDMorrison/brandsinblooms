
import { Card, CardContent } from "@/components/ui/card";

export const AddOnsSection = () => {
  const addOns = [
    {
      name: "White-Glove Setup",
      price: "$149 one-time",
      description: "We'll load in your brand voice, tone, and first 3 campaigns for you."
    },
    {
      name: "Monthly Strategy Call",
      price: "$49/month",
      description: "Book a 30-min monthly coaching call with our marketing team."
    }
  ];

  return (
    <section className="relative py-12 px-6 overflow-hidden">

      <div className="relative max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-brand-teal-mint via-brand-steel-blue to-brand-teal-mint bg-clip-text text-transparent">
            Add-Ons
          </h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {addOns.map((addOn, index) => (
            <Card key={index} className="group relative hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 rounded-2xl overflow-hidden border border-white/20 bg-white/60 backdrop-blur-sm">
              {/* Decorative background */}
              <div className="absolute inset-0 bg-gradient-to-br from-brand-teal-mint/5 to-brand-steel-blue/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              
              <CardContent className="relative p-6 pt-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-bold text-text-primary bg-gradient-to-r from-brand-steel-blue to-brand-teal-mint bg-clip-text text-transparent">
                    {addOn.name}
                  </h3>
                  <span className="text-2xl font-bold bg-gradient-to-r from-brand-teal-mint to-brand-steel-blue bg-clip-text text-transparent bg-white/50 backdrop-blur-sm rounded-lg px-3 py-1 border border-white/30">
                    {addOn.price}
                  </span>
                </div>
                <p className="text-text-secondary leading-relaxed">{addOn.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
