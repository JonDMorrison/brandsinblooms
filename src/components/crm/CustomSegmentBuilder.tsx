import React, { useState, useEffect } from "react";
import Autocomplete from "@mui/joy/Autocomplete";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Dropdown from "@mui/joy/Dropdown";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import ListDivider from "@mui/joy/ListDivider";
import ListItem from "@mui/joy/ListItem";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ChevronDown, Plus, X } from "lucide-react";

interface FilterCriteria {
  type: string;
  operator?: string;
  value?: string | number;
  values?: string[];
  days?: number;
}

interface CustomSegmentBuilderProps {
  onSave: (segmentData: { name: string; filters: FilterCriteria[] }) => void;
  onCancel: () => void;
  open?: boolean;
  onChange?: (segmentData: { name: string; filters: FilterCriteria[] }) => void;
}

const PRODUCT_CATEGORIES = [
  "Houseplants", "Vegetables", "Herbs", "Flowers", "Trees & Shrubs",
  "Garden Tools", "Fertilizers", "Pots & Planters", "Holiday Décor", "Seeds",
];

const CUSTOMER_TAGS = [
  "VIP", "Workshop Attendee", "Loyalty Member", "Newsletter Subscriber",
  "Early Bird", "Bulk Buyer", "Seasonal Shopper", "First-Time Buyer",
];

const USDA_ZONES = [
  "3a", "3b", "4a", "4b", "5a", "5b", "6a", "6b",
  "7a", "7b", "8a", "8b", "9a", "9b", "10a", "10b", "11",
];

const CLIMATE_ZONES = [
  "polar", "subpolar", "temperate_cold", "temperate_warm", "subtropical", "tropical",
];

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

// Filter type values are preserved verbatim (including the historical
// "totalSpent" option id) because they are persisted to custom_segments.filters
// and consumed by downstream segment evaluation — this is a visual redesign only.
const FILTER_GROUPS = [
  {
    label: "Purchase Behavior",
    options: [
      { value: "lastPurchase", label: "Last Purchase" },
      { value: "purchaseCount", label: "Purchase Count" },
      { value: "totalSpent", label: "Total Spent" },
      { value: "productCategory", label: "Product Category" },
    ],
  },
  {
    label: "Geographic",
    options: [
      { value: "postalCode", label: "Postal Code" },
      { value: "state", label: "State/Region" },
      { value: "usdaZone", label: "USDA Hardiness Zone" },
      { value: "climateZone", label: "Climate Zone" },
    ],
  },
  {
    label: "Customer Profile",
    options: [
      { value: "tags", label: "Tags" },
      { value: "emailEngagement", label: "Email Engagement" },
    ],
  },
];

const FILTER_LABELS: Record<string, string> = {
  lastPurchase: "📆 Last Purchase Date",
  purchaseCount: "🛒 Number of Purchases",
  totalSpend: "💰 Total Spend",
  tags: "🏷️ Tags",
  productCategory: "🪴 Product Category",
  emailEngagement: "💌 Email Engagement",
  postalCode: "📍 Postal Code",
  usdaZone: "🌱 USDA Hardiness Zone",
  state: "🗺️ State/Region",
  climateZone: "🌡️ Climate Zone",
};

const toNumber = (raw: string, float = false) => {
  if (raw === "") return undefined;
  const parsed = float ? parseFloat(raw) : parseInt(raw, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const CustomSegmentBuilder = ({ onChange }: CustomSegmentBuilderProps) => {
  const [segmentName, setSegmentName] = useState("");
  const [filters, setFilters] = useState<FilterCriteria[]>([]);

  // Report the working draft up to the parent (which owns the Save action).
  useEffect(() => {
    if (onChange) {
      onChange({ name: segmentName, filters });
    }
  }, [segmentName, filters, onChange]);

  const addFilter = (type: string) => {
    setFilters((prev) => [...prev, { type }]);
  };

  const updateFilter = (index: number, updates: Partial<FilterCriteria>) => {
    setFilters((prev) =>
      prev.map((filter, i) => (i === index ? { ...filter, ...updates } : filter)),
    );
  };

  const removeFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index));
  };

  const getFilterLabel = (type: string) => FILTER_LABELS[type] || type;

  const renderOperatorSelect = (
    index: number,
    filter: FilterCriteria,
    placeholder: string,
    options: Array<{ value: string; label: string }>,
    minWidth: number,
  ) => (
    <Select
      onChange={(_event, value) =>
        updateFilter(index, { operator: value ?? undefined })
      }
      placeholder={placeholder}
      size="sm"
      sx={{ minWidth }}
      value={filter.operator ?? null}
    >
      {options.map((option) => (
        <Option key={option.value} value={option.value}>
          {option.label}
        </Option>
      ))}
    </Select>
  );

  const renderMultiSelect = (
    index: number,
    filter: FilterCriteria,
    options: string[],
    placeholder: string,
    getOptionLabel: (value: string) => string = (value) => value,
  ) => (
    <Autocomplete
      getOptionLabel={getOptionLabel}
      multiple
      onChange={(_event, values) => updateFilter(index, { values })}
      options={options}
      placeholder={filter.values?.length ? undefined : placeholder}
      size="sm"
      value={filter.values ?? []}
    />
  );

  const renderFilterConfig = (filter: FilterCriteria, index: number) => {
    switch (filter.type) {
      case "lastPurchase":
        return (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
            useFlexGap
          >
            {renderOperatorSelect(index, filter, "Select", [
              { value: "within", label: "Within" },
              { value: "before", label: "Before" },
              { value: "never", label: "Never purchased" },
            ], 150)}
            {filter.operator !== "never" && (
              <Input
                endDecorator={
                  <Typography level="body-xs">days</Typography>
                }
                onChange={(event) =>
                  updateFilter(index, { days: toNumber(event.target.value) })
                }
                placeholder="Days"
                size="sm"
                sx={{ width: 130 }}
                type="number"
                value={filter.days ?? ""}
              />
            )}
          </Stack>
        );

      case "purchaseCount":
        return (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {renderOperatorSelect(index, filter, "≥", [
              { value: "gte", label: "≥" },
              { value: "eq", label: "=" },
              { value: "lte", label: "≤" },
            ], 84)}
            <Input
              onChange={(event) =>
                updateFilter(index, { value: toNumber(event.target.value) })
              }
              placeholder="Number"
              size="sm"
              sx={{ width: 130 }}
              type="number"
              value={filter.value ?? ""}
            />
          </Stack>
        );

      case "totalSpend":
        return (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {renderOperatorSelect(index, filter, "≥", [
              { value: "gte", label: "≥" },
              { value: "eq", label: "=" },
              { value: "lte", label: "≤" },
            ], 84)}
            <Input
              onChange={(event) =>
                updateFilter(index, {
                  value: toNumber(event.target.value, true),
                })
              }
              placeholder="Amount"
              size="sm"
              startDecorator="$"
              sx={{ width: 150 }}
              type="number"
              value={filter.value ?? ""}
            />
          </Stack>
        );

      case "tags":
        return renderMultiSelect(index, filter, CUSTOMER_TAGS, "Select tags...");

      case "productCategory":
        return renderMultiSelect(
          index,
          filter,
          PRODUCT_CATEGORIES,
          "Select categories...",
        );

      case "emailEngagement":
        return (
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap" }}
            useFlexGap
          >
            {renderOperatorSelect(index, filter, "Action", [
              { value: "opened", label: "Opened" },
              { value: "clicked", label: "Clicked" },
            ], 120)}
            <Input
              onChange={(event) =>
                updateFilter(index, { value: toNumber(event.target.value) })
              }
              placeholder="Campaigns"
              size="sm"
              sx={{ width: 120 }}
              type="number"
              value={filter.value ?? ""}
            />
            <Typography color="neutral" level="body-xs">
              in the past
            </Typography>
            <Input
              endDecorator={<Typography level="body-xs">days</Typography>}
              onChange={(event) =>
                updateFilter(index, { days: toNumber(event.target.value) })
              }
              placeholder="Days"
              size="sm"
              sx={{ width: 120 }}
              type="number"
              value={filter.days ?? ""}
            />
          </Stack>
        );

      case "postalCode":
        return (
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            {renderOperatorSelect(index, filter, "Select", [
              { value: "equals", label: "Equals" },
              { value: "contains", label: "Contains" },
              { value: "startsWith", label: "Starts with" },
            ], 140)}
            <Input
              onChange={(event) =>
                updateFilter(index, { value: event.target.value })
              }
              placeholder="Postal code"
              size="sm"
              sx={{ width: 170 }}
              value={filter.value ?? ""}
            />
          </Stack>
        );

      case "usdaZone":
        return renderMultiSelect(
          index,
          filter,
          USDA_ZONES,
          "Select zones...",
          (zone) => `Zone ${zone}`,
        );

      case "state":
        return renderMultiSelect(index, filter, US_STATES, "Select states...");

      case "climateZone":
        return renderMultiSelect(
          index,
          filter,
          CLIMATE_ZONES,
          "Select climates...",
          (climate) => climate.replace(/_/g, " "),
        );

      default:
        return null;
    }
  };

  return (
    <Stack spacing={2.5}>
      <FormControl required>
        <FormLabel>Segment Name</FormLabel>
        <Input
          autoFocus
          onChange={(event) => setSegmentName(event.target.value)}
          placeholder="e.g., VIP Customers, Local Shoppers..."
          value={segmentName}
        />
      </FormControl>

      <Box>
        <Stack
          direction="row"
          spacing={1}
          sx={{
            alignItems: "center",
            justifyContent: "space-between",
            mb: filters.length > 0 ? 1.5 : 1,
          }}
        >
          <Typography level="title-sm">Filters</Typography>
          <Dropdown>
            <MenuButton
              color="neutral"
              endDecorator={<ChevronDown aria-hidden="true" size={16} />}
              size="sm"
              startDecorator={<Plus aria-hidden="true" size={16} />}
              variant="outlined"
            >
              Add Filter
            </MenuButton>
            <Menu
              placement="bottom-end"
              size="sm"
              sx={{ maxHeight: 340, minWidth: 240, overflow: "auto" }}
            >
              {FILTER_GROUPS.map((group, groupIndex) => (
                <React.Fragment key={group.label}>
                  {groupIndex > 0 && <ListDivider />}
                  <ListItem sticky>
                    <Typography
                      level="body-xs"
                      sx={{
                        color: "neutral.500",
                        fontWeight: 600,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                      }}
                    >
                      {group.label}
                    </Typography>
                  </ListItem>
                  {group.options.map((option) => (
                    <MenuItem
                      key={option.value}
                      onClick={() => addFilter(option.value)}
                    >
                      {option.label}
                    </MenuItem>
                  ))}
                </React.Fragment>
              ))}
            </Menu>
          </Dropdown>
        </Stack>

        {filters.length === 0 ? (
          <Sheet
            variant="soft"
            sx={{ borderRadius: "sm", px: 2, py: 1.75, textAlign: "center" }}
          >
            <Typography color="neutral" level="body-xs">
              No filters yet — add one to narrow this segment, or save as-is to
              match all customers.
            </Typography>
          </Sheet>
        ) : (
          <Stack spacing={1.25}>
            {filters.map((filter, index) => (
              <Card key={index} size="sm" variant="outlined">
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography level="title-sm">
                    {getFilterLabel(filter.type)}
                  </Typography>
                  <IconButton
                    aria-label="Remove filter"
                    color="neutral"
                    onClick={() => removeFilter(index)}
                    size="sm"
                    variant="plain"
                  >
                    <X aria-hidden="true" size={16} />
                  </IconButton>
                </Stack>
                <Box sx={{ mt: 0.5 }}>{renderFilterConfig(filter, index)}</Box>
              </Card>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  );
};
