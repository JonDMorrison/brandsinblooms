import ButtonGroup from "@mui/joy/ButtonGroup";
import { LayoutGrid, List } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";

export type CatalogLayout = "grid" | "list";

interface CatalogViewToggleProps {
  value: CatalogLayout;
  onChange: (value: CatalogLayout) => void;
  label: string;
}

export function CatalogViewToggle({ value, onChange, label }: CatalogViewToggleProps) {
  return (
    <ButtonGroup aria-label={label} size="sm" color="neutral" spacing={0.5}>
      <JoyButton
        aria-label="Grid view"
        aria-pressed={value === "grid"}
        variant={value === "grid" ? "soft" : "plain"}
        color="neutral"
        startDecorator={<LayoutGrid size={16} />}
        onClick={() => onChange("grid")}
        sx={{ minHeight: 40 }}
      >
        Grid
      </JoyButton>
      <JoyButton
        aria-label="List view"
        aria-pressed={value === "list"}
        variant={value === "list" ? "soft" : "plain"}
        color="neutral"
        startDecorator={<List size={16} />}
        onClick={() => onChange("list")}
        sx={{ minHeight: 40 }}
      >
        List
      </JoyButton>
    </ButtonGroup>
  );
}
