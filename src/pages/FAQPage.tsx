import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, Calendar, MessageCircle, Sprout, DollarSign, Shield, Users, Settings, ShoppingCart, MessageSquare, Zap } from "lucide-react";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { useNavigate } from "react-router-dom";
import { VideoModal } from "@/components/ui/video-modal";
import faqHero from "@/assets/faq-hero.jpg";
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
    }, {
      question: "How do I import my existing contacts from Mailchimp or Klaviyo?",
      answer: "Our AI-powered migration wizard connects directly to your existing platform, previews your data, and suggests intelligent persona and segment mappings. It automatically imports your contacts, preserving tags, purchase history, and consent records — typically in under 15 minutes."
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
      answer: "BloomSuite offers four plans starting at $199/month: Seed ($199) for CRM and messaging, Sprout ($349) adds a website, Bloom ($699) includes higher volumes for growing centers, and Thrive ($1,199) offers unlimited emails for multi-location retailers. All plans include the full platform — no hidden fees."
    }, {
      question: "Will my price go up later?",
      answer: "Founding customers who join during the Launch Program lock in introductory pricing for life, as long as their subscription remains active. Future customers will pay standard rates."
    }, {
      question: "Are there any extra fees?",
      answer: "Each plan includes generous email and SMS volumes. If you exceed your limits, overage rates are transparent: $0.002/email and $0.03/SMS. You'll see usage in your dashboard and get alerts at 80% and 100%."
    }, {
      question: "Can I switch plans as my garden centre grows?",
      answer: "Absolutely! You can upgrade or downgrade at any time. Upgrades take effect immediately with access to higher limits. Downgrades apply at your next billing cycle."
    }]
  }, {
    id: "ecommerce",
    title: "E-Commerce",
    icon: ShoppingCart,
    cta: {
      text: "Ready to start selling plants online?",
      action: "Learn more about E-Commerce",
      onClick: () => navigate('/ecomm')
    },
    questions: [{
      question: "What is BloomSuite E-Commerce?",
      answer: "BloomSuite E-Commerce is a ship-on-demand model where you sell plants online through your own branded storefront, while our network of approved nursery partners handles fulfillment. You get all the benefits of online sales without managing inventory, packing, or shipping."
    }, {
      question: "What does 'seller of record' mean?",
      answer: "You remain the seller of record — customers buy from your garden center's brand, not BloomSuite. You control pricing, maintain customer relationships, and keep all customer data. We simply provide the platform and fulfillment network."
    }, {
      question: "Do I need to manage inventory?",
      answer: "No. Orders are automatically routed to approved nursery partners who ship directly to your customers. You never touch the product — just focus on marketing and customer service."
    }, {
      question: "How does pricing work with E-Commerce?",
      answer: "Nurseries set wholesale prices, and you set your own retail markup and margins. BloomSuite charges a simple 5% platform fee on product subtotals only — not on shipping or taxes. You keep the rest."
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
      answer: "Yes. BloomSuite integrates with Shopify and Square so you can take payments and sync sales data. Plus, our new E-Commerce feature lets you sell plants ship-on-demand without managing inventory."
    }, {
      question: "What's included in the CRM?",
      answer: "A full customer database with personas, segments, and purchase history (when connected to your POS). Perfect for sending the right message to the right people."
    }, {
      question: "What about content?",
      answer: "BloomSuite includes a seasonal marketing calendar and ready-to-use content blocks you can customize for your brand. All generated content is shaped by your verified location and climate profile."
    }, {
      question: "Is the AI content based on USDA zones or exact frost dates?",
      answer: "BloomSuite uses your verified location to assign a regional climate profile, such as hot and dry desert or cold continental. This profile shapes all content and image generation with strict rules about what to recommend and what to avoid. We do not currently pull live USDA zone data or exact frost dates from external sources. When specific dates are unknown, content uses conditional language like after your last frost and recommends checking with local extension offices. This approach prevents bad recommendations while remaining honest about what we know."
    }, {
      question: "What SMS features are included?",
      answer: "BloomSuite includes promotional and transactional SMS messaging with automated opt-in/opt-out handling, carrier compliance (10DLC registration), customizable message frequency controls, and real-time delivery tracking. Send flash sales, appointment reminders, or order updates."
    }, {
      question: "Can I automate my marketing?",
      answer: "Absolutely. Our automation engine lets you create workflows triggered by purchases, loyalty enrollments, segment additions, birthdays, and more. Set up welcome series, win-back campaigns, or VIP rewards — all running automatically."
    }, {
      question: "Which POS systems does BloomSuite integrate with?",
      answer: "We integrate with Square and Clover, automatically syncing customer data, purchase history, and loyalty program activity. Connect your POS in minutes and start seeing real customer insights immediately."
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
    }, {
      question: "Is BloomSuite compliant with SMS carrier regulations?",
      answer: "Yes. We handle A2P 10DLC registration, automatic STOP/HELP keyword responses, carrier-approved messaging practices, and maintain a compliance dashboard so you can monitor opt-in rates and delivery health."
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
      <section className="relative py-20 px-6 overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src={faqHero} 
            alt="Garden center customer service" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-white/90 mb-8 leading-relaxed">Everything you need to know about BloomSuite.</p>
          
          {/* Quick Navigation */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-12">
            {faqCategories.map(category => {
            const IconComponent = category.icon;
            return <Button key={category.id} variant="outline" onClick={() => scrollToCategory(category.id)} className="flex flex-col items-center gap-2 h-auto py-4 px-3 bg-white/95 hover:bg-white border-2 border-white/50 hover:border-primary/40 transition-all group shadow-lg hover:shadow-xl">
                  <IconComponent className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-medium text-center leading-tight text-gray-800">{category.title}</span>
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