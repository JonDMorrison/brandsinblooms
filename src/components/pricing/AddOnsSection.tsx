
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
    <section className="py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold text-center mb-12 text-garden-green-dark">
          Add-Ons
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {addOns.map((addOn, index) => (
            <Card key={index} className="p-6 hover:shadow-lg transition-all duration-300 rounded-2xl">
              <CardContent className="pt-2">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-semibold text-garden-green-dark">
                    {addOn.name}
                  </h3>
                  <span className="text-xl font-bold text-garden-green">
                    {addOn.price}
                  </span>
                </div>
                <p className="text-gray-600">{addOn.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
