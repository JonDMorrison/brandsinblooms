import { useState, useCallback } from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Typography from "@mui/joy/Typography";
import Sheet from "@mui/joy/Sheet";
import Input from "@mui/joy/Input";
import Textarea from "@mui/joy/Textarea";
import Button from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";

type View = "menu" | "form" | "success";

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("menu");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();
  const { tenant } = useTenant();

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";
  const userEmail = user?.email || "";

  const handleToggle = useCallback(() => {
    setOpen((v) => {
      if (v) {
        setView("menu");
        setSubject("");
        setMessage("");
      }
      return !v;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !message.trim() || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke(
        "submit-support-request",
        {
          body: {
            subject: subject.trim(),
            message: message.trim(),
            user_name: userName,
            user_email: userEmail,
            tenant_id: tenant?.id || null,
          },
        },
      );
      if (error) throw error;
      setView("success");
      setSubject("");
      setMessage("");
    } catch (err) {
      console.error("Support request failed:", err);
    } finally {
      setSubmitting(false);
    }
  }, [subject, message, submitting, userName, userEmail, tenant?.id]);

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 24,
        right: 24,
        zIndex: 1400,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 1.5,
      }}
    >
      {/* Panel */}
      {open && (
        <Sheet
          variant="outlined"
          sx={{
            width: 320,
            borderRadius: "lg",
            boxShadow: "lg",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              px: 2.5,
              py: 2,
              background: "linear-gradient(135deg, #68BEB9 0%, #4FA8A3 100%)",
            }}
          >
            <Typography
              level="title-md"
              sx={{ color: "#fff", fontWeight: 700 }}
            >
              How can we help?
            </Typography>
          </Box>

          {/* Body */}
          <Box sx={{ p: 2 }}>
            {view === "menu" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                <MenuRow
                  emoji="📚"
                  title="Browse Help Center"
                  subtitle="Guides, how-tos, and troubleshooting"
                  onClick={() =>
                    window.open(
                      "https://bloomsuite.notion.site/bloomsuite-help",
                      "_blank",
                    )
                  }
                />
                <MenuRow
                  emoji="✉️"
                  title="Ask a Question"
                  subtitle="Get a response within 1 business day"
                  onClick={() => setView("form")}
                />
                <MenuRow
                  emoji="📅"
                  title="Book a Call"
                  subtitle="Schedule time with Jon or Jeff"
                  onClick={() =>
                    window.open("https://calendly.com/brandsinblooms", "_blank")
                  }
                />
              </Box>
            )}

            {view === "form" && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Button
                  variant="plain"
                  size="sm"
                  sx={{ alignSelf: "flex-start", px: 0, minHeight: 0 }}
                  onClick={() => setView("menu")}
                >
                  ← Back
                </Button>
                <Input
                  placeholder="Subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  size="sm"
                />
                <Textarea
                  placeholder="How can we help?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  minRows={3}
                  maxRows={6}
                  size="sm"
                />
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  Sending as {userEmail}
                </Typography>
                <Button
                  size="sm"
                  disabled={!subject.trim() || !message.trim() || submitting}
                  onClick={handleSubmit}
                  sx={{
                    backgroundColor: "#68BEB9",
                    "&:hover": { backgroundColor: "#4FA8A3" },
                  }}
                >
                  {submitting ? (
                    <CircularProgress size="sm" sx={{ color: "#fff" }} />
                  ) : (
                    "Send Message"
                  )}
                </Button>
              </Box>
            )}

            {view === "success" && (
              <Box sx={{ textAlign: "center", py: 2 }}>
                <Typography level="title-sm" sx={{ mb: 1 }}>
                  Thanks! We'll be in touch soon.
                </Typography>
                <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                  Check your email for a confirmation.
                </Typography>
                <Button
                  variant="plain"
                  size="sm"
                  sx={{ mt: 2 }}
                  onClick={() => setView("menu")}
                >
                  ← Back to Help
                </Button>
              </Box>
            )}
          </Box>

          {/* Footer */}
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
            <Typography
              level="body-xs"
              sx={{ color: "neutral.400", textAlign: "center" }}
            >
              BloomSuite Support · help@bloomsuite.app
            </Typography>
          </Box>
        </Sheet>
      )}

      {/* Floating Button */}
      <IconButton
        onClick={handleToggle}
        sx={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          backgroundColor: open ? "#4FA8A3" : "#68BEB9",
          color: "#fff",
          boxShadow: "lg",
          fontSize: "1.25rem",
          fontWeight: 700,
          "&:hover": { backgroundColor: "#4FA8A3" },
        }}
      >
        {open ? "✕" : "?"}
      </IconButton>
    </Box>
  );
}

function MenuRow({
  emoji,
  title,
  subtitle,
  onClick,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        py: 1.5,
        borderRadius: "md",
        cursor: "pointer",
        transition: "background 0.15s",
        "&:hover": { backgroundColor: "neutral.100" },
      }}
    >
      <Typography sx={{ fontSize: "1.25rem", lineHeight: 1 }}>
        {emoji}
      </Typography>
      <Box sx={{ minWidth: 0 }}>
        <Typography level="title-sm">{title}</Typography>
        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          {subtitle}
        </Typography>
      </Box>
    </Box>
  );
}
