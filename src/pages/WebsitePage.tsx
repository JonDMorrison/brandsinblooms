import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, Construction, Sparkles } from "lucide-react";

export const WebsitePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-gray-50/30 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Globe className="w-8 h-8 text-teal-600" />
            <h1 className="text-4xl font-bold text-gray-900">Website Builder</h1>
          </div>
          <p className="text-xl text-gray-600 mb-6">
            Build stunning, professional websites with AI assistance
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          <Card className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Construction className="w-6 h-6 text-amber-600" />
                <CardTitle>Coming Soon</CardTitle>
              </div>
              <CardDescription>
                Our AI-powered website builder is in development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">
                We're working hard to bring you an amazing website building experience. 
                Soon you'll be able to create beautiful, professional websites in minutes 
                using our AI assistant.
              </p>
              <Button className="w-full" disabled>
                <Sparkles className="w-4 h-4 mr-2" />
                Join the Waitlist
              </Button>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden bg-white border border-gray-200 rounded-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-purple-600" />
                <CardTitle>What to Expect</CardTitle>
              </div>
              <CardDescription>
                Features coming to the website builder
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>AI-powered design generation</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Mobile-responsive templates</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>SEO optimization built-in</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Content integration with your campaigns</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-teal-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>Custom domain support</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-gray-500">
            Want to be notified when the website builder launches?{' '}
            <a href="mailto:support@bloomsuite.com" className="text-teal-600 hover:underline">
              Contact us
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};