import * as React from "react";
import Dropdown from "@mui/joy/Dropdown";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Menu from "@mui/joy/Menu";
import MenuButton from "@mui/joy/MenuButton";
import MenuItem from "@mui/joy/MenuItem";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ExternalLink,
  MoreHorizontal,
  PanelRightClose,
  Pin,
  PinOff,
  Plus,
  Save,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import useMediaQuery from "@/hooks/use-media-query";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { useAskBloom } from "@/providers/AskBloomProvider";

const iconButtonSx = {
  width: 32,
  height: 32,
  minWidth: 32,
  minHeight: 32,
  borderRadius: "999px",
} as const;

export function AskBloomHeader() {
  const askBloom = useAskBloom();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const { user } = useAuth();
  const { tenant } = useTenant();

  const handleOpenInBloom = React.useCallback(() => {
    const search = askBloom.state.conversationId
      ? `?conversationId=${askBloom.state.conversationId}`
      : "";
    navigate(`/bloom${search}`);
    askBloom.close();
  }, [askBloom, navigate]);

  const handleSaveAsNote = React.useCallback(async () => {
    if (!tenant?.id || !user?.id) {
      toast.error("Sign in before saving Ask Bloom notes.");
      return;
    }

    if (!askBloom.state.conversationId || askBloom.state.messages.length === 0) {
      toast.error("Start a conversation before saving it as a note.");
      return;
    }

    if (!askBloom.state.resourceFocus) {
      toast.error("Ask Bloom can only save notes for a focused resource.");
      return;
    }

    const stripMarkdown = (value: string) =>
      value
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/^#+\s+/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const conversationBody = askBloom.state.messages
      .map((message) => {
        const speaker = message.role === "user" ? "You" : "Bloom";
        const messageText = stripMarkdown(
          message.blocks
            .map((block) => {
              if (block.type === "text") {
                return block.content;
              }

              if (block.type === "mutation_action") {
                return [
                  block.description,
                  block.result ? `Result: ${block.result}` : null,
                ]
                  .filter(Boolean)
                  .join("\n");
              }

              return block.content;
            })
            .filter(Boolean)
            .join("\n\n") || message.content,
        );

        return `**${speaker}:** ${messageText || "(No text)"}`;
      })
      .join("\n\n");

    const content = [
      `## AI Conversation - ${new Date().toLocaleString()}`,
      "",
      `**Resource:** ${askBloom.state.resourceFocus.resourceLabel} (${askBloom.state.resourceFocus.resourceType})`,
      "",
      conversationBody,
    ].join("\n");

    const { error } = await supabase.from("bloom_conversation_exports").insert({
      tenant_id: tenant.id,
      user_id: user.id,
      conversation_id: askBloom.state.conversationId,
      resource_type: askBloom.state.resourceFocus.resourceType,
      resource_id: askBloom.state.resourceFocus.resourceId,
      content,
    });

    if (error) {
      toast.error(
        error.message || "Ask Bloom could not save this conversation as a note.",
      );
      return;
    }

    toast.success("Conversation saved as note.");
  }, [
    askBloom.state.conversationId,
    askBloom.state.messages,
    askBloom.state.resourceFocus,
    tenant?.id,
    user?.id,
  ]);

  return (
    <Box
      sx={{
        height: 52,
        px: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: 1,
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: "flex", justifyContent: "flex-start" }}>
        <IconButton
          aria-label="Close Ask Bloom"
          color="neutral"
          size="sm"
          variant="plain"
          onClick={askBloom.close}
          sx={iconButtonSx}
        >
          <X size={18} strokeWidth={1.5} />
        </IconButton>
      </Box>

      <Typography
        level="title-sm"
        sx={{
          textAlign: "center",
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        Ask Bloom
      </Typography>

      <Stack
        direction="row"
        spacing={0.5}
        justifyContent="flex-end"
        sx={{ minWidth: 0 }}
      >
        <IconButton
          aria-label={isDesktop ? "Collapse Ask Bloom" : "Close Ask Bloom"}
          color="neutral"
          size="sm"
          variant="plain"
          onClick={isDesktop ? askBloom.toggleCollapse : askBloom.close}
          sx={iconButtonSx}
        >
          <PanelRightClose size={18} strokeWidth={1.5} />
        </IconButton>

        <Dropdown>
          <MenuButton
            slots={{ root: IconButton }}
            slotProps={{
              root: {
                "aria-label": "Ask Bloom actions",
                color: "neutral",
                size: "sm",
                variant: "plain",
                sx: iconButtonSx,
              },
            }}
          >
            <MoreHorizontal size={18} strokeWidth={1.5} />
          </MenuButton>
          <Menu
            placement="bottom-end"
            size="sm"
            sx={{
              "--List-padding": "0px",
              mt: 0.5,
              minWidth: 180,
              p: 0.5,
              borderRadius: "md",
              bgcolor: "background.surface",
              boxShadow: "var(--joy-shadow-md)",
            }}
          >
            <MenuItem
              onClick={
                askBloom.state.isPinned
                  ? askBloom.unpinConversation
                  : askBloom.pinConversation
              }
            >
              <ListItemDecorator>
                {askBloom.state.isPinned ? (
                  <PinOff size={16} strokeWidth={1.5} />
                ) : (
                  <Pin size={16} strokeWidth={1.5} />
                )}
              </ListItemDecorator>
              {askBloom.state.isPinned ? "Unpin conversation" : "Pin conversation"}
            </MenuItem>
            <MenuItem
              onClick={handleOpenInBloom}
            >
              <ListItemDecorator>
                <ExternalLink size={16} strokeWidth={1.5} />
              </ListItemDecorator>
              Open in Bloom
            </MenuItem>
            <MenuItem onClick={() => void handleSaveAsNote()}>
              <ListItemDecorator>
                <Save size={16} strokeWidth={1.5} />
              </ListItemDecorator>
              Save as note
            </MenuItem>
            <MenuItem onClick={askBloom.newConversation}>
              <ListItemDecorator>
                <Plus size={16} strokeWidth={1.5} />
              </ListItemDecorator>
              New conversation
            </MenuItem>
          </Menu>
        </Dropdown>
      </Stack>
    </Box>
  );
}
