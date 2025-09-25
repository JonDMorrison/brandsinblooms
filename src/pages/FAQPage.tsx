import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUp, Calendar, MessageCircle } from "lucide-react";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { useNavigate } from "react-router-dom";

const FAQPage = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("");

  const faqCategories = [
    {
      id: "overview",
      title: "Overview & Fit",
      icon: "🌟",
      questions: [
        {
          question: "What is BloomSuite?",
          answer: "BloomSuite is an all-in-one marketing platform specifically designed for garden centers and plant retailers. We combine email marketing, SMS campaigns, social media management, CRM, website hosting, and seasonal content creation into one powerful system that understands your unique business needs."
        },
        {
          question: "Who is BloomSuite designed for?",
          answer: "BloomSuite is built specifically for garden centers, nurseries, plant retailers, farm markets, and seasonal plant businesses. Our platform understands horticultural seasonality, peak planting times, and the unique challenges of selling living products that require timing-specific marketing."
        },
        {
          question: "Can I start small (just email/SMS) and expand later?",
          answer: "Absolutely! BloomSuite includes all features in one package, so you can start with email marketing and gradually expand to use SMS, social media, CRM, and our seasonal campaigns as your comfort and needs grow. There are no feature restrictions or upgrade tiers."
        }
      ]
    },
    {
      id: "pricing",
      title: "Pricing & Guarantees", 
      icon: "💰",
      questions: [
        {
          question: "How much does BloomSuite cost?",
          answer: "BloomSuite costs $2,999 per year (just $250/month when billed annually) and includes everything: unlimited emails, SMS credits, social scheduling, CRM, website hosting, seasonal campaigns, AI content creation, and expert support. No hidden fees or usage limits."
        },
        {
          question: "Why is $2,999/year a better deal than using separate tools?",
          answer: "Separate tools typically cost $4,200-$6,900+ annually: Mailchimp/Klaviyo ($1,200-$1,800), SMS tools ($600-$1,500), social scheduling ($1,200), hosting ($360-$600), and CRM ($600-$1,200). Plus, you get our unique garden center-specific features that aren't available anywhere else."
        },
        {
          question: "Do I get a price-lock guarantee?",
          answer: "Yes! We guarantee your annual rate for the full duration of your subscription. As long as you maintain continuous service, your price will never increase, even as we add new features and capabilities to the platform."
        },
        {
          question: "What's included vs. usage-based (e.g., SMS fees)?",
          answer: "Everything is included: unlimited emails, generous SMS credits (typically 5,000+ messages/month), social posting, website hosting, and all premium features. The only additional costs might be if you exceed our very generous SMS limits, which most garden centers never reach."
        },
        {
          question: "Do you offer trials or refunds?",
          answer: "We offer a 30-day free trial with full access to all features and no credit card required. If you're not completely satisfied within your first 30 days of paid service, we'll provide a full refund, no questions asked."
        }
      ]
    },
    {
      id: "migration",
      title: "Getting Started & Migration",
      icon: "🔄", 
      questions: [
        {
          question: "How do I migrate my newsletter subscribers?",
          answer: "Our migration specialists handle this for you! We can import subscribers from any platform (Mailchimp, Constant Contact, etc.) while maintaining compliance and opt-in status. We'll also help you set up welcome sequences and re-engagement campaigns during the transition."
        },
        {
          question: "Do you help transfer my domain name?",
          answer: "Yes! Our technical team assists with domain transfers and DNS setup at no extra charge. We can also help you keep your existing domain while pointing it to your new BloomSuite website, ensuring zero downtime during the transition."
        },
        {
          question: "What's involved in moving from Mailchimp, Shopify, or Squarespace?",
          answer: "We provide white-glove migration service including subscriber import, template recreation, automation setup, and domain transfer. Most migrations are completed within 5-7 business days with dedicated support to ensure nothing is lost and everything works better than before."
        },
        {
          question: "How long does setup typically take?",
          answer: "Basic setup takes 2-3 days, with full migration and customization typically completed within 7-14 days. We work at your pace and provide training sessions to ensure you're confident using all features before going live."
        }
      ]
    },
    {
      id: "website",
      title: "Website & Ecommerce",
      icon: "🌐",
      questions: [
        {
          question: "Do I get my own domain name?",
          answer: "Yes! BloomSuite includes professional website hosting and you can use your existing domain or register a new one. We handle all technical setup, SSL certificates, and ensure your site loads fast with 99.9% uptime guarantee."
        },
        {
          question: "Can I sell products online through BloomSuite?",
          answer: "Absolutely! BloomSuite includes full e-commerce capabilities with shopping cart, payment processing, inventory tracking, and automatic integration with your email marketing for abandoned cart recovery and post-purchase follow-ups."
        },
        {
          question: "Do you replace my POS system?",
          answer: "BloomSuite integrates with most existing POS systems rather than replacing them. We sync customer data, purchase history, and inventory levels to power your marketing campaigns while letting you keep the POS system you're comfortable with."
        },
        {
          question: "Does BloomSuite track inventory?",
          answer: "Yes! Our system tracks inventory for online sales and integrates with many POS systems to sync in-store inventory. You'll get low-stock alerts and can automatically promote items that are overstocked or seasonal clearance items."
        }
      ]
    },
    {
      id: "crm",
      title: "CRM & Segmentation", 
      icon: "👥",
      questions: [
        {
          question: "What does the CRM include?",
          answer: "Our CRM tracks customer purchase history, preferences, lifecycle stage (new, loyal, lapsed), seasonal buying patterns, and engagement history. It automatically creates customer personas and suggests the best times and products to market to each segment."
        },
        {
          question: "Can I segment by purchases, personas, or locations?",
          answer: "Yes! Segment customers by purchase history, plant preferences, seasonal shopping patterns, geographic location, engagement level, or any custom criteria. Our AI automatically suggests relevant segments based on your customer behavior patterns."
        },
        {
          question: "Does BloomSuite work for multiple locations?",
          answer: "Absolutely! BloomSuite supports multi-location businesses with location-specific inventory, staff permissions, localized campaigns, and consolidated reporting. Each location can have customized content while maintaining brand consistency across all sites."
        }
      ]
    },
    {
      id: "messaging",
      title: "Email, SMS & Social",
      icon: "📧",
      questions: [
        {
          question: "How do you ensure strong email deliverability?",
          answer: "We maintain premium relationships with major email providers, authenticate all domains properly, monitor sender reputation closely, and follow strict compliance guidelines. Our average deliverability rate exceeds 98%, significantly higher than most DIY platforms."
        },
        {
          question: "Are SMS opt-ins and opt-outs compliant and automatic?",
          answer: "Yes! BloomSuite automatically handles all SMS compliance including TCPA requirements, automatic opt-out processing, consent tracking, and proper opt-in workflows. We stay current with all telecommunications regulations so you don't have to worry about compliance issues."
        },
        {
          question: "Can I schedule social posts in advance?",
          answer: "Yes! Our social media scheduler supports Facebook, Instagram, Twitter, and LinkedIn with bulk scheduling, seasonal campaign templates, and automatic posting of your latest blog posts or promotions. You can plan months of content in advance."
        }
      ]
    },
    {
      id: "content",
      title: "Content Library & Seasonal Calendar",
      icon: "📚",
      questions: [
        {
          question: "What's included in the content library?",
          answer: "Our content library includes thousands of garden center-specific templates, seasonal campaign ideas, plant care tips, holiday promotions, and educational content. All content is written by horticulture experts and updated regularly with new seasonal themes."
        },
        {
          question: "How do seasonal campaigns work?",
          answer: "Our AI automatically suggests campaigns based on your local climate zone, peak planting seasons, and historical customer behavior. Campaigns include email sequences, social posts, website banners, and SMS follow-ups all timed perfectly for maximum impact in your region."
        },
        {
          question: "Can I customize templates for my own brand?",
          answer: "Absolutely! Every template is fully customizable with your colors, fonts, logo, and messaging. Our brand training feature learns your voice and style, so AI-generated content automatically matches your unique brand personality and tone."
        }
      ]
    },
    {
      id: "analytics",
      title: "Analytics & ROI",
      icon: "📊", 
      questions: [
        {
          question: "How do you measure campaign ROI?",
          answer: "BloomSuite tracks revenue attribution from email opens to final purchases, showing exact ROI for each campaign, customer segment, and marketing channel. You'll see which campaigns drive the most sales, highest customer lifetime value, and best return on investment."
        },
        {
          question: "Can I see which emails or texts actually drove sales?",
          answer: "Yes! Our advanced tracking shows the complete customer journey from email click or SMS tap through to purchase completion. You'll know exactly which messages drove revenue, which products are most responsive to marketing, and which customers are most valuable."
        }
      ]
    },
    {
      id: "security",
      title: "Security, Privacy & Compliance",
      icon: "🔒",
      questions: [
        {
          question: "How is my data protected?",
          answer: "BloomSuite uses enterprise-grade security with 256-bit SSL encryption, SOC 2 Type II compliance, regular security audits, and data centers with physical security. All customer data is encrypted both in transit and at rest with multiple backup layers."
        },
        {
          question: "Do you sell or share my customer lists?",
          answer: "Never! Your customer data is 100% yours and completely confidential. We never sell, share, or use your customer information for any purpose other than providing you service. You can export your data anytime and we'll permanently delete it upon request."
        },
        {
          question: "Where is my data hosted?",
          answer: "All data is hosted in secure, SOC 2 compliant data centers in North America with 99.9% uptime SLAs. We maintain multiple geographic backups and can provide specific data residency requirements for Canadian or international customers upon request."
        },
        {
          question: "Are you GDPR/CCPA/PIPEDA compliant?",
          answer: "Yes! BloomSuite is fully compliant with GDPR, CCPA, PIPEDA, and other major privacy regulations. We provide built-in consent management, data portability, deletion tools, and privacy controls to help you meet all regulatory requirements effortlessly."
        }
      ]
    },
    {
      id: "ai",
      title: "AI Content",
      icon: "🤖",
      questions: [
        {
          question: "Which AI models do you use?",
          answer: "We use a combination of advanced language models specifically trained on garden center marketing, horticulture knowledge, and seasonal retail patterns. Our AI is continuously updated with the latest plant care information and marketing best practices for garden centers."
        },
        {
          question: "How do you safeguard against incorrect or off-brand outputs?",
          answer: "All AI content goes through multiple validation layers including horticultural accuracy checks, brand voice verification, and compliance screening. You can set approval workflows, and our system learns from your feedback to continuously improve content quality and brand alignment."
        },
        {
          question: "Do I approve content before it's sent?",
          answer: "Yes! You have complete control over all content before it goes live. You can set up automatic approval for routine content or require manual review for everything. Our system also provides content previews and scheduling options so you're always in control."
        }
      ]
    },
    {
      id: "reliability",
      title: "Reliability & Backups",
      icon: "⚡",
      questions: [
        {
          question: "What is your uptime guarantee?",
          answer: "BloomSuite guarantees 99.9% uptime with comprehensive monitoring and immediate issue resolution. In the rare event we don't meet our uptime commitment, you'll receive service credits automatically applied to your account."
        },
        {
          question: "Do you back up my data daily?",
          answer: "Yes! We perform automatic daily backups with multiple geographic redundancies, point-in-time recovery options, and 30-day backup retention. Your data is protected against any technical issues, and we can restore to any point within the last 30 days if needed."
        },
        {
          question: "Do you have a public status page?",
          answer: "Yes! Our status page provides real-time system performance updates, scheduled maintenance notifications, and historical uptime data. You can subscribe to status updates to stay informed about any service changes or improvements."
        }
      ]
    },
    {
      id: "support",
      title: "Support & Service",
      icon: "🤝",
      questions: [
        {
          question: "Do I get human technical support?",
          answer: "Absolutely! Every BloomSuite customer gets access to our expert support team during business hours, with priority phone and email support. No chatbots or outsourced support – you'll speak directly with our knowledgeable team members who understand garden center operations."
        },
        {
          question: "Do your support staff understand horticulture and garden centers?",
          answer: "Yes! Our support team includes horticulture experts and garden center marketing specialists who understand seasonal challenges, plant care questions, and the unique aspects of marketing living products. They can help with both technical issues and marketing strategy."
        },
        {
          question: "Can I get help with marketing strategy, not just technical issues?",
          answer: "Definitely! Our team provides strategic marketing advice, campaign optimization, seasonal planning, and best practices consultation. We're not just technical support – we're your partner in growing your garden center business through better marketing."
        }
      ]
    },
    {
      id: "training",
      title: "Courses & Community",
      icon: "🎓",
      questions: [
        {
          question: "Do I get training on how to use BloomSuite?",
          answer: "Yes! Every customer receives comprehensive onboarding training, ongoing educational webinars, and access to our complete video tutorial library. We also provide one-on-one training sessions to ensure you're confident using all features effectively."
        },
        {
          question: "What courses are included?",
          answer: "Our learning library includes courses on email marketing best practices, seasonal campaign planning, CRM optimization, social media strategy, content creation, and garden center business growth strategies. New courses are added monthly based on customer requests and industry trends."
        },
        {
          question: "Is there a private community of garden center owners?",
          answer: "Yes! BloomSuite customers get access to our exclusive Garden Center Marketing Community where you can connect with other owners, share successful campaigns, ask questions, and learn from industry peers. It's moderated by our experts and includes monthly networking events."
        }
      ]
    },
    {
      id: "contracts",
      title: "Contracts & Exit",
      icon: "📋",
      questions: [
        {
          question: "Do I own my customer data and content?",
          answer: "100% yes! You own all customer data, content, and intellectual property you create in BloomSuite. We're simply the platform that helps you manage it. Your data ownership is clearly stated in our terms of service with no ambiguity."
        },
        {
          question: "What happens if I cancel my subscription?",
          answer: "You can cancel anytime with 30 days notice. We'll provide you with complete exports of all your data, content, and customer information in standard formats. Your data remains accessible for 60 days after cancellation to ensure smooth transition to any other platform."
        },
        {
          question: "Can I export my data easily?",
          answer: "Absolutely! BloomSuite provides one-click data exports in standard formats (CSV, JSON, XML) for all your customer data, email templates, campaign history, and analytics. We never lock you in – your data is always portable and accessible."
        }
      ]
    },
    {
      id: "non-garden",
      title: "For Non-Garden Retailers", 
      icon: "🏪",
      questions: [
        {
          question: "Can BloomSuite be used for gift/greeting shops or farm markets?",
          answer: "While BloomSuite is optimized for garden centers, many seasonal retailers, farm markets, gift shops, and agriculture-related businesses find value in our platform. Our seasonal marketing features and CRM capabilities work well for any business with seasonal patterns or outdoor/agricultural focus."
        },
        {
          question: "How does the seasonal calendar adapt to non-garden industries?",
          answer: "Our seasonal calendar can be customized for any retail calendar including farm market seasons, holiday gift cycles, agricultural events, or other seasonal business patterns. The AI learns your specific seasonal needs and suggests campaigns accordingly, making it flexible beyond just garden centers."
        }
      ]
    }
  ];

  const scrollToCategory = (categoryId: string) => {
    const element = document.getElementById(`category-${categoryId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveCategory(categoryId);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/30">
      <LandingPageHeader onLogin={() => navigate('/auth')} />
      
      {/* Hero Section */}
      <section className="py-16 px-6 bg-gradient-to-r from-primary/10 via-background to-brand-teal-mint/10">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-accent mb-6">
            Frequently Asked Questions
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Everything you need to know about BloomSuite, from getting started to advanced features. 
            If you can't find your answer here, our expert team is always ready to help.
          </p>
        </div>
      </section>

      {/* Table of Contents */}
      <section className="py-12 px-6 bg-white/60 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-accent mb-8 text-center">Quick Navigation</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {faqCategories.map((category) => (
              <Card 
                key={category.id}
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-1 bg-white/80 border border-primary/20"
                onClick={() => scrollToCategory(category.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <h3 className="font-semibold text-accent text-sm">{category.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {category.questions.length} questions
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Categories */}
      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto space-y-12">
          {faqCategories.map((category, categoryIndex) => (
            <div key={category.id} id={`category-${category.id}`} className="scroll-mt-24">
              {/* Category Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="bg-gradient-to-r from-primary to-brand-teal-mint p-3 rounded-xl">
                  <span className="text-2xl">{category.icon}</span>
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-accent">
                    {category.title}
                  </h2>
                  <Badge variant="outline" className="mt-1">
                    {category.questions.length} questions
                  </Badge>
                </div>
              </div>

              {/* Questions Accordion */}
              <Card className="bg-white/90 backdrop-blur-sm border border-primary/20 shadow-lg">
                <CardContent className="p-6">
                  <Accordion type="multiple" className="space-y-4">
                    {category.questions.map((faq, faqIndex) => (
                      <AccordionItem
                        key={`${categoryIndex}-${faqIndex}`}
                        value={`item-${categoryIndex}-${faqIndex}`}
                        className="border border-muted/30 rounded-xl bg-white/60 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 px-6"
                      >
                        <AccordionTrigger className="text-left hover:no-underline font-semibold text-accent py-4">
                          {faq.question}
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4 leading-relaxed">
                          {faq.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 px-6 bg-gradient-to-r from-primary/10 via-background to-brand-teal-mint/10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white/90 backdrop-blur-sm border border-primary/20 rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-bold text-accent mb-4">
              Still Have Questions?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Our garden center marketing experts are here to help you succeed. 
              Schedule a personalized demo and get all your questions answered.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg"
                className="bg-gradient-to-r from-primary to-brand-teal-mint hover:from-brand-teal-mint hover:to-primary text-white py-3 px-8 text-lg font-semibold transition-all duration-300 hover:scale-105 shadow-lg"
                onClick={() => navigate('/auth')}
              >
                <Calendar className="w-5 h-5 mr-2" />
                Schedule a Demo Call
              </Button>
              
              <Button 
                variant="outline"
                size="lg"
                className="border-primary text-primary hover:bg-primary hover:text-white py-3 px-8 text-lg transition-all duration-300"
                onClick={() => navigate('/pricing')}
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Start Free Trial
              </Button>
            </div>
            
            <div className="mt-6 text-sm text-muted-foreground">
              <div className="flex flex-wrap justify-center gap-4">
                <span>✅ 30-day free trial</span>
                <span>✅ No credit card required</span>
                <span>✅ Expert onboarding included</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Back to Top Button */}
      <Button
        onClick={scrollToTop}
        size="icon"
        className="fixed bottom-6 right-6 bg-gradient-to-r from-primary to-brand-teal-mint hover:from-brand-teal-mint hover:to-primary text-white shadow-lg z-50"
      >
        <ArrowUp className="w-5 h-5" />
      </Button>
    </div>
  );
};

export default FAQPage;