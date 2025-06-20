
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, User, ArrowRight } from "lucide-react";
import { HeadlineMedium, BodyMedium } from "@/components/ui/typography";

interface CompanyProfileSetupProps {
  onComplete: () => void;
}

export const CompanyProfileSetup = ({ onComplete }: CompanyProfileSetupProps) => {
  const navigate = useNavigate();

  const handleSetupProfile = () => {
    navigate('/onboarding');
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
          <Building2 className="w-8 h-8 text-green-600" />
        </div>
        <CardTitle>
          <HeadlineMedium>Complete Your Profile</HeadlineMedium>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <BodyMedium className="text-center text-gray-600">
          To generate personalized content for your business, we need to know a bit more about your company.
        </BodyMedium>
        
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <User className="w-5 h-5 text-gray-500" />
            <div>
              <div className="font-medium text-sm">Business Information</div>
              <div className="text-xs text-gray-500">Company name, overview, and specializations</div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <Building2 className="w-5 h-5 text-gray-500" />
            <div>
              <div className="font-medium text-sm">Brand Voice</div>
              <div className="text-xs text-gray-500">Tone of voice and target audience</div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button 
            variant="outline" 
            onClick={onComplete}
            className="flex-1"
          >
            Skip for Now
          </Button>
          <Button 
            onClick={handleSetupProfile}
            className="flex-1"
          >
            Set Up Profile
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
