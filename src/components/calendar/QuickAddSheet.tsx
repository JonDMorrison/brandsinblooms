import React, { useEffect, useState } from "react";
import Button from "@mui/joy/Button";
import Input from "@mui/joy/Input";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";

interface QuickAddSheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  defaultType?: "task" | "event" | "newsletter";
  loading?: boolean;
  onSubmit: (payload: {
    type: "task" | "event" | "newsletter";
    title: string;
    date: string;
    notes: string;
  }) => Promise<void> | void;
}

export const QuickAddSheet = ({
  isOpen,
  onClose,
  selectedDate,
  defaultType = "task",
  loading = false,
  onSubmit,
}: QuickAddSheetProps) => {
  const [type, setType] = useState<"task" | "event" | "newsletter">(
    defaultType,
  );
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dateValue, setDateValue] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    setType(defaultType);
    setTitle("");
    setNotes("");
    setDateValue(
      selectedDate
        ? format(selectedDate, "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
    );
  }, [defaultType, isOpen, selectedDate]);

  if (!selectedDate) return null;

  return (
    <JoyDialog
      open={isOpen}
      onClose={() => onClose()}
      title="Quick Add"
      description={`Create a task, campaign event, or newsletter for ${format(
        selectedDate,
        "EEEE, MMMM d, yyyy",
      )}.`}
      startDecorator={<CalendarPlus size={18} />}
      size="md"
      data-testid="quick-add-dialog"
    >
      <JoyDialogContent>
        <Stack
          spacing={2.25}
          sx={{ maxWidth: 720, mx: "auto", width: "100%" }}
        >
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
            <Stack spacing={0.75} sx={{ flex: 1 }}>
              <Typography
                level="body-xs"
                textTransform="uppercase"
                fontWeight="lg"
                color="neutral"
              >
                Type
              </Typography>
              <Select
                value={type}
                onChange={(_event, value) => value && setType(value)}
                slotProps={{ listbox: { disablePortal: true } }}
              >
                <Option value="task">Task</Option>
                <Option value="event">Campaign Event</Option>
                <Option value="newsletter">Newsletter</Option>
              </Select>
            </Stack>

            <Stack spacing={0.75} sx={{ flex: 1 }}>
              <Typography
                level="body-xs"
                textTransform="uppercase"
                fontWeight="lg"
                color="neutral"
              >
                Date
              </Typography>
              <Input
                type="date"
                value={dateValue}
                onChange={(event) => setDateValue(event.target.value)}
              />
            </Stack>
          </Stack>

          <Stack spacing={0.75}>
            <Typography
              level="body-xs"
              textTransform="uppercase"
              fontWeight="lg"
              color="neutral"
            >
              Title
            </Typography>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                type === "task"
                  ? "Draft spring planting carousel"
                  : type === "event"
                    ? "Mother’s Day in-store event"
                    : "Weekend offers newsletter"
              }
            />
          </Stack>

          <Stack spacing={0.75}>
            <Typography
              level="body-xs"
              textTransform="uppercase"
              fontWeight="lg"
              color="neutral"
            >
              Notes
            </Typography>
            <Textarea
              minRows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Context, segment notes, or creation details"
            />
          </Stack>
        </Stack>
      </JoyDialogContent>

      <JoyDialogActions>
        <Button variant="plain" color="neutral" onClick={() => onClose()}>
          Cancel
        </Button>
        <Button
          variant="solid"
          color="primary"
          loading={loading}
          disabled={!title.trim() || !dateValue}
          onClick={async () => {
            await onSubmit({
              type,
              title: title.trim(),
              date: dateValue,
              notes: notes.trim(),
            });
          }}
        >
          Add
        </Button>
      </JoyDialogActions>
    </JoyDialog>
  );
};
