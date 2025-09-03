
import React from 'react';
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';

export const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Welcome to BloomBoost
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Your AI-powered content marketing assistant for garden centers. 
          Create engaging social media content, manage campaigns, and grow your business.
        </p>
        <div className="space-x-4">
          <Button 
            onClick={() => navigate('/auth')}
            className="bg-primary hover:bg-primary-700 text-primary-foreground px-8 py-3 text-lg"
          >
            Get Started
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/pricing')}
            className="border-primary text-primary hover:bg-primary-50 px-8 py-3 text-lg"
          >
            View Pricing
          </Button>
        </div>
      </div>
    </div>
  );
};
