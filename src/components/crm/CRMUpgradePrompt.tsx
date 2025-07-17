import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Lock, Mail, MessageSquare, Users, Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CRMUpgradePromptProps {
  variant?: 'button' | 'modal' | 'card';
  size?: 'sm' | 'lg' | 'default';
  className?: string;
}

export const CRMUpgradePrompt = ({ 
  variant = 'button', 
  size = 'default', 
  className = '' 
}: CRMUpgradePromptProps) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    navigate('/pricing');
  };

  if (variant === 'button') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="outline" 
              size={size} 
              disabled 
              className={`flex items-center gap-2 ${className}`}
            >
              <Lock className="w-4 h-4" />
              Upgrade to Use CRM
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p>Upgrade to Sprout or Bloom plan to unlock CRM-powered email & SMS campaigns</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-xl">CRM Access Required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-center">
              Unlock powerful email & SMS campaign tools with a Sprout or Bloom plan upgrade.
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-blue-500" />
                <span>Email Campaign Builder</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MessageSquare className="w-4 h-4 text-green-500" />
                <span>SMS Marketing</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Users className="w-4 h-4 text-purple-500" />
                <span>Customer Segmentation</span>
              </div>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => window.history.back()} className="flex-1">
                Go Back
              </Button>
              <Button onClick={handleUpgrade} className="flex-1">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade Plan
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card className={`border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-orange-800">CRM Features Locked</CardTitle>
              <p className="text-sm text-orange-600">Upgrade to unlock email & SMS campaigns</p>
            </div>
          </div>
          <Badge variant="outline" className="border-orange-300 text-orange-700">
            Pro Feature
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="flex items-center gap-2 text-sm text-orange-700">
            <Mail className="w-4 h-4" />
            <span>Email Campaigns</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-orange-700">
            <MessageSquare className="w-4 h-4" />
            <span>SMS Marketing</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-orange-700">
            <Users className="w-4 h-4" />
            <span>Customer Segments</span>
          </div>
        </div>
        
        <Button onClick={handleUpgrade} className="w-full bg-orange-600 hover:bg-orange-700">
          Upgrade to Sprout Plan
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
};