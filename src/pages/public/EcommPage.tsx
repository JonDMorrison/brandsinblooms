import { useNavigate } from 'react-router-dom';
import { LandingPageHeader } from '@/components/landing/LandingPageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ShoppingCart,
  CreditCard,
  Calculator,
  Truck,
  Package,
  Users,
  Store,
  Shield,
  DollarSign,
  Mail,
  Headphones,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';

// Import images
import heroImage from '@/assets/ecomm-hero.jpg';
import builtForGcImage from '@/assets/ecomm-built-for-gc.jpg';
import sellerOfRecordImage from '@/assets/ecomm-seller-of-record.jpg';
import howItWorksImage from '@/assets/ecomm-how-it-works.jpg';
import nurseryMapImage from '@/assets/ecomm-nursery-map.jpg';
import pricingImage from '@/assets/ecomm-pricing.jpg';
import followupImage from '@/assets/ecomm-followup.jpg';
import supportImage from '@/assets/ecomm-support.jpg';
import ctaImage from '@/assets/ecomm-cta.jpg';

export const EcommPage = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/auth');
  };

  const handleTalkToUs = () => {
    navigate('/contact');
  };

  const howItWorksSteps = [
    { icon: ShoppingCart, title: 'Customer shops on your website', description: 'Your brand, your products, your prices' },
    { icon: CreditCard, title: 'Secure checkout powered by Stripe', description: 'PCI-compliant payment processing' },
    { icon: Calculator, title: 'Sales tax calculated automatically', description: 'No manual tax table management' },
    { icon: Truck, title: 'Order routed to an approved nursery partner', description: 'Seamless fulfillment coordination' },
    { icon: Package, title: 'Nursery ships directly to the customer', description: 'Quality plants delivered on time' },
    { icon: Users, title: 'Customer details saved for follow-up', description: 'Build lasting relationships' },
  ];

  const faqItems = [
    {
      question: 'Do I own my customers?',
      answer: 'Yes. Customers buy from your garden center, not BloomSuite. Your brand is on every receipt, every email, and every interaction.',
    },
    {
      question: 'Do I have to manage inventory?',
      answer: 'No. Approved nursery partners fulfill orders on your behalf. You never have to track stock levels or coordinate with vendors.',
    },
    {
      question: 'Who sets pricing?',
      answer: 'You do. Nurseries set wholesale pricing. You choose your markup and shipping costs. Your margins are yours to control.',
    },
    {
      question: 'How much does BloomSuite cost?',
      answer: 'BloomSuite charges a 5% platform fee on the product subtotal only. Combined with standard payment processing fees, most orders have a total transaction cost under 10%.',
    },
    {
      question: 'Who handles sales tax?',
      answer: 'BloomSuite calculates tax automatically at checkout using industry-standard tax services. You remain responsible for filing and remitting taxes to the appropriate authorities.',
    },
    {
      question: 'Is support included?',
      answer: 'Yes. Human technical support is included with the platform at no additional cost. No per-ticket fees.',
    },
    {
      question: 'Is this better than selling on Amazon or Etsy?',
      answer: 'Yes. You keep your brand, your pricing, and your customers. There is no marketplace competition, no race to the bottom on pricing, and no customer data shared with competitors.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <LandingPageHeader onLogin={handleGetStarted} />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/40" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Sell Online Without Giving Away Your Margin, Your Brand, or Your Customers
            </h1>
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              BloomSuite E-Commerce lets garden centers sell online using ship-on-demand nursery 
              partners — while staying the seller of record and keeping full control of pricing 
              and customer relationships.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" onClick={handleGetStarted} className="text-lg px-8">
                Get Started with BloomSuite
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={handleTalkToUs} className="text-lg px-8">
                Talk to Us About E-Commerce
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Built Specifically for Garden Centers */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Built Specifically for Garden Centers
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                BloomSuite is not a marketplace. It is not a DIY tool. It is purpose-built 
                infrastructure designed for how garden centers actually operate.
              </p>
              <ul className="space-y-4">
                {[
                  'Designed for how garden centers actually operate',
                  'No inventory management required',
                  'No stitching together plugins or apps',
                  'No competing marketplaces',
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <img 
                src={builtForGcImage} 
                alt="Garden center owner reviewing orders" 
                className="rounded-2xl shadow-xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* You Stay the Seller of Record */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <img 
                src={sellerOfRecordImage} 
                alt="Garden center as seller of record" 
                className="rounded-2xl shadow-xl w-full"
              />
            </div>
            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-4">
                <Store className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-primary uppercase tracking-wide">Your Business, Your Brand</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                You Stay the Seller of Record
              </h2>
              <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                Every transaction happens under your garden center name. Your logo. Your receipt. 
                Your customer relationship.
              </p>
              <ul className="space-y-4">
                {[
                  'Customers buy from your garden center',
                  'Your garden center name is on every receipt',
                  'You control pricing, refunds, and service',
                  'BloomSuite is infrastructure, not a reseller',
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A simple, streamlined process that handles the complexity so you can focus on your business.
            </p>
          </div>

          {/* Visual Flow Diagram */}
          <div className="mb-16">
            <img 
              src={howItWorksImage} 
              alt="Order fulfillment flow diagram" 
              className="w-full max-w-4xl mx-auto rounded-2xl shadow-lg"
            />
          </div>

          {/* Step Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {howItWorksSteps.map((step, index) => (
              <Card key={index} className="bg-background border-border/50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold">{index + 1}</span>
                    </div>
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Emphasis Points */}
          <div className="mt-12 flex flex-wrap justify-center gap-8 text-center">
            {['No inventory', 'No vendor coordination', 'No tax table management'].map((point, index) => (
              <div key={index} className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partnered with the Best Nurseries */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Partnered with the Best Nurseries in North America
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                BloomSuite partners with top nursery vendors across North America. 
                Every partner is vetted for quality and reliability.
              </p>
              <ul className="space-y-4">
                {[
                  'Premium nurseries vetted for quality and reliability',
                  'One wholesale price per product',
                  'Garden centers choose their own markup',
                  'Consistent quality across all orders',
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <img 
                src={nurseryMapImage} 
                alt="North America nursery partner network" 
                className="rounded-2xl shadow-xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Simple, Flexible Pricing */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <img 
                src={pricingImage} 
                alt="Pricing structure visualization" 
                className="rounded-2xl shadow-xl w-full"
              />
            </div>
            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-4">
                <DollarSign className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-primary uppercase tracking-wide">Transparent Pricing</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Simple, Flexible Pricing
              </h2>
              <div className="space-y-6 text-muted-foreground">
                <p className="leading-relaxed">
                  Nurseries set one wholesale price per product. You set your own retail price, 
                  add shipping as needed, and control your margins fully.
                </p>
                <div className="bg-background p-6 rounded-xl border border-border">
                  <h3 className="text-foreground font-semibold mb-3">Platform Fee Structure</h3>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>5% platform fee on product subtotal only</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Standard payment processing fees apply</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>Most orders under 10% total transaction cost</span>
                    </li>
                  </ul>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    No marketplace referral fees
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    No forced pricing
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    No customer ownership loss
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built-In Follow-Up After Purchase */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Mail className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-primary uppercase tracking-wide">Customer Retention</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Built-In Follow-Up After Purchase
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Unlike marketplaces that hide your customers, BloomSuite makes sure every 
                customer becomes a long-term relationship.
              </p>
              <ul className="space-y-4">
                {[
                  'Customer details are automatically captured',
                  'Follow-up emails after every purchase',
                  'Seasonal reminders and care tips',
                  'Promotions and educational content',
                  'Your garden center keeps the customer forever',
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <img 
                src={followupImage} 
                alt="Automated follow-up email" 
                className="rounded-2xl shadow-xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Human Technical Support */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <img 
                src={supportImage} 
                alt="BloomSuite support team" 
                className="rounded-2xl shadow-xl w-full"
              />
            </div>
            <div className="order-1 lg:order-2">
              <div className="flex items-center gap-3 mb-4">
                <Headphones className="h-8 w-8 text-primary" />
                <span className="text-sm font-medium text-primary uppercase tracking-wide">Real Support</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
                Human Technical Support Included
              </h2>
              <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                Real people who understand garden centers. Not chatbots. Not ticket queues. 
                Actual support from a team that knows your business.
              </p>
              <ul className="space-y-4">
                {[
                  'Real people with garden-center-specific knowledge',
                  'Help with onboarding, orders, and troubleshooting',
                  'No per-ticket fees',
                  'Included with the platform',
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-muted-foreground">
              Common questions about BloomSuite E-Commerce
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            {faqItems.map((item, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="bg-muted/30 rounded-lg px-6 border-none"
              >
                <AccordionTrigger className="text-left text-foreground hover:no-underline py-6">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="relative py-24 px-6 overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${ctaImage})` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/70" />
        </div>
        
        <div className="relative max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            Sell online without losing control.
          </h2>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
            BloomSuite makes e-commerce work for garden centers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={handleGetStarted} className="text-lg px-8">
              Get Started with BloomSuite
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={handleTalkToUs} className="text-lg px-8">
              Talk to Us About E-Commerce
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Brands in Blooms Inc. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default EcommPage;
