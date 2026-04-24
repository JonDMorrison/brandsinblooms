import Box from "@mui/joy/Box";
import Typography from "@mui/joy/Typography";
import { createCalendarPillSx } from "@/components/calendar/calendarEventPresentation";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface CalendarCampaignListProps {
  campaigns: Campaign[];
  selectionMode?: boolean;
  selectedCampaigns?: Campaign[];
  onCampaignClick?: (campaign: Campaign) => void;
}

export const CalendarCampaignList = ({
  campaigns,
  onCampaignClick,
  selectionMode = false,
  selectedCampaigns = [],
  highlightedId,
}: CalendarCampaignListProps) => {
  const sortedCampaigns = [...campaigns].sort((a, b) => b.id - a.id);

  const handleCampaignClick = (campaign: Campaign, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCampaignClick) {
      onCampaignClick(campaign);
    }
  };

  return (
    <>
      {sortedCampaigns.slice(0, 1).map((campaign) => {
        const isSelected = selectedCampaigns.some(
          (selected) => selected.id === campaign.id,
        );
        const isHighlighted = highlightedId === String(campaign.id);

        return (
          <Box
            component="button"
            key={campaign.id}
            type="button"
            sx={{
              ...createCalendarPillSx("event", isHighlighted || isSelected),
              appearance: "none",
              px: 1,
              py: 0.75,
            }}
            onClick={(e) => handleCampaignClick(campaign, e)}
          >
            <Box sx={{ pl: 0.75, minWidth: 0 }}>
              <Typography
                level="body-xs"
                fontWeight="lg"
                sx={{
                  color: "success.700",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {campaign.title}
              </Typography>
              {campaign.theme && campaign.theme !== campaign.title && (
                <Typography
                  level="body-xs"
                  sx={{
                    color: "success.800",
                    opacity: 0.72,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {campaign.theme}
                </Typography>
              )}
            </Box>
          </Box>
        );
      })}
    </>
  );
};

interface CalendarCampaignListProps {
  campaigns: Campaign[];
  selectionMode?: boolean;
  selectedCampaigns?: Campaign[];
  onCampaignClick?: (campaign: Campaign) => void;
  highlightedId?: string | null;
}
