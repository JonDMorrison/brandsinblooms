
import * as React from "react";
import { useState } from "react";
import { EnhancedAppleCard } from "@/components/ui/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui/apple-card";
import { HeadlineLarge, BodyMedium, CaptionMedium } from "@/components/ui/typography";
import { PremiumButton } from "@/components/ui/premium-button";
import { useHolidayCalendarUpdate } from "@/hooks/useHolidayCalendarUpdate";
import { Calendar, Clock, RefreshCw } from "lucide-react";

export const HolidayCalendarManager = () => {
  const { updateHolidayCalendar, loading, lastUpdate } = useHolidayCalendarUpdate();
  const [targetYear, setTargetYear] = useState(new Date().getFullYear() + 1);

  const handleUpdateCalendar = async () => {
    await updateHolidayCalendar(targetYear);
  };

  return (
    <EnhancedAppleCard 
      variant="elevated" 
      surface="primary"
      hoverEffect="subtle"
      animated={true}
    >
      <AppleCardHeader className="apple-card-spacing">
        <div className="flex items-center gap-3">
          <div className="apple-icon-container">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <HeadlineLarge className="apple-headline-medium text-gray-800">
              Holiday Calendar Manager
            </HeadlineLarge>
            <CaptionMedium className="apple-caption-enhanced text-gray-600">
              Generate holidays for upcoming years
            </CaptionMedium>
          </div>
        </div>
      </AppleCardHeader>

      <AppleCardContent className="apple-card-spacing space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Year
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(parseInt(e.target.value))}
                min={new Date().getFullYear()}
                max={new Date().getFullYear() + 5}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
              <PremiumButton
                variant="primary"
                size="sm"
                leadingIcon="calendar"
                premium={false}
                disabled={loading}
                onClick={handleUpdateCalendar}
                className="apple-button-premium"
              >
                {loading ? 'Updating...' : 'Update Calendar'}
              </PremiumButton>
            </div>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <CaptionMedium className="font-medium text-blue-800 mb-1">
                  Automatic Updates
                </CaptionMedium>
                <CaptionMedium className="text-blue-700">
                  The holiday calendar automatically updates every December 1st to generate holidays for the next year. 
                  Use this manual trigger for testing or generating holidays for specific years.
                </CaptionMedium>
              </div>
            </div>
          </div>

          {lastUpdate && (
            <div className={`rounded-lg p-4 border ${lastUpdate.success ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-start gap-3">
                <Clock className={`w-5 h-5 mt-0.5 ${lastUpdate.success ? 'text-green-600' : 'text-yellow-600'}`} />
                <div>
                  <CaptionMedium className={`font-medium mb-1 ${lastUpdate.success ? 'text-green-800' : 'text-yellow-800'}`}>
                    Last Update Result
                  </CaptionMedium>
                  <BodyMedium className={lastUpdate.success ? 'text-green-700' : 'text-yellow-700'}>
                    {lastUpdate.message}
                  </BodyMedium>
                  {lastUpdate.holidays_generated > 0 && (
                    <CaptionMedium className={lastUpdate.success ? 'text-green-600' : 'text-yellow-600'}>
                      Generated {lastUpdate.holidays_generated} holidays for {lastUpdate.year}
                      {lastUpdate.holidays_deactivated > 0 && `, deactivated ${lastUpdate.holidays_deactivated} old holidays`}
                    </CaptionMedium>
                  )}
                  {lastUpdate.errors && lastUpdate.errors.length > 0 && (
                    <div className="mt-2">
                      <CaptionMedium className="text-red-600 font-medium">Errors:</CaptionMedium>
                      {lastUpdate.errors.map((error, index) => (
                        <CaptionMedium key={index} className="text-red-600">
                          • {error}
                        </CaptionMedium>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
