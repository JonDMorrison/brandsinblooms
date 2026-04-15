import { JoySearchInput } from "@/components/joy/JoySearchInput";
import { useState } from "react";

interface UserSearchProps {
  onSearch: (searchTerm: string) => void;
  placeholder?: string;
}

export const UserSearch = ({
  onSearch,
  placeholder = "Search users...",
}: UserSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onSearch(value);
  };

  return (
    <div className="w-full max-w-md">
      <JoySearchInput
        placeholder={placeholder}
        value={searchTerm}
        onValueChange={handleSearch}
      />
    </div>
  );
};
