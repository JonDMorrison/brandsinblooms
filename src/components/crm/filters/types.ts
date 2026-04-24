export type FilterMode = "include" | "exclude";

export interface FilterOption {
  id: string;
  label: string;
  dotColor?: string;
  keywords?: string[];
}

export interface FilterValue {
  mode: FilterMode;
  selectedIds: string[];
}

export interface FilterDefinition {
  id: string;
  label: string;
  options: FilterOption[];
  searchable?: boolean;
  searchPlaceholder?: string;
}

export interface SortChipOption {
  id: string;
  label: string;
}
