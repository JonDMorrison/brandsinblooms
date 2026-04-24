import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import ChipDelete from "@mui/joy/ChipDelete";
import Divider from "@mui/joy/Divider";
import FormControl from "@mui/joy/FormControl";
import FormHelperText from "@mui/joy/FormHelperText";
import FormLabel from "@mui/joy/FormLabel";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

export interface CompanyProfileFormData {
  company_name: string;
  company_phone: string;
  company_overview: string;
  mission_statement: string;
  brand_voice: string;
  tone_of_writing: string;
  target_audience: string;
  ideal_customer: string;
  unique_selling_points: string;
  company_values: string;
  seasonal_focus: string;
  specializations: string;
  location_info: string;
}

export const EMPTY_COMPANY_PROFILE_FORM_DATA: CompanyProfileFormData = {
  company_name: "",
  company_phone: "",
  company_overview: "",
  mission_statement: "",
  brand_voice: "",
  tone_of_writing: "",
  target_audience: "",
  ideal_customer: "",
  unique_selling_points: "",
  company_values: "",
  seasonal_focus: "",
  specializations: "",
  location_info: "",
};

interface CompanyProfileFormFieldsProps {
  formData: CompanyProfileFormData;
  onInputChange: (field: keyof CompanyProfileFormData, value: string) => void;
}

export const parseArrayField = (value: string): string[] => {
  if (!value) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(value);
    return Array.isArray(parsedValue)
      ? parsedValue.map((item) => String(item).trim()).filter(Boolean)
      : [value.trim()].filter(Boolean);
  } catch {
    return value
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

const stringifyArrayField = (array: string[]) => JSON.stringify(array);

const formControlSx = {
  mb: 2.5,
};

const inputSx = {
  minHeight: 44,
  borderRadius: "lg",
  bgcolor: "background.surface",
  "--Input-focusedThickness": "0px",
};

const textareaSx = {
  minHeight: 112,
  borderRadius: "lg",
  bgcolor: "background.surface",
  "--Textarea-focusedThickness": "0px",
};

const sectionLabelSx = {
  mt: 3,
  mb: 2,
  color: "text.tertiary",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const helperTextSx = {
  color: "text.tertiary",
  fontSize: "var(--joy-fontSize-xs)",
  lineHeight: 1.4,
};

export const CompanyProfileFormFields = ({
  formData,
  onInputChange,
}: CompanyProfileFormFieldsProps) => {
  return (
    <Stack spacing={0} sx={{ width: "100%", maxWidth: 760 }}>
      <InputField
        label="Company Name"
        onValueChange={(value) => onInputChange("company_name", value)}
        placeholder="Your business name"
        value={formData.company_name}
      />

      <InputField
        label="Phone Number"
        onValueChange={(value) => onInputChange("company_phone", value)}
        placeholder="+1 (555) 000-0000"
        type="tel"
        value={formData.company_phone}
      />

      <SectionDivider label="About Your Business" />

      <TextareaField
        helperText={`${formData.company_overview.length} / 500 characters`}
        label="Company Overview"
        maxRows={6}
        minRows={3}
        onValueChange={(value) => onInputChange("company_overview", value)}
        placeholder="Describe your business, what you offer, and what makes you unique"
        value={formData.company_overview}
      />

      <TextareaField
        label="Mission Statement"
        maxRows={4}
        minRows={2}
        onValueChange={(value) => onInputChange("mission_statement", value)}
        placeholder="Your company's mission and purpose"
        value={formData.mission_statement}
      />

      <SectionDivider label="Brand & Voice" />

      <InputField
        label="Brand Voice"
        onValueChange={(value) => onInputChange("brand_voice", value)}
        placeholder="e.g., Friendly, Expert, Approachable"
        value={formData.brand_voice}
      />

      <InputField
        label="Tone of Writing"
        onValueChange={(value) => onInputChange("tone_of_writing", value)}
        placeholder="e.g., Conversational, Professional, Warm"
        value={formData.tone_of_writing}
      />

      <SectionDivider label="Audience" />

      <TextareaField
        label="Target Audience"
        minRows={2}
        onValueChange={(value) => onInputChange("target_audience", value)}
        placeholder="Who are your primary customers?"
        value={formData.target_audience}
      />

      <TextareaField
        label="Ideal Customer"
        minRows={2}
        onValueChange={(value) => onInputChange("ideal_customer", value)}
        placeholder="Describe your ideal customer profile"
        value={formData.ideal_customer}
      />

      <SectionDivider label="Differentiators" />

      <ChipInputField
        label="Unique Selling Points"
        onValueChange={(value) => onInputChange("unique_selling_points", value)}
        placeholder="Add a selling point..."
        value={formData.unique_selling_points}
      />

      <ChipInputField
        label="Company Values"
        onValueChange={(value) => onInputChange("company_values", value)}
        placeholder="Add a value..."
        value={formData.company_values}
      />

      <SectionDivider label="Specialization" />

      <InputField
        label="Seasonal Focus"
        onValueChange={(value) => onInputChange("seasonal_focus", value)}
        placeholder="e.g., Spring planting, Holiday arrangements"
        value={formData.seasonal_focus}
      />

      <InputField
        label="Specializations"
        onValueChange={(value) => onInputChange("specializations", value)}
        placeholder="e.g., Orchids, Native plants, Wedding florals"
        value={formData.specializations}
      />

      <TextareaField
        label="Location & Service Area"
        minRows={2}
        onValueChange={(value) => onInputChange("location_info", value)}
        placeholder="Describe your location, delivery area, or service region"
        value={formData.location_info}
      />
    </Stack>
  );
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <FormLabel>
      <Typography fontWeight="lg" level="body-sm">
        {children}
      </Typography>
    </FormLabel>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <Box>
      <Divider />
      <Typography fontWeight="lg" level="body-xs" sx={sectionLabelSx}>
        {label}
      </Typography>
    </Box>
  );
}

function InputField({
  label,
  onValueChange,
  placeholder,
  type,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  type?: React.ComponentProps<typeof Input>["type"];
  value: string;
}) {
  return (
    <FormControl sx={formControlSx}>
      <FieldLabel>{label}</FieldLabel>
      <Input
        fullWidth
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        sx={inputSx}
        type={type}
        value={value}
        variant="outlined"
      />
    </FormControl>
  );
}

function TextareaField({
  helperText,
  label,
  maxRows,
  minRows,
  onValueChange,
  placeholder,
  value,
}: {
  helperText?: string;
  label: string;
  maxRows?: number;
  minRows?: number;
  onValueChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <FormControl sx={formControlSx}>
      <FieldLabel>{label}</FieldLabel>
      <Textarea
        fullWidth
        maxRows={maxRows}
        minRows={minRows}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        sx={textareaSx}
        value={value}
        variant="outlined"
      />
      {helperText ? (
        <FormHelperText sx={helperTextSx}>{helperText}</FormHelperText>
      ) : null}
    </FormControl>
  );
}

function ChipInputField({
  label,
  onValueChange,
  placeholder,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const items = useMemo(() => parseArrayField(value), [value]);
  const [draftValue, setDraftValue] = useState("");

  const handleDelete = (index: number) => {
    onValueChange(
      stringifyArrayField(items.filter((_, itemIndex) => itemIndex !== index)),
    );
  };

  const handleAdd = () => {
    const trimmedValue = draftValue.trim();

    if (!trimmedValue) {
      return;
    }

    onValueChange(stringifyArrayField([...items, trimmedValue]));
    setDraftValue("");
  };

  return (
    <FormControl sx={formControlSx}>
      <FieldLabel>{label}</FieldLabel>

      {items.length ? (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 1.25 }} useFlexGap>
          {items.map((item, index) => (
            <Chip
              color="neutral"
              endDecorator={
                <ChipDelete
                  aria-label={`Remove ${item}`}
                  onDelete={() => handleDelete(index)}
                />
              }
              key={`${item}-${index}`}
              size="sm"
              sx={{
                "& .MuiChip-label": {
                  whiteSpace: "normal",
                },
                bgcolor: "background.surface",
                height: "auto",
                py: 0.25,
              }}
              variant="soft"
            >
              {item}
            </Chip>
          ))}
        </Stack>
      ) : null}

      <Stack alignItems="center" direction="row" spacing={1}>
        <Input
          fullWidth
          onChange={(event) => setDraftValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          size="sm"
          sx={inputSx}
          value={draftValue}
          variant="outlined"
        />
        <IconButton
          aria-label={`Add ${label.toLowerCase()}`}
          color="neutral"
          onClick={handleAdd}
          size="sm"
          variant="soft"
        >
          <Plus size={16} />
        </IconButton>
      </Stack>

      <FormHelperText sx={helperTextSx}>Press Enter to add each point</FormHelperText>
    </FormControl>
  );
}
