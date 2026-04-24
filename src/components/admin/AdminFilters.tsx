import { useState, useEffect, useRef } from "react";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoySelect } from "@/components/joy/JoySelect";
import { FilterX } from "lucide-react";

interface AdminFiltersProps {
  onFilterChange: (search: string, status: string) => void;
  loading?: boolean;
}

export const AdminFilters = ({
  onFilterChange,
  loading,
}: AdminFiltersProps) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [wasSearching, setWasSearching] = useState(false);

  // Stable reference to onFilterChange to prevent recreating debounce
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  // Restore focus when loading completes and we were searching
  useEffect(() => {
    if (!loading && wasSearching && searchInputRef.current) {
      searchInputRef.current.focus();
      setWasSearching(false);
    }
  }, [loading, wasSearching]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setWasSearching(true);
  };

  const handleSearchCommit = (value: string) => {
    onFilterChangeRef.current(value, status);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    onFilterChangeRef.current(search, value);
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setWasSearching(false);
    onFilterChangeRef.current("", "");
  };

  const hasActiveFilters = search || status;

  return (
    <Sheet
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: "var(--joy-radius-lg)",
        borderColor: "neutral.200",
        backgroundColor: "#FFFFFF",
      }}
    >
      <Stack spacing={1.5}>
        <Typography level="title-sm">Filters</Typography>
        <Stack
          direction={{ xs: "column", lg: "row" }}
          spacing={2}
          alignItems={{ xs: "stretch", lg: "center" }}
          justifyContent="space-between"
          useFlexGap
          flexWrap="wrap"
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            sx={{ flex: 1, minWidth: 0 }}
          >
            <JoySearchInput
              ref={searchInputRef}
              placeholder="Search companies, contacts, or websites..."
              value={search}
              onValueChange={handleSearchChange}
              onDebouncedChange={handleSearchCommit}
              onClear={() => setWasSearching(false)}
              debounceMs={500}
              disabled={loading}
              sx={{ flex: 1, minWidth: { xs: "100%", md: 320 } }}
            />

            <JoySelect
              value={status}
              onValueChange={handleStatusChange}
              disabled={loading}
              sx={{ width: { xs: "100%", md: 220 } }}
              options={[
                { value: "", label: "All statuses" },
                { value: "active", label: "Active" },
                { value: "trialing", label: "Trialing" },
                { value: "canceled", label: "Suspended / Inactive" },
              ]}
            />
          </Stack>

          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <JoyButton
              bloomVariant="ghost"
              onClick={clearFilters}
              disabled={!hasActiveFilters || loading}
              startDecorator={<FilterX size={16} />}
            >
              Clear Filters
            </JoyButton>
          </Stack>
        </Stack>
      </Stack>
    </Sheet>
  );
};
