
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Target, Calendar, CheckCircle, TrendingUp, HelpCircle } from "lucide-react";

export const ContentStrategyExplainer = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  const steps = [
    {
      icon: Target,
      title: "Choose Your Theme",
      description: "Select a weekly theme that aligns with seasonal gardening or business goals",
      example: "Spring Planting, Holiday Decorations, Plant Care Basics"
    },
    {
      icon: Calendar,
      title: "Content Generation", 
      description: "AI creates 5 professional content pieces optimized for different platforms",
      example: "Instagram post, Facebook post, Blog article, Newsletter, Video script"
    },
    {
      icon: CheckCircle,
      title: "Review & Approve",
      description: "Review all generated content and approve pieces you want to use",
      example: "Edit, customize, or approve content that fits your brand voice"
    },
    {
      icon: TrendingUp,
      title: "Publish & Engage",
      description: "Share approved content across platforms to engage your audience",
      example: "Post to social media, send newsletters, publish blog posts"
    }
  ];

  const benefits = [
    "Consistent weekly content that builds audience engagement",
    "SEO-optimized blog content that drives organic traffic", 
    "Social media posts that encourage community interaction",
    "Newsletter content that nurtures customer relationships",
    "Video scripts for visual plant care demonstrations"
  ];

  return (
    <Card className="border-green-200 bg-gradient-to-br from-green-50 to-emerald-50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-green-600" />
            <CardTitle className="text-lg text-green-900">Content Marketing Strategy</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-green-700 hover:bg-green-100"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {isExpanded ? 'Hide Details' : 'Learn More'}
          </Button>
        </div>
        <p className="text-sm text-green-700">
          Professional weekly content system designed for garden centers and plant businesses
        </p>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-6">
          {/* How It Works */}
          <div>
            <h4 className="font-semibold text-green-900 mb-3">How It Works:</h4>
            <div className="space-y-3">
              {steps.map((step, index) => {
                const IconComponent = step.icon;
                return (
                  <div key={index} className="flex gap-3 p-3 bg-white rounded-lg border border-green-200">
                    <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full flex-shrink-0">
                      <IconComponent className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">{step.title}</span>
                        <Badge variant="outline" className="text-xs">
                          Step {index + 1}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">{step.description}</p>
                      <p className="text-xs text-green-600 italic">Example: {step.example}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Benefits */}
          <div>
            <h4 className="font-semibold text-green-900 mb-3">Marketing Benefits:</h4>
            <div className="grid gap-2">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-green-800">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Success Metrics */}
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <h4 className="font-semibold text-green-900 mb-2">Expected Results:</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-900">Social Media:</span>
                <p className="text-gray-600">Increased engagement and follower growth</p>
              </div>
              <div>
                <span className="font-medium text-gray-900">Website Traffic:</span>
                <p className="text-gray-600">More organic visitors from blog content</p>
              </div>
              <div>
                <span className="font-medium text-gray-900">Customer Loyalty:</span>
                <p className="text-gray-600">Regular newsletter builds relationships</p>
              </div>
              <div>
                <span className="font-medium text-gray-900">Brand Authority:</span>
                <p className="text-gray-600">Educational content establishes expertise</p>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};
