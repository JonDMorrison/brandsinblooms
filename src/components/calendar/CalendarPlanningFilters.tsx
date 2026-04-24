import React from "react";
import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Search } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoySwitch } from "@/components/joy/JoySwitch";
import type { CalendarFilters } from "@/hooks/useUnifiedCalendarData";

interface CalendarPlanningFiltersProps {
  filters: CalendarFilters;
  onFiltersChange: (filters: Partial<CalendarFilters>) => void;
  filterOptions: {
    types: string[];
    platforms: string[];
    statuses: string[];
  };
  onReset?: () => void;
  compact?: boolean;
}

export const CalendarPlanningFilters = ({
  filters,
  onFiltersChange,
  filterOptions,
  onReset,
  compact = false,
}: CalendarPlanningFiltersProps) => {
  const typeLabels: Record<string, string> = {
    task: "Content Tasks",
    scheduled_post: "Scheduled Posts",
    newsletter: "Newsletters",
    event: "Events",
    holiday: "Holidays",
  };

  const platformLabels: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    blog: "Blog",
    video: "Video",
    newsletter: "Email",
  };

  const statusLabels: Record<string, string> = {
    planned: "Planned",
    review: "In Review",
    approved: "Approved",
    scheduled: "Scheduled",
    completed: "Completed",
    QUEUED: "Queued",
    PUBLISHED: "Published",
    draft: "Draft",
    sent: "Sent",
  };

  const handleTypeToggle = (type: string) => {
    const nextTypes = filters.types.includes(type)
      ? filters.types.filter((value) => value !== type)
      : [...filters.types, type];

    onFiltersChange({ types: nextTypes });
  };

  const handlePlatformToggle = (platform: string) => {
    const nextPlatforms = filters.platforms.includes(platform)
      ? filters.platforms.filter((value) => value !== platform)
      : [...filters.platforms, platform];

    onFiltersChange({ platforms: nextPlatforms });
  };

  const sectionSpacing = compact ? 1.25 : 1.5;

  return (
    <Box sx={{ p: compact ? 1.25 : 1.5, width: "100%" }}>
      <Stack spacing={sectionSpacing}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography level="title-sm">Filters</Typography>
          {onReset ? (
            <JoyButton bloomVariant="ghost" color="neutral" onClick={onReset}>
              Reset
            </JoyButton>
          ) : null}
        </Stack>

        <Stack spacing={1}>
          <Typography
            level="body-xs"
            textTransform="uppercase"
            fontWeight="lg"
            color="neutral"
          >
            Search
          </Typography>
          <Input
            size="sm"
            startDecorator={<Search size={14} />}
            value={filters.searchQuery}
            placeholder="Search campaigns, holidays, and content"
            onChange={(event) =>
              onFiltersChange({ searchQuery: event.target.value })
            }
          />
        </Stack>

        <Stack spacing={1}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography
              level="body-xs"
              textTransform="uppercase"
              fontWeight="lg"
              color="neutral"
            >
              Published Content
            </Typography>
            <JoySwitch
              checked={filters.showPublished}
              onCheckedChange={(checked) =>
                onFiltersChange({ showPublished: checked })
              }
            />
          </Stack>
          <Typography level="body-xs" color="neutral">
            Include sent and published items in the calendar surface.
          </Typography>
        </Stack>

        <Divider />

        <Stack spacing={1}>
          <Typography
            level="body-xs"
            textTransform="uppercase"
            fontWeight="lg"
            color="neutral"
          >
            Event Types
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {filterOptions.types.map((type) => {
              const active = filters.types.includes(type);

              return (
                <JoyChip
                  key={type}
                  color={active ? "primary" : "neutral"}
                  variant={active ? "solid" : "soft"}
                  onClick={() => handleTypeToggle(type)}
                  sx={{ cursor: "pointer" }}
                >
                  {typeLabels[type] || type}
                </JoyChip>
              );
            })}
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <Typography
            level="body-xs"
            textTransform="uppercase"
            fontWeight="lg"
            color="neutral"
          >
            Platforms
          </Typography>
          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
            {filterOptions.platforms.map((platform) => {
              const active = filters.platforms.includes(platform);

              return (
                <JoyChip
                  key={platform}
                  color={active ? "warning" : "neutral"}
                  variant={active ? "solid" : "soft"}
                  onClick={() => handlePlatformToggle(platform)}
                  sx={{ cursor: "pointer" }}
                >
                  {platformLabels[platform] || platform}
                </JoyChip>
              );
            })}
          </Stack>
        </Stack>

        <Stack spacing={1}>
          <Typography
            level="body-xs"
            textTransform="uppercase"
            fontWeight="lg"
            color="neutral"
          >
            Status
          </Typography>
          <Select
            size="sm"
            value={filters.statuses[0] ?? "all"}
            onChange={(_event, value) => {
              onFiltersChange({
                statuses: value && value !== "all" ? [value] : [],
              });
            }}
          >
            <Option value="all">All statuses</Option>
            {filterOptions.statuses.map((status) => (
              <Option key={status} value={status}>
                {statusLabels[status] || status}
              </Option>
            ))}
          </Select>
        </Stack>
      </Stack>
    </Box>
  );
};
