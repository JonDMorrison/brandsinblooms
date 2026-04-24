import Stack from "@mui/joy/Stack";
import { JoyButton } from "@/components/joy/JoyButton";
import { FilterChip } from "./FilterChip";
import type { FilterDefinition, FilterValue, SortChipOption } from "./types";

export interface FilterChipBarProps {
  alignment?: "start" | "end";
  clearAllVisible?: boolean;
  filters: Array<{
    definition: FilterDefinition;
    onChange: (value: FilterValue) => void;
    value: FilterValue;
  }>;
  onClearAll?: () => void;
  sort: {
    label: string;
    onChange: (value: string) => void;
    options: SortChipOption[];
    value: string;
  };
}

export function FilterChipBar({
  alignment = "start",
  clearAllVisible = false,
  filters,
  onClearAll,
  sort,
}: FilterChipBarProps) {
  const endAligned = alignment === "end";

  return (
    <Stack
      direction={{ xs: "column", lg: "row" }}
      spacing={1}
      alignItems={{ xs: "stretch", lg: endAligned ? "flex-end" : "center" }}
      justifyContent={endAligned ? "flex-end" : "space-between"}
      sx={{
        width: endAligned ? "fit-content" : "100%",
        maxWidth: "100%",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
        sx={{
          flex: endAligned ? "0 1 auto" : 1,
          justifyContent: {
            xs: "flex-start",
            lg: endAligned ? "flex-end" : "flex-start",
          },
          width: "100%",
          maxWidth: "100%",
        }}
      >
        {filters.map((filter) => (
          <FilterChip
            key={filter.definition.id}
            filter={filter.definition}
            onChange={filter.onChange}
            value={filter.value}
          />
        ))}
        <FilterChip
          variant="sort"
          label={sort.label}
          onChange={sort.onChange}
          options={sort.options}
          value={sort.value}
        />
      </Stack>
      {clearAllVisible ? (
        <JoyButton
          variant="plain"
          color="primary"
          size="sm"
          sx={{
            alignSelf: {
              xs: "flex-start",
              lg: endAligned ? "center" : "center",
            },
            minHeight: "auto",
            px: 0,
            whiteSpace: "nowrap",
          }}
          onClick={onClearAll}
        >
          Clear all
        </JoyButton>
      ) : null}
    </Stack>
  );
}
