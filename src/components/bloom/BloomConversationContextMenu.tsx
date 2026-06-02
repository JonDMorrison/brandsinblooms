import * as React from "react";
import Tooltip from "@mui/joy/Tooltip";
import {
  Archive,
  Download,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuSeparator,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import type { BloomConversation } from "@/hooks/bloom/types";

interface BloomConversationContextMenuProps {
  conversation: BloomConversation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onPin: () => void;
  onUnpin: () => void;
  onArchive: () => void;
  onUnarchive?: () => void;
  onDelete: () => void;
}

const menuIcon = (icon: React.ReactNode) => icon;
const SIDEBAR_MENU_BUTTON_HOVER_BG = "rgba(255,255,255,0.1)";
const SIDEBAR_MENU_BUTTON_ACTIVE_BG = "rgba(255,255,255,0.12)";

export function BloomConversationContextMenu({
  conversation,
  open,
  onOpenChange,
  onRename,
  onPin,
  onUnpin,
  onArchive,
  onUnarchive,
  onDelete,
}: BloomConversationContextMenuProps) {
  const pinned = conversation.status === "pinned";
  const archived = conversation.status === "archived";

  return (
    <JoyDropdownMenu
      open={open}
      onOpenChange={(_event, nextOpen) => onOpenChange(nextOpen)}
    >
      <Tooltip
        arrow
        title="Conversation actions"
        variant="solid"
        placement="top"
      >
        <JoyDropdownMenuTrigger
          aria-label="Conversation actions"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          iconButtonSx={{
            color: "rgba(255,255,255,0.72)",
            backgroundColor: "transparent",
            "--IconButton-hoverBg": SIDEBAR_MENU_BUTTON_HOVER_BG,
            "--IconButton-activeBg": SIDEBAR_MENU_BUTTON_ACTIVE_BG,
            "&:hover": {
              backgroundColor: SIDEBAR_MENU_BUTTON_HOVER_BG,
              color: "common.white",
            },
            "&[aria-expanded='true']": {
              backgroundColor: SIDEBAR_MENU_BUTTON_ACTIVE_BG,
              color: "common.white",
            },
          }}
        >
          <MoreHorizontal size={16} strokeWidth={1.9} />
        </JoyDropdownMenuTrigger>
      </Tooltip>
      <JoyDropdownMenuContent
        placement="bottom-end"
        sx={{ minWidth: 190, backgroundColor: "background.popup" }}
      >
        <JoyDropdownMenuItem
          startDecorator={menuIcon(<Pencil size={16} strokeWidth={1.9} />)}
          onClick={onRename}
        >
          Rename
        </JoyDropdownMenuItem>
        <JoyDropdownMenuItem
          startDecorator={menuIcon(
            pinned ? (
              <PinOff size={16} strokeWidth={1.9} />
            ) : (
              <Pin size={16} strokeWidth={1.9} />
            ),
          )}
          onClick={pinned ? onUnpin : onPin}
          disabled={archived}
        >
          {pinned ? "Unpin" : "Pin"}
        </JoyDropdownMenuItem>
        <JoyDropdownMenuSeparator />
        <JoyDropdownMenuItem
          startDecorator={menuIcon(<Archive size={16} strokeWidth={1.9} />)}
          onClick={archived && onUnarchive ? onUnarchive : onArchive}
        >
          {archived ? "Unarchive" : "Archive"}
        </JoyDropdownMenuItem>
        <JoyDropdownMenuItem
          destructive
          startDecorator={menuIcon(<Trash2 size={16} strokeWidth={1.9} />)}
          onClick={onDelete}
        >
          Delete
        </JoyDropdownMenuItem>
        <JoyDropdownMenuSeparator />
        <Tooltip arrow title="Coming soon" variant="solid" placement="left">
          <JoyDropdownMenuItem
            disabled
            startDecorator={menuIcon(<Download size={16} strokeWidth={1.9} />)}
            sx={{ pointerEvents: "auto" }}
          >
            Export
          </JoyDropdownMenuItem>
        </Tooltip>
      </JoyDropdownMenuContent>
    </JoyDropdownMenu>
  );
}
