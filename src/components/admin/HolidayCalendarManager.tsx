import * as React from "react";
import { useState } from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { EnhancedAppleCard } from "@/components/ui-legacy/enhanced-apple-card";
import { AppleCardContent, AppleCardHeader } from "@/components/ui-legacy/apple-card";
import { PremiumButton } from "@/components/ui-legacy/premium-button";
import { JoyInput } from "@/components/joy/JoyInput";
import { useHolidayCalendarUpdate } from "@/hooks/useHolidayCalendarUpdate";
import { Calendar, Clock, RefreshCw } from "lucide-react";

export const HolidayCalendarManager = () => {
  const { updateHolidayCalendar, loading, lastUpdate } =
    useHolidayCalendarUpdate();
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
        <Stack direction="row" spacing={1.5} alignItems="center">
          <div className="apple-icon-container">
            <Calendar className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <Typography component="h2" level="h3" sx={{ color: "neutral.800" }}>
              Holiday Calendar Manager
            </Typography>
            <Typography level="body-sm" color="neutral">
              Generate holidays for upcoming years
            </Typography>
          </div>
        </Stack>
      </AppleCardHeader>

      <AppleCardContent className="apple-card-spacing space-y-6">
        <div className="space-y-4">
          <Stack direction="row" spacing={2} alignItems="flex-end">
            <JoyInput
              label="Target Year"
              sx={{ width: 180 }}
              type="number"
              value={String(targetYear)}
              onChange={(e) => {
                const nextYear = Number.parseInt(e.target.value, 10);
                setTargetYear(
                  Number.isNaN(nextYear) ? new Date().getFullYear() : nextYear,
                );
              }}
              min={new Date().getFullYear()}
              max={new Date().getFullYear() + 5}
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
              {loading ? "Updating..." : "Update Calendar"}
            </PremiumButton>
          </Stack>

          <Sheet
            color="primary"
            variant="soft"
            sx={{ p: 2, borderRadius: "var(--joy-radius-lg)" }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <Typography level="body-sm" fontWeight="lg" color="primary">
                  Automatic Updates
                </Typography>
                <Typography level="body-sm" color="primary">
                  The holiday calendar automatically updates every December 1st
                  to generate holidays for the next year. Use this manual
                  trigger for testing or generating holidays for specific years.
                </Typography>
              </div>
            </Stack>
          </Sheet>

          {lastUpdate && (
            <Sheet
              color={lastUpdate.success ? "success" : "neutral"}
              variant="soft"
              sx={{ p: 2, borderRadius: "var(--joy-radius-lg)" }}
            >
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Clock
                  className={`w-5 h-5 mt-0.5 ${lastUpdate.success ? "text-green-600" : "text-gray-600"}`}
                />
                <div>
                  <Typography
                    level="body-sm"
                    fontWeight="lg"
                    color={lastUpdate.success ? "success" : "neutral"}
                  >
                    Last Update Result
                  </Typography>
                  <Typography
                    level="body-md"
                    color={lastUpdate.success ? "success" : "neutral"}
                  >
                    {lastUpdate.message}
                  </Typography>
                  {lastUpdate.holidays_generated > 0 && (
                    <Typography
                      level="body-sm"
                      color={lastUpdate.success ? "success" : "neutral"}
                    >
                      Generated {lastUpdate.holidays_generated} holidays for{" "}
                      {lastUpdate.year}
                      {lastUpdate.holidays_deactivated > 0 &&
                        `, deactivated ${lastUpdate.holidays_deactivated} old holidays`}
                    </Typography>
                  )}
                  {lastUpdate.errors && lastUpdate.errors.length > 0 && (
                    <div className="mt-2">
                      <Typography
                        level="body-sm"
                        fontWeight="lg"
                        color="danger"
                      >
                        Errors:
                      </Typography>
                      {lastUpdate.errors.map((error, index) => (
                        <Typography key={index} level="body-sm" color="danger">
                          • {error}
                        </Typography>
                      ))}
                    </div>
                  )}
                </div>
              </Stack>
            </Sheet>
          )}
        </div>
      </AppleCardContent>
    </EnhancedAppleCard>
  );
};
