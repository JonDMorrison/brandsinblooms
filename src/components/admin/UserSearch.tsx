
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

interface UserSearchProps {
  onSearch: (searchTerm: string) => void;
  placeholder?: string;
}

export const UserSearch = ({ onSearch, placeholder = "Search users..." }: UserSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    onSearch(value);
  };

  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
      <Input
        placeholder={placeholder}
        value={searchTerm}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-10"
      />
    </div>
  );
};
