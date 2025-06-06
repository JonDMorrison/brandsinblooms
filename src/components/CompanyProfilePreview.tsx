
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, Sparkles, Target, Heart, Calendar, Award, MapPin } from "lucide-react";

interface CompanyProfilePreviewProps {
  profile: any;
  onboardingData?: any;
}

export const CompanyProfilePreview = ({ profile, onboardingData }: CompanyProfilePreviewProps) => {
  // If no profile exists but we have onboarding data, show that instead
  const displayData = profile || onboardingData;
  
  if (!displayData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Eye className="w-5 h-5" />
            AI Content Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-500">
            <Sparkles className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No profile data yet</h3>
            <p className="text-sm">
              Fill out your company profile to see how AI will interpret your brand for content creation.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Eye className="w-5 h-5" />
          {profile ? 'AI Content Preview' : 'Onboarding Data Preview'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {profile 
            ? 'How AI will understand and use your company information'
            : 'Your onboarding responses - use Auto-Populate to generate a complete profile'
          }
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Show onboarding data if no profile exists */}
        {!profile && onboardingData && (
          <>
            {onboardingData.aboutBusiness && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  About Your Business
                </h4>
                <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                  {onboardingData.aboutBusiness}
                </p>
              </div>
            )}

            {onboardingData.toneSamples && (
              <div>
                <h4 className="font-medium mb-2">Brand Voice Samples</h4>
                <p className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg">
                  {onboardingData.toneSamples}
                </p>
              </div>
            )}

            {onboardingData.annualEvents && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Annual Events
                </h4>
                <p className="text-sm text-gray-600 bg-orange-50 p-3 rounded-lg">
                  {onboardingData.annualEvents}
                </p>
              </div>
            )}

            <div className="border-t pt-4 mt-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Next Step
                </h4>
                <p className="text-sm text-blue-800">
                  Click "Auto-Populate with AI" to generate a comprehensive company profile 
                  based on your onboarding responses. You can then review and edit the generated content.
                </p>
              </div>
            </div>
          </>
        )}

        {/* Show profile data if it exists */}
        {profile && (
          <>
            {profile.company_name && (
              <div>
                <h3 className="font-semibold text-lg text-garden-green-dark mb-2">
                  {profile.company_name}
                </h3>
                <Badge variant="outline" className="mb-3">
                  Primary Brand Identity
                </Badge>
              </div>
            )}

            {profile.company_overview && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Brand Story
                </h4>
                <p className="text-sm text-gray-600 bg-green-50 p-3 rounded-lg">
                  {profile.company_overview}
                </p>
              </div>
            )}

            {profile.brand_voice && (
              <div>
                <h4 className="font-medium mb-2">Content Voice</h4>
                <p className="text-sm text-gray-600 italic">
                  "{profile.brand_voice}"
                </p>
              </div>
            )}

            {profile.target_audience && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Target Audience
                </h4>
                <p className="text-sm text-gray-600">
                  {profile.target_audience}
                </p>
              </div>
            )}

            {profile.unique_selling_points && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Key Differentiators
                </h4>
                <p className="text-sm text-gray-600">
                  {profile.unique_selling_points}
                </p>
              </div>
            )}

            {profile.company_values && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  Core Values
                </h4>
                <p className="text-sm text-gray-600">
                  {profile.company_values}
                </p>
              </div>
            )}

            {profile.seasonal_focus && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Seasonal Strategy
                </h4>
                <p className="text-sm text-gray-600">
                  {profile.seasonal_focus}
                </p>
              </div>
            )}

            {profile.specializations && (
              <div>
                <h4 className="font-medium mb-2">Areas of Expertise</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.specializations.split(',').map((spec: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {spec.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.location_info && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location Context
                </h4>
                <p className="text-sm text-gray-600">
                  {profile.location_info}
                </p>
              </div>
            )}

            <div className="border-t pt-4 mt-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Content Impact
                </h4>
                <p className="text-sm text-blue-800">
                  This information will be used to generate content that matches your brand voice, 
                  targets your ideal customers, and reflects your unique value proposition. 
                  All future marketing content will be personalized based on this profile.
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
