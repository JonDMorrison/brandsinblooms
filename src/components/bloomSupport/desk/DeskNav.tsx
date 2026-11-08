import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import Tabs from "@mui/joy/Tabs";
import TabList from "@mui/joy/TabList";
import Tab, { tabClasses } from "@mui/joy/Tab";
import Dropdown from "@mui/joy/Dropdown";
import MenuButton from "@mui/joy/MenuButton";
import Menu from "@mui/joy/Menu";
import MenuItem from "@mui/joy/MenuItem";
import { BarChart3, ChevronDown, Inbox, LayoutGrid, Scale, Sun, Users } from "lucide-react";
import type { ReactNode } from "react";
import { MAIN_VIEWS, MORE_VIEWS, type DeskView } from "./deskModel";

const MAIN_ICON: Record<string, ReactNode> = {
  today: <Sun size={18} aria-hidden />,
  queue: <Inbox size={18} aria-hidden />,
  escalations: <Scale size={18} aria-hidden />,
  clients: <Users size={18} aria-hidden />,
  reports: <BarChart3 size={18} aria-hidden />,
};

export function DeskNav({ view, badges, onChange }: {
  view: DeskView;
  badges: Partial<Record<DeskView, number>>;
  onChange: (view: DeskView) => void;
}) {
  const inMore = MORE_VIEWS.find((m) => m.value === view);
  return (
    <Stack
      component="nav"
      aria-label="Support desk sections"
      direction="row"
      spacing={1}
      alignItems="stretch"
      sx={{ display: { xs: "grid", sm: "flex" }, gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1 }}
    >
      <Tabs
        value={inMore ? null : view}
        onChange={(_, v) => v && onChange(v as DeskView)}
        sx={{ bgcolor: "transparent", minWidth: 0, display: "contents" }}
      >
        <TabList
          disableUnderline
          sx={{
            display: { xs: "contents", sm: "flex" },
            gap: 1,
            p: 0,
            bgcolor: "transparent",
            [`& .${tabClasses.root}`]: {
              minHeight: 48,
              px: 2,
              gap: 1,
              borderRadius: "xl",
              fontSize: "1rem",
              fontWeight: 600,
              color: "text.secondary",
              border: "1px solid transparent",
              justifyContent: "center",
              whiteSpace: "nowrap",
              transition: "background-color 120ms ease, color 120ms ease, border-color 120ms ease",
              "&:hover": { bgcolor: "neutral.100", color: "text.primary" },
              "&::after": { display: "none" },
            },
            [`& .${tabClasses.selected}`]: {
              bgcolor: "background.surface",
              color: "primary.800",
              borderColor: "primary.200",
              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(48, 102, 97, 0.10)",
              "&:hover": { bgcolor: "background.surface" },
            },
          }}
        >
          {MAIN_VIEWS.map((m) => (
            <Tab key={m.value} value={m.value} disableIndicator>
              {MAIN_ICON[m.value]}
              <span>{m.label}</span>
              {badges[m.value] ? <CountBubble n={badges[m.value]!} /> : null}
            </Tab>
          ))}
        </TabList>
      </Tabs>
      <Dropdown>
        <MenuButton
          variant={inMore ? "outlined" : "plain"}
          color={inMore ? "primary" : "neutral"}
          startDecorator={<LayoutGrid size={18} aria-hidden />}
          endDecorator={<ChevronDown size={16} aria-hidden />}
          sx={{
            minHeight: 48, borderRadius: "xl", fontSize: "1rem", fontWeight: 600, whiteSpace: "nowrap",
            bgcolor: inMore ? "background.surface" : "transparent",
            color: inMore ? "primary.800" : "text.secondary",
          }}
        >
          {inMore ? <Box component="span" sx={{ maxWidth: { xs: 96, sm: "none" }, overflow: "hidden", textOverflow: "ellipsis" }}>{inMore.label}</Box> : "More"}
        </MenuButton>
        <Menu placement="bottom-end" sx={{ minWidth: 300, p: 1, borderRadius: "xl", boxShadow: "lg" }}>
          {MORE_VIEWS.map((m) => (
            <MenuItem key={m.value} selected={view === m.value} onClick={() => onChange(m.value)} sx={{ borderRadius: "lg", py: 1.25, minHeight: 56 }}>
              <Stack>
                <Typography level="title-sm" sx={{ fontSize: "1rem" }}>{m.label}</Typography>
                <Typography level="body-xs" textColor="text.tertiary" sx={{ fontSize: "0.875rem" }}>{m.short}</Typography>
              </Stack>
            </MenuItem>
          ))}
        </Menu>
      </Dropdown>
    </Stack>
  );
}

function CountBubble({ n }: { n: number }) {
  return (
    <Box
      component="span"
      aria-label={`${n} waiting`}
      sx={{ minWidth: 24, height: 24, px: 0.75, borderRadius: 12, bgcolor: "warning.100", color: "warning.800", fontSize: "0.8125rem", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      {n}
    </Box>
  );
}
