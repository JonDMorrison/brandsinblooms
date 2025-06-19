
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
    <section className="py-12 px-6 bg-white/60">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-semibold text-center mb-12 text-garden-green-dark">
          Frequently Asked Questions
        </h2>
        
        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`} className="border border-gray-200 rounded-xl px-6">
              <AccordionTrigger className="text-left text-garden-green-dark hover:no-underline">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
