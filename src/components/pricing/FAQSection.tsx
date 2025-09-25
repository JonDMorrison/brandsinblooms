
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const FAQSection = () => {
  const faqs = [
    {
      question: "Is there a free trial?",
      answer: "Yes! We offer a 14-day free trial with no credit card required. You'll have full access to all features during your trial period."
    },
    {
      question: "Can I cancel anytime?",
      answer: "Absolutely. You can cancel your subscription at any time from your account settings. There are no cancellation fees or long-term contracts."
    },
    {
      question: "Do you offer discounts for co-ops or multi-location groups?",
      answer: "Yes! We offer special pricing for garden center cooperatives and multi-location businesses. Contact our sales team for custom pricing options."
    },
    {
      question: "Will this work for my garden center's brand?",
      answer: "Definitely! Our AI learns your unique brand voice and tone from your website and existing content to create personalized marketing materials that sound authentically you."
    },
    {
      question: "What kind of support do you offer?",
      answer: "All plans include email support. Bloom plan subscribers get priority support with faster response times. We also offer optional monthly strategy calls for additional guidance."
    }
  ];

  return (
    <section className="relative py-12 px-6 overflow-hidden bg-gradient-to-br from-brand-steel-blue/5 via-surface-primary to-brand-teal-mint/10">
      <div className="relative max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-brand-steel-blue via-brand-teal-mint to-brand-steel-blue bg-clip-text text-transparent">
            Frequently Asked Questions
          </h2>
        </div>
        
        <div className="bg-white/40 backdrop-blur-sm border border-white/30 rounded-2xl p-8 shadow-2xl">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="border border-white/30 rounded-xl bg-white/60 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 px-6"
              >
                <AccordionTrigger className="text-left text-text-primary hover:no-underline font-semibold bg-gradient-to-r from-brand-steel-blue to-text-primary bg-clip-text text-transparent">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-text-secondary pb-4 leading-relaxed">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
