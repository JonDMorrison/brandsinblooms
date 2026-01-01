import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { SMS_BRAND_CONFIG } from '@/config/smsConfig';

const faqs = [
  {
    question: 'How often will you text me?',
    answer: `We send ${SMS_BRAND_CONFIG.message_frequency_text} text messages. Message frequency varies based on your preferences and our promotional calendar.`,
  },
  {
    question: 'How do I opt out?',
    answer: 'Reply STOP to any message to immediately unsubscribe from our SMS program. You will receive a confirmation that you have been removed from our list.',
  },
  {
    question: 'What data is collected?',
    answer: 'We collect your mobile phone number and, optionally, your first name. This information is used solely to send you SMS messages as part of this program.',
  },
  {
    question: 'Will you sell my data?',
    answer: 'No. We do not sell, rent, or share your personal information with third parties for their marketing purposes. Your number is used only for the SMS program you joined.',
  },
  {
    question: 'What about costs and carrier rates?',
    answer: 'Standard message and data rates from your mobile carrier may apply. BloomSuite does not charge for receiving our messages, but your carrier may.',
  },
  {
    question: 'How can I rejoin after opting out?',
    answer: `If you previously opted out and want to rejoin, you can text ${SMS_BRAND_CONFIG.opt_in_keyword_primary} to our program number or use the signup form on this page.`,
  },
];

export const FaqAccordion = () => {
  return (
    <section className="py-12 px-6 bg-muted/20">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground text-center mb-8">
          Frequently Asked Questions
        </h2>
        
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left text-foreground hover:text-foreground/80">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};
