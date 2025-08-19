
import { Card, CardContent } from "@/components/ui/card";
import { Star, Leaf } from "lucide-react";

export const TestimonialsSection = () => {
  const testimonials = [
    {
      name: "Sarah Chen",
      business: "Bloom & Grow Nursery",
      quote: "BloomSuite's CRM and automation features have revolutionized how we connect with customers. Our follow-up campaigns run automatically, and sales have increased 40% since we started using the platform.",
      rating: 5
    },
    {
      name: "Mike Rodriguez",
      business: "Garden Valley Center",
      quote: "The AI content generation is incredible – it creates social posts, emails, and blog articles that sound exactly like our brand voice. The analytics dashboard shows we're reaching 3x more customers than before.",
      rating: 5
    },
    {
      name: "Emma Thompson",
      business: "Green Thumb Gardens",
      quote: "Having all our marketing tools in one place – social planning, email campaigns, customer management, and analytics – has saved us 15 hours per week. The ROI tracking shows exactly which campaigns drive sales.",
      rating: 5
    }
  ];

  return (
    <section className="py-24 px-6 bg-[#E9F5EC]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="text-4xl font-bold mb-6 text-gray-900">
            Loved by Garden Centers Everywhere
          </h2>
          <p className="text-xl text-[#6B7280] max-w-3xl mx-auto">
            Join hundreds of garden centers who've transformed their marketing and grown their business.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card 
              key={index} 
              className="apple-fade-in-stagger p-8 rounded-2xl bg-white border-2 border-[#47B881]/10 hover:border-[#47B881]/20 shadow-sm hover:shadow-lg transition-all duration-300"
              style={{animationDelay: `${index * 0.1}s`}}
            >
              <CardContent className="p-0">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 fill-[#F4C430] text-[#F4C430]" />
                  ))}
                </div>
                <blockquote className="text-[#6B7280] text-lg leading-relaxed mb-6 italic">
                  "{testimonial.quote}"
                </blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#E9F5EC] rounded-full flex items-center justify-center">
                    <Leaf className="w-5 h-5 text-[#47B881]" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-[#6B7280]">{testimonial.business}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
