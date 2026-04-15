import { useState } from "react";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDialog, JoyDialogContent } from "@/components/joy/JoyDialog";
import { JoyInput as Input } from "@/components/joy/JoyInput";
import { JoyTextarea as Textarea } from "@/components/joy/JoyTextarea";
import {
  JoyCard,
  JoyCardContent,
  JoyCardHeader,
} from "@/components/joy/JoyCard";
import { Send, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TenantOutreachModalProps {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  companyName: string;
  contactEmail: string;
  contactFirstName: string;
}

const SENDERS = [
  { id: "jeff", name: "Jeff", email: "jeff@brandsinblooms.com" },
  { id: "jon", name: "Jon", email: "jon@brandsinblooms.com" },
  { id: "support", name: "Support Team", email: "support@brandsinblooms.com" },
] as const;

type SenderId = (typeof SENDERS)[number]["id"];

interface Template {
  id: string;
  name: string;
  getSubject: (company: string) => string;
  getBody: (firstName: string, company: string, senderName: string) => string;
}

const TEMPLATES: Template[] = [
  {
    id: "welcome",
    name: "Welcome & Getting Started",
    getSubject: (co) => `Welcome to BloomSuite, ${co}!`,
    getBody: (fn, co, sn) =>
      `Hi ${fn},\n\nWelcome to BloomSuite! We're excited to have ${co} on board.\n\nI wanted to personally reach out to make sure you're getting the most out of the platform. If you have any questions as you get started, just reply to this email — I'm here to help.\n\nTalk soon,\n${sn}`,
  },
  {
    id: "finish-setup",
    name: "Finish Your Setup",
    getSubject: (co) => `Quick tip for ${co} — you're almost there`,
    getBody: (fn, co, sn) =>
      `Hi ${fn},\n\nI noticed ${co} hasn't quite finished setting up your account yet. The good news is you're close — once you connect your social accounts and upload your contact list, you'll be ready to send your first campaign.\n\nNeed help with any step? Just reply and I'll walk you through it.\n\n${sn}`,
  },
  {
    id: "re-engagement",
    name: "Re-engagement — Trial Expired",
    getSubject: (co) => `Your BloomSuite trial for ${co}`,
    getBody: (fn, co, sn) =>
      `Hi ${fn},\n\nI noticed your BloomSuite trial for ${co} recently ended. I'd love to hear what you thought — and if timing wasn't right, no worries at all.\n\nIf you're open to it, I'd be happy to extend your trial so you can finish exploring the platform. Just reply to this email.\n\n${sn}`,
  },
  {
    id: "check-in",
    name: "Check-In",
    getSubject: (co) => `How's BloomSuite working for ${co}?`,
    getBody: (fn, co, sn) =>
      `Hi ${fn},\n\nJust checking in to see how things are going at ${co}. Are there any features you'd like help with, or anything we can improve?\n\nYour feedback helps us build a better product for garden centers.\n\n${sn}`,
  },
];

export const TenantOutreachModal = ({
  open,
  onClose,
  tenantId,
  companyName,
  contactEmail,
  contactFirstName,
}: TenantOutreachModalProps) => {
  const [senderId, setSenderId] = useState<SenderId>("jeff");
  const sender = SENDERS.find((s) => s.id === senderId)!;
  const firstName = contactFirstName || contactEmail.split("@")[0];

  // Editable subjects and bodies per template
  const [edits, setEdits] = useState<
    Record<string, { subject?: string; body?: string }>
  >({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const getSubject = (t: Template) =>
    edits[t.id]?.subject ?? t.getSubject(companyName);
  const getBody = (t: Template) =>
    edits[t.id]?.body ?? t.getBody(firstName, companyName, sender.name);

  const updateEdit = (
    templateId: string,
    field: "subject" | "body",
    value: string,
  ) => {
    setEdits((prev) => ({
      ...prev,
      [templateId]: { ...prev[templateId], [field]: value },
    }));
  };

  // Reset editable body when sender changes (so sender name updates)
  const handleSenderChange = (id: SenderId) => {
    setSenderId(id);
    // Clear body edits so they regenerate with new sender name
    setEdits((prev) => {
      const next: typeof prev = {};
      for (const key of Object.keys(prev)) {
        next[key] = { subject: prev[key]?.subject };
      }
      return next;
    });
  };

  const handleSend = async (template: Template) => {
    const subject = getSubject(template);
    const body = getBody(template);

    // Convert plain text body to HTML
    const htmlContent = body
      .split("\n")
      .map((line) =>
        line.trim()
          ? `<p style="margin: 0 0 12px 0; font-family: sans-serif; font-size: 15px; color: #374151; line-height: 1.6;">${line}</p>`
          : `<br/>`,
      )
      .join("\n");

    setSendingId(template.id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          body: {
            to: contactEmail,
            subject,
            html_content: htmlContent,
            from_name: sender.name,
            from_email: sender.email,
            reply_to: sender.email,
            tags: [{ name: "type", value: "admin-outreach" }],
          },
        },
      );

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Send failed");

      // Log to audit log
      const { data: sessionData } = await supabase.auth.getUser();
      if (sessionData?.user) {
        await supabase.from("admin_audit_log").insert({
          admin_user_id: sessionData.user.id,
          target_tenant_id: tenantId,
          action_type: "outreach_email",
          action_details: {
            template: template.name,
            contact_email: contactEmail,
            sender_name: sender.name,
            sender_email: sender.email,
            subject,
          },
        });
      }

      setSentIds((prev) => new Set(prev).add(template.id));
      toast.success(`Email sent to ${contactEmail}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setSendingId(null);
    }
  };

  return (
    <JoyDialog
      open={open}
      onClose={() => onClose()}
      size="lg"
      title={`Outreach — ${companyName}`}
      description={
        <>
          Send a personalized email to <strong>{contactEmail}</strong>
        </>
      }
      dialogSx={{ maxHeight: "90vh" }}
    >
      <JoyDialogContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ pb: 1 }}>
            {SENDERS.map((s) => (
              <JoyButton
                key={s.id}
                bloomVariant={senderId === s.id ? "default" : "outline"}
                size="sm"
                onClick={() => handleSenderChange(s.id as SenderId)}
              >
                {s.name}
              </JoyButton>
            ))}
          </Stack>

          <Stack spacing={2}>
            {TEMPLATES.map((template) => {
              const isSent = sentIds.has(template.id);
              const isSending = sendingId === template.id;

              return (
                <JoyCard
                  key={template.id}
                  sx={
                    isSent
                      ? {
                          borderColor: "success.200",
                          backgroundColor: "success.50",
                        }
                      : undefined
                  }
                >
                  <JoyCardHeader
                    title={template.name}
                    titleProps={{ level: "title-sm" }}
                    actions={
                      isSent ? (
                        <Stack
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                        >
                          <Check className="h-3 w-3 text-green-600" />
                          <Typography
                            level="body-xs"
                            sx={{ color: "success.600" }}
                          >
                            Sent
                          </Typography>
                        </Stack>
                      ) : null
                    }
                  />
                  <JoyCardContent>
                    <Stack spacing={2}>
                      <Input
                        label="Subject"
                        size="sm"
                        value={getSubject(template)}
                        onChange={(e) =>
                          updateEdit(template.id, "subject", e.target.value)
                        }
                      />

                      <Textarea
                        label="Body"
                        value={getBody(template)}
                        onChange={(e) =>
                          updateEdit(template.id, "body", e.target.value)
                        }
                        rows={5}
                        minRows={5}
                      />

                      <JoyButton
                        fullWidth
                        loading={isSending}
                        loadingPosition="start"
                        size="sm"
                        onClick={() => handleSend(template)}
                        disabled={isSending || isSent}
                        startDecorator={
                          isSent ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )
                        }
                      >
                        {isSending
                          ? "Sending..."
                          : isSent
                            ? "Sent"
                            : `Send as ${sender.name}`}
                      </JoyButton>
                    </Stack>
                  </JoyCardContent>
                </JoyCard>
              );
            })}
          </Stack>
        </Stack>
      </JoyDialogContent>
    </JoyDialog>
  );
};
