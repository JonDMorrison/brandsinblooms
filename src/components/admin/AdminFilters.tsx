import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { Search, X } from "lucide-react";

interface AdminFiltersProps {
  onFilterChange: (search: string, status: string) => void;
  loading?: boolean;
}

export const AdminFilters = ({ onFilterChange, loading }: AdminFiltersProps) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Stable reference to onFilterChange to prevent recreating debounce
  const onFilterChangeRef = useRef(onFilterChange);
  onFilterChangeRef.current = onFilterChange;

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    
    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    
    // Set new timer
    debounceTimer.current = setTimeout(() => {
      onFilterChangeRef.current(value, status);
    }, 500);
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    // Status changes should be immediate for better UX
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    onFilterChangeRef.current(search, value);
  };

  const clearFilters = () => {
    // Cancel any pending debounced search
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    setSearch("");
    setStatus("");
    // Clear filters immediately, bypassing debounce
    onFilterChangeRef.current("", "");
  };

  const hasActiveFilters = search || status;

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search companies, contacts, or websites..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-10"
          disabled={loading}
        />
      </div>

      <NativeSelect
        value={status}
        onChange={(e) => handleStatusChange(e.target.value)}
        disabled={loading}
        className="w-full sm:w-48"
        options={[
          { value: "", label: "All Statuses" },
          { value: "trialing", label: "Trialing" },
          { value: "active", label: "Paid Active" },
          { value: "canceled", label: "Canceled/Inactive" },
        ]}
      />

      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={clearFilters}
          className="w-full sm:w-auto"
          disabled={loading}
        >
          <X className="h-4 w-4 mr-2" />
          Clear
        </Button>
      )}
    </div>
  );
};