
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";

export const TestimonialsSection = () => {
  return (
    <section className="py-12 px-6 bg-white/60">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-2xl font-semibold text-center mb-16 text-garden-green-dark">
          What Garden Center Owners Say
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="p-8 relative hover:shadow-xl transition-all duration-300 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-4">
              <div className="flex mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-garden-green text-garden-green" />
                ))}
              </div>
              <p className="text-base text-gray-600 mb-6 italic leading-relaxed">
                "This saved us hours every week. We finally look professional online and our customers notice the difference."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                  L
                </div>
                <div>
                  <div className="font-semibold text-garden-green-dark">Linda Chen</div>
                  <div className="text-sm text-gray-600">Maple Grove Greenhouse</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="p-8 relative hover:shadow-xl transition-all duration-300 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-4">
              <div className="flex mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-garden-green text-garden-green" />
                ))}
              </div>
              <p className="text-base text-gray-600 mb-6 italic leading-relaxed">
                "We posted our Spring campaign and sold out of everything in three days. Best investment we've made."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                  C
                </div>
                <div>
                  <div className="font-semibold text-garden-green-dark">Carlos Rodriguez</div>
                  <div className="text-sm text-gray-600">Bloom Market Garden Center</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="p-8 relative hover:shadow-xl transition-all duration-300 rounded-2xl bg-garden-sage border border-gray-200">
            <CardContent className="pt-4">
              <div className="flex mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-garden-green text-garden-green" />
                ))}
              </div>
              <p className="text-base text-gray-600 mb-6 italic leading-relaxed">
                "The seasonal content is perfect. It's like having a marketing expert on our team without the cost."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg mr-4">
                  M
                </div>
                <div>
                  <div className="font-semibold text-garden-green-dark">Maria Thompson</div>
                  <div className="text-sm text-gray-600">Sunshine Nursery & Garden</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};
