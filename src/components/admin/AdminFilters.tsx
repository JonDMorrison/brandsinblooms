import { useState, useEffect } from "react";
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

  // Debounce search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onFilterChange(search, status);
    }, 500); // Wait 500ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [search, status, onFilterChange]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    // Remove immediate call to onFilterChange - now handled by useEffect
  };

  const handleStatusChange = (value: string) => {
    setStatus(value);
    // Remove immediate call to onFilterChange - now handled by useEffect
  };

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    // Clear filters immediately, bypassing debounce
    onFilterChange("", "");
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