import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Dropdown from "@mui/joy/Dropdown";
import FormControl from "@mui/joy/FormControl";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Stack from "@mui/joy/Stack";
import Textarea from "@mui/joy/Textarea";
import Typography from "@mui/joy/Typography";
import { ImageIcon, Sparkles } from "lucide-react";
import { CarrierStatus } from "./CarrierStatus";
import { MultiImageUpload } from "./MultiImageUpload";
import { MediaSelectorImage } from "@/components/crm/MediaSelectorImage";
import {
  MERGE_TAG_DEFINITIONS,
  formatTagWithDefault,
} from "@/lib/mergeTagDefinitions";
import {
  countSmsSegments,
  getSegmentDescription,
} from "@/lib/sms/smsSegmentCounter";

interface SMSComposerProps {
  value: string;
  onChange: (value: string) => void;
  imageUrl?: string;
  onImageChange?: (imageUrl: string | null) => void;
  mediaUrls?: string[];
  onMediaUrlsChange?: (urls: string[]) => void;
  maxLength?: number;
  placeholder?: string;
  showMergeTags?: boolean;
  showCharacterCount?: boolean;
  showMmsWarning?: boolean;
  showImageUpload?: boolean;
  enableMultiImage?: boolean;
  testPhoneNumber?: string;
  className?: string;
}

export function SMSComposer({
  value,
  onChange,
  imageUrl,
  onImageChange,
  mediaUrls = [],
  onMediaUrlsChange,
  maxLength = 320,
  placeholder = "Type your SMS message...",
  showMergeTags = true,
  showCharacterCount = true,
  showMmsWarning = true,
  showImageUpload = true,
  enableMultiImage = false,
  testPhoneNumber,
  className = "",
}: SMSComposerProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const segmentInfo = React.useMemo(() => countSmsSegments(value), [value]);
  const characterCount = value.length;
  const isOverLimit = characterCount > maxLength;
  const isNearLimit = characterCount > maxLength * 0.8;
  const activeMediaUrls = enableMultiImage
    ? mediaUrls
    : imageUrl
      ? [imageUrl]
      : [];

  const handleInsertTag = React.useCallback(
    (tagKey: string) => {
      const tagValue = formatTagWithDefault(tagKey);
      const textarea = textareaRef.current;

      if (!textarea) {
        onChange(`${value}${value ? " " : ""}${tagValue}`);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const nextValue = `${value.slice(0, start)}${tagValue}${value.slice(end)}`;
      onChange(nextValue);

      window.setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + tagValue.length,
          start + tagValue.length,
        );
      }, 0);
    },
    [onChange, value],
  );

  return (
    <Stack spacing={2} className={className}>
      <Card
        variant="outlined"
        sx={{
          borderRadius: "24px",
          borderColor: isOverLimit ? "danger.300" : "neutral.200",
          p: 2.25,
        }}
      >
        <Stack spacing={1.5}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ md: "center" }}
          >
            <Stack spacing={0.35}>
              <Typography level="title-sm">Message Composer</Typography>
              <Typography level="body-sm" color="neutral">
                Write the SMS copy and keep an eye on segments, character count,
                and MMS behavior.
              </Typography>
            </Stack>
            {showMergeTags ? (
              <Dropdown>
                <MenuButton
                  slots={{ root: Button }}
                  variant="soft"
                  color="neutral"
                  size="sm"
                >
                  Insert Merge Tag
                </MenuButton>
                <Menu
                  placement="bottom-end"
                  sx={{ maxHeight: 320, overflowY: "auto" }}
                >
                  {MERGE_TAG_DEFINITIONS.slice(0, 18).map((tag) => (
                    <MenuItem
                      key={tag.key}
                      onClick={() => handleInsertTag(tag.key)}
                    >
                      <ListItemDecorator>
                        <Sparkles size={14} />
                      </ListItemDecorator>
                      <Box>
                        <Typography level="body-sm" fontWeight="md">
                          {tag.label}
                        </Typography>
                        <Typography level="body-xs" color="neutral">
                          {`${tag.example} • ${formatTagWithDefault(tag.key)}`}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Menu>
              </Dropdown>
            ) : null}
          </Stack>

          <FormControl>
            <Textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              minRows={5}
              maxRows={12}
              placeholder={placeholder}
              variant="outlined"
              slotProps={{ textarea: { ref: textareaRef } }}
              sx={{ borderRadius: "14px" }}
            />
          </FormControl>

          {showCharacterCount ? (
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip
                size="sm"
                variant="soft"
                color={
                  isOverLimit ? "danger" : isNearLimit ? "warning" : "neutral"
                }
              >
                {`${characterCount}/${maxLength}`}
              </Chip>
              <Chip size="sm" variant="soft" color="primary">
                {`${Math.max(segmentInfo.segments, 1)} SMS segment${Math.max(segmentInfo.segments, 1) === 1 ? "" : "s"}`}
              </Chip>
              <Chip size="sm" variant="soft" color="neutral">
                {getSegmentDescription(segmentInfo)}
              </Chip>
            </Stack>
          ) : null}
        </Stack>
      </Card>

      {showImageUpload ? (
        <Card
          variant="outlined"
          sx={{ borderRadius: "24px", borderColor: "neutral.200", p: 2.25 }}
        >
          <Stack spacing={1.5}>
            <Stack spacing={0.35}>
              <Typography level="title-sm">MMS Image Attachments</Typography>
              <Typography level="body-sm" color="neutral">
                Add media when you want this message to send as MMS.
              </Typography>
            </Stack>

            {enableMultiImage ? (
              <MultiImageUpload
                value={mediaUrls}
                onChange={(urls) => onMediaUrlsChange?.(urls)}
                maxFiles={3}
                maxSizePerFile={500}
              />
            ) : (
              <Stack spacing={1.25}>
                <MediaSelectorImage
                  src={imageUrl || ""}
                  onChange={(nextImageUrl) => onImageChange?.(nextImageUrl)}
                  contentContext="SMS MMS image attachment"
                  className="h-32"
                />
                {imageUrl ? (
                  <Chip
                    size="sm"
                    variant="soft"
                    color="primary"
                    startDecorator={<ImageIcon size={12} />}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Will send as MMS
                  </Chip>
                ) : null}
              </Stack>
            )}

            {testPhoneNumber && activeMediaUrls.length > 0 ? (
              <CarrierStatus
                phoneNumber={testPhoneNumber}
                mediaUrls={activeMediaUrls}
              />
            ) : null}
          </Stack>
        </Card>
      ) : null}

      <Stack spacing={1.25}>
        {isOverLimit ? (
          <Alert color="danger" variant="soft" sx={{ borderRadius: "18px" }}>
            {`This message exceeds ${maxLength} characters and will span ${Math.max(segmentInfo.segments, 1)} SMS segments.`}
          </Alert>
        ) : null}

        {showMmsWarning && characterCount > 160 ? (
          <Alert color="warning" variant="soft" sx={{ borderRadius: "18px" }}>
            Long messages can increase costs and may be converted differently by
            some carriers.
          </Alert>
        ) : null}
      </Stack>
    </Stack>
  );
}
