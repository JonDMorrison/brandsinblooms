import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Mail, MessageSquare, Layout, Sparkles } from "lucide-react";

export const TemplatesPage = () => {
  const templateCategories = [
    {
      id: 'newsletter',
      title: 'Newsletter Templates',
      description: 'Professional email newsletter designs',
      icon: <Mail className="w-6 h-6 text-blue-600" />,
      count: 12,
      comingSoon: false,
    },
    {
      id: 'social',
      title: 'Social Media Templates',
      description: 'Eye-catching social media post designs',
      icon: <MessageSquare className="w-6 h-6 text-purple-600" />,
      count: 8,
      comingSoon: true,
    },
    {
      id: 'website',
      title: 'Website Templates',
      description: 'Modern website layouts and pages',
      icon: <Layout className="w-6 h-6 text-teal-600" />,
      count: 5,
      comingSoon: true,
    },
    {
      id: 'campaign',
      title: 'Campaign Templates',
      description: 'Multi-channel campaign templates',
      icon: <Sparkles className="w-6 h-6 text-orange-600" />,
      count: 15,
      comingSoon: false,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="w-8 h-8 text-gray-700" />
            <h1 className="text-4xl font-bold text-gray-900">Templates</h1>
          </div>
          <p className="text-xl text-gray-600 mb-6">
            Professional templates to jumpstart your marketing campaigns
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {templateCategories.map((category) => (
            <Card 
              key={category.id}
              className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  {category.icon}
                  <div>
                    <CardTitle className="text-lg">{category.title}</CardTitle>
                    {category.comingSoon && (
                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
                <CardDescription>
                  {category.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-600">
                    {category.count} templates
                  </span>
                </div>
                <Button 
                  className="w-full" 
                  disabled={category.comingSoon}
                  variant={category.comingSoon ? "outline" : "default"}
                >
                  {category.comingSoon ? 'Coming Soon' : 'Browse Templates'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="text-center">
            <Sparkles className="w-12 h-12 text-purple-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              AI-Powered Template Generation
            </h2>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Can't find the perfect template? Our AI can generate custom templates 
              tailored to your brand and campaign needs. Just describe what you're 
              looking for, and we'll create it for you.
            </p>
            <Button className="bg-purple-600 hover:bg-purple-700 text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Custom Template
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};