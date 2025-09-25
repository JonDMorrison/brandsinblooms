import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, Calendar, MessageCircle, Sprout, DollarSign, Shield, Users, Settings } from "lucide-react";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { useNavigate } from "react-router-dom";
import { VideoModal } from "@/components/ui/video-modal";
const FAQPage = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [isVideoModalOpen, setIsVideoModalOpen] = useState<boolean>(false);
  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(categoryId);
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
      setActiveCategory(categoryId);
    }
  };
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  const faqCategories = [{
    id: "getting-started",
    title: "Getting Started & Migration",
    icon: Sprout,
    cta: {
      text: "Still wondering how migration works?",
      action: "Book a demo call",
      onClick: () => navigate('/auth')
    },
    questions: [{
      question: "Is it hard to switch to BloomSuite?",
      answer: "Not at all. We help you import your subscriber lists, transfer your domain, and set up your first campaigns. Most centers are sending their first email or text within days."
    }, {
      question: "Can you help me move from Mailchimp or Squarespace?",
      answer: "Yes. We've migrated customers from Mailchimp, Klaviyo, Constant Contact, Shopify, and Squarespace. We do the heavy lifting so you don't lose subscribers or content."
    }, {
      question: "What if my team isn't tech-savvy?",
      answer: "That's exactly why we built BloomSuite. We keep things simple, and our support team is only a call or email away when you need help."
    }]
  }, {
    id: "pricing",
    title: "Pricing & Guarantees",
    icon: DollarSign,
    cta: {
      text: "Compare what you're paying today with our",
      action: "Pricing Comparison",
      onClick: () => navigate('/pricing')
    },
    questions: [{
      question: "How much does BloomSuite cost?",
      answer: "BloomSuite is $2,999 per year. That replaces $4,200–$6,900 in separate subscriptions for Mailchimp, Buffer, Squarespace, SMS tools, CRMs, and analytics."
    }, {
      question: "Will my price go up later?",
      answer: "No. Your $2,999/year rate is locked in as long as you're an active customer."
    }, {
      question: "Are there any extra fees?",
      answer: "Everything is included. The only usage-based costs are SMS carrier fees (usually pennies per message), and you'll see estimates before sending."
    }]
  }, {
    id: "features",
    title: "Features & Benefits",
    icon: Settings,
    cta: {
      text: "Want to see BloomSuite in action?",
      action: "Watch the demo",
      onClick: () => setIsVideoModalOpen(true)
    },
    questions: [{
      question: "Do I get my own domain?",
      answer: "Yes, your site runs on your own domain with SSL security included."
    }, {
      question: "Can I sell online?",
      answer: "Yes. BloomSuite integrates with Shopify and Square so you can take payments and sync sales data."
    }, {
      question: "What's included in the CRM?",
      answer: "A full customer database with personas, segments, and purchase history (when connected to your POS). Perfect for sending the right message to the right people."
    }, {
      question: "What about content?",
      answer: "BloomSuite includes a seasonal marketing calendar and ready-to-use content blocks you can customize for your brand."
    }]
  }, {
    id: "security",
    title: "Security & Reliability",
    icon: Shield,
    cta: {
      text: "Questions about security?",
      action: "Talk to our team",
      onClick: () => window.open('mailto:jeff@brandsinblooms.com', '_blank')
    },
    questions: [{
      question: "Is my data safe?",
      answer: "Yes. We use enterprise-level encryption, daily backups, and modern cloud hosting. Your customer data is yours alone — never sold or shared."
    }, {
      question: "How reliable is the platform?",
      answer: "We design for 99.9% uptime with redundant servers. You can check our live status page anytime."
    }, {
      question: "Is BloomSuite compliant with privacy laws?",
      answer: "Yes. We support GDPR, CCPA, and PIPEDA requirements, including consent management and easy opt-outs."
    }]
  }, {
    id: "support",
    title: "Support, Training & Community",
    icon: Users,
    cta: {
      text: "Need a hand right now?",
      action: "Contact Support",
      onClick: () => window.open('mailto:jeff@brandsinblooms.com', '_blank')
    },
    questions: [{
      question: "Do I get human support?",
      answer: "Yes — real people, not bots. Our team knows horticulture and loves helping garden center owners succeed."
    }, {
      question: "Do you provide training?",
      answer: "Yes. Your subscription includes unlimited access to our full training library, from beginner tutorials to advanced marketing strategy."
    }, {
      question: "Is there a community?",
      answer: "Yes. You'll join a private group of garden center leaders who share ideas, strategies, and encouragement."
    }]
  }];
  return <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/30">
      {/* Header */}
      <LandingPageHeader onLogin={() => navigate('/auth')} />
      
      {/* Hero Section */}
      <section className="py-16 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-accent mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">Everything you need to know about BloomSuite.</p>
          
          {/* Quick Navigation */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-12">
            {faqCategories.map(category => {
            const IconComponent = category.icon;
            return <Button key={category.id} variant="outline" onClick={() => scrollToCategory(category.id)} className="flex flex-col items-center gap-2 h-auto py-4 px-3 bg-card hover:bg-primary/5 border-2 hover:border-primary/20 transition-all group">
                  <IconComponent className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-center leading-tight text-black">{category.title}</span>
                </Button>;
          })}
          </div>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          {faqCategories.map((category, categoryIndex) => {
          const IconComponent = category.icon;
          return <div key={category.id} id={category.id} className="mb-16 scroll-mt-20">
                <div className="flex items-center gap-4 mb-8">
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/20">
                    <IconComponent className="h-6 w-6 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold text-accent">{category.title}</h2>
                </div>
                
                <Accordion type="single" collapsible className="space-y-3">
                  {category.questions.map((faq, index) => <AccordionItem key={index} value={`${categoryIndex}-${index}`} className="border-0 rounded-lg bg-card shadow-sm hover:shadow-md transition-shadow">
                      <AccordionTrigger className="text-left hover:no-underline py-6 px-6 group">
                        <div className="flex items-start gap-4 w-full">
                          <span className="font-semibold text-accent group-hover:text-primary transition-colors flex-1 text-left pr-4 text-lg">
                            {faq.question}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-6 px-6">
                        <p className="text-foreground text-lg leading-relaxed pl-0 font-medium">{faq.answer}</p>
                      </AccordionContent>
                    </AccordionItem>)}
                </Accordion>

                {/* Category CTA */}
                {category.cta && <div className="mt-8 p-6 bg-gradient-to-r from-primary/5 to-brand-teal-mint/5 border border-primary/10 rounded-lg">
                    <p className="text-center text-muted-foreground">
                      {category.cta.text}{' '}
                      <Button variant="link" onClick={category.cta.onClick} className="h-auto p-0 text-primary hover:text-primary/80 underline">
                        {category.cta.action}
                      </Button>
                    </p>
                  </div>}
              </div>;
        })}
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-16 px-6 bg-gradient-to-r from-primary/10 via-brand-teal-mint/10 to-primary/10">
        <div className="max-w-3xl mx-auto">
          <Card className="p-8 bg-card/95 backdrop-blur-sm border-2 border-primary/20 shadow-xl">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-accent mb-4">
                Still have questions? We'd love to talk.
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Schedule a free demo call and see how BloomSuite can simplify your marketing.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button size="lg" onClick={() => navigate('/auth')} className="bg-gradient-to-r from-primary to-brand-teal-mint hover:from-primary/90 hover:to-brand-teal-mint/90 text-white px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all">
                  Book a Demo Call
                </Button>
                
                <Button size="lg" variant="outline" onClick={() => navigate('/contact')} className="border-2 border-primary text-primary hover:bg-primary hover:text-white px-8 py-4 text-lg font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all">
                  Contact Us
                </Button>
              </div>
              
              <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  <span>7-day free trial</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  <span>No setup fees</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary rounded-full"></span>
                  <span>Cancel anytime</span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Back to Top Button */}
      <Button onClick={scrollToTop} className="fixed bottom-8 right-8 rounded-full p-3 shadow-lg bg-primary hover:bg-primary/90 text-white z-50 transition-all hover:scale-110" size="icon">
        <ArrowUp className="h-5 w-5" />
      </Button>

      {/* Video Modal */}
      <VideoModal open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen} title="BloomSuite Demo" embedCode='<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/5af2b9d8029f4f3b943c7416568cef5b?sid=48173041-f162-4796-ba14-0de362456bf7" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>' />
    </div>;
};
export default FAQPage;