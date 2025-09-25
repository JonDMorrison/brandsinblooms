import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LandingPageHeader } from "@/components/landing/LandingPageHeader";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, MessageCircle, CheckCircle } from "lucide-react";

const contactFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  email: z.string().email("Please enter a valid email address").max(255, "Email must be less than 255 characters"),
  inquiryTypes: z.array(z.string()).min(1, "Please select at least one inquiry type"),
  message: z.string().min(10, "Message must be at least 10 characters").max(1000, "Message must be less than 1000 characters")
});

type ContactFormData = z.infer<typeof contactFormSchema>;

const ContactPage = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      inquiryTypes: [],
      message: ""
    }
  });

  const inquiryOptions = [
    { id: "support", label: "Support & Technical Help" },
    { id: "signup", label: "Signing Up & Getting Started" },
    { id: "general", label: "General Inquiry" },
    { id: "other", label: "Other" }
  ];

  const watchedInquiryTypes = watch("inquiryTypes") || [];

  const handleInquiryTypeChange = (inquiryId: string, checked: boolean) => {
    if (checked) {
      setValue("inquiryTypes", [...watchedInquiryTypes, inquiryId]);
    } else {
      setValue("inquiryTypes", watchedInquiryTypes.filter(id => id !== inquiryId));
    }
  };

  const onSubmit = async (data: ContactFormData) => {
    try {
      setIsSubmitting(true);
      
      const { error } = await supabase.functions.invoke('send-contact-form', {
        body: data
      });

      if (error) {
        throw error;
      }

      setIsSubmitted(true);
      reset();
      toast.success("Thank you! Your message has been sent successfully.");
    } catch (error) {
      console.error('Error sending contact form:', error);
      toast.error("Sorry, there was an error sending your message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/30">
        <LandingPageHeader onLogin={() => navigate('/auth')} />
        
        <section className="py-16 px-6">
          <div className="max-w-2xl mx-auto">
            <Card className="p-8 bg-card/95 backdrop-blur-sm border-2 border-primary/20 shadow-xl">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-accent mb-4">Message Sent!</h1>
                <p className="text-lg text-muted-foreground mb-8">
                  Thank you for reaching out. We'll get back to you within 24 hours.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button onClick={() => setIsSubmitted(false)} variant="outline">
                    Send Another Message
                  </Button>
                  <Button onClick={() => navigate('/faq')}>
                    Back to FAQ
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-muted/30">
      <LandingPageHeader onLogin={() => navigate('/auth')} />
      
      {/* Hero Section */}
      <section className="py-16 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-accent mb-6">
            Contact Us
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Have questions about BloomSuite? We'd love to help.
          </p>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-16 px-6">
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 bg-card/95 backdrop-blur-sm border-2 border-primary/20 shadow-xl">
            <CardHeader className="text-center pb-8">
              <CardTitle className="text-2xl text-accent mb-2">Get in Touch</CardTitle>
              <p className="text-muted-foreground">
                Fill out the form below and we'll get back to you as soon as possible.
              </p>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input 
                      id="name"
                      placeholder="Your full name" 
                      {...register("name")}
                      className={errors.name ? "border-red-500" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500">{errors.name.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input 
                      id="email"
                      type="email"
                      placeholder="your.email@example.com" 
                      {...register("email")}
                      className={errors.email ? "border-red-500" : ""}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500">{errors.email.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <Label>What can we help you with? *</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inquiryOptions.map((option) => (
                      <div key={option.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={option.id}
                          checked={watchedInquiryTypes.includes(option.id)}
                          onCheckedChange={(checked) => 
                            handleInquiryTypeChange(option.id, !!checked)
                          }
                        />
                        <Label 
                          htmlFor={option.id} 
                          className="text-sm font-normal cursor-pointer"
                        >
                          {option.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {errors.inquiryTypes && (
                    <p className="text-sm text-red-500">{errors.inquiryTypes.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us about your question or how we can help..."
                    className={`min-h-[120px] ${errors.message ? "border-red-500" : ""}`}
                    {...register("message")}
                  />
                  {errors.message && (
                    <p className="text-sm text-red-500">{errors.message.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-primary to-brand-teal-mint hover:from-primary/90 hover:to-brand-teal-mint/90 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-8 pt-8 border-t border-border/50">
                <div className="text-center text-sm text-muted-foreground">
                  <p className="mb-2">Need immediate assistance?</p>
                  <div className="flex items-center justify-center gap-4">
                    <a 
                      href="mailto:jeff@brandsinblooms.com" 
                      className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      jeff@brandsinblooms.com
                    </a>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default ContactPage;