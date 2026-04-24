import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Dropdown from "@mui/joy/Dropdown";
import ListDivider from "@mui/joy/ListDivider";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Plus } from "lucide-react";
import {
  BASIC_FIELD_DEFINITIONS,
  COMPLIANCE_FIELD_DEFINITIONS,
  canAddFieldType,
  createFieldFromType,
} from "@/lib/forms/fieldRegistry";
import type { FormCompliance, FormField } from "@/types/formBuilder";

interface FieldTypePickerMenuProps {
  fields: FormField[];
  compliance: FormCompliance;
  onAddField: (field: FormField) => void;
  compact?: boolean;
  label?: string;
  placement?:
    | "bottom"
    | "bottom-start"
    | "bottom-end"
    | "top"
    | "top-start"
    | "top-end"
    | "left"
    | "left-start"
    | "left-end"
    | "right"
    | "right-start"
    | "right-end";
}

const menuSx = {
  mt: 0.75,
  p: 0.5,
  gap: 0.25,
  borderRadius: "var(--joy-radius-lg)",
  border: "1px solid",
  borderColor: "neutral.200",
  backgroundColor: "background.surface",
  boxShadow: "var(--joy-shadow-lg)",
  minWidth: 260,
  "--List-padding": "0px",
} as const;

const groupLabelSx = {
  px: 1.25,
  py: 0.75,
  color: "neutral.500",
  fontSize: "var(--joy-fontSize-xs)",
  fontWeight: "var(--joy-fontWeight-lg)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
} as const;

const menuItemSx = {
  minHeight: 44,
  borderRadius: "var(--joy-radius-md)",
  px: 1.25,
  py: 0.875,
  gap: 1,
  alignItems: "flex-start",
} as const;

export function FieldTypePickerMenu({
  fields,
  compliance,
  onAddField,
  compact = false,
  label = "Add field",
  placement = "bottom-start",
}: FieldTypePickerMenuProps) {
  const sections = React.useMemo(
    () => [
      { title: "Fields", items: BASIC_FIELD_DEFINITIONS },
      { title: "Consent", items: COMPLIANCE_FIELD_DEFINITIONS },
    ],
    [],
  );

  return (
    <Dropdown>
      <MenuButton
        size="sm"
        color={compact ? "primary" : "neutral"}
        variant={compact ? "soft" : "soft"}
        sx={
          compact
            ? {
                minWidth: 28,
                minHeight: 28,
                borderRadius: "999px",
                px: 0.5,
              }
            : {
                borderRadius: "var(--joy-radius-lg)",
                fontWeight: "var(--joy-fontWeight-semibold)",
                px: 1.25,
              }
        }
      >
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Plus size={compact ? 14 : 16} />
          {!compact ? <span>{label}</span> : null}
        </Stack>
      </MenuButton>

      <Menu placement={placement} sx={menuSx}>
        {sections.map((section, sectionIndex) => (
          <React.Fragment key={section.title}>
            {sectionIndex > 0 ? <ListDivider sx={{ my: 0.5 }} /> : null}
            <Typography component="li" sx={groupLabelSx}>
              {section.title}
            </Typography>
            {section.items.map((definition) => {
              const disabled = !canAddFieldType(definition.type, fields);
              const Icon = definition.icon;

              return (
                <MenuItem
                  key={definition.type}
                  disabled={disabled}
                  onClick={() => {
                    if (disabled) {
                      return;
                    }

                    onAddField(
                      createFieldFromType(definition.type, compliance),
                    );
                  }}
                  sx={menuItemSx}
                >
                  <Avatar
                    size="sm"
                    variant="soft"
                    color={
                      definition.category === "compliance"
                        ? "warning"
                        : "neutral"
                    }
                  >
                    <Icon size={16} />
                  </Avatar>

                  <Stack spacing={0.375} sx={{ minWidth: 0 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 600 }}>
                      {definition.label}
                    </Typography>
                    <Typography level="body-xs" color="neutral">
                      {disabled
                        ? "Already added to this form"
                        : definition.helperText}
                    </Typography>
                  </Stack>
                </MenuItem>
              );
            })}
          </React.Fragment>
        ))}
      </Menu>
    </Dropdown>
  );
}
