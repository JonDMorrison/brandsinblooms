import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Link from "@mui/joy/Link";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ArrowUpRight, BookOpen, Mail, Plus } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import {
  buildIntegrationRequestHref,
  type CatalogEntry,
  type ComingSoonCatalogEntry,
} from "./connectionsModel";
import { IntegrationLogo } from "./ConnectionsPrimitives";
import { interactiveSurfaceSx, softPressSx } from "./connectionsStyles";

const gridSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "minmax(0, 1fr)",
    sm: "repeat(2, minmax(0, 1fr))",
    xl: "repeat(3, minmax(0, 1fr))",
  },
  gap: 1.5,
} as const;

const CardHeader = ({ entry, muted = false }: { entry: CatalogEntry; muted?: boolean }) => (
  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
    <IntegrationLogo logo={entry.logo} muted={muted} name={entry.name} />
    <Stack spacing={0} sx={{ minWidth: 0 }}>
      <Typography level="title-sm" sx={{ color: muted ? "text.secondary" : "text.primary" }}>
        {entry.name}
      </Typography>
      <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
        {entry.category}
      </Typography>
    </Stack>
  </Stack>
);

interface AvailableCardProps {
  entry: Exclude<CatalogEntry, ComingSoonCatalogEntry>;
  onConnect: (platformId: string) => void;
  onOpenGuide: (platformId: string) => void;
}

const AvailableCard = ({ entry, onConnect, onOpenGuide }: AvailableCardProps) => (
  <Sheet component="article" variant="outlined" sx={{ ...interactiveSurfaceSx, p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
    <CardHeader entry={entry} />
    <Typography level="body-sm" sx={{ color: "text.secondary", flex: 1 }}>
      {entry.valueProp}
    </Typography>
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
      {entry.kind === "hub" ? (
        <>
          <Button component={RouterLink} endDecorator={<ArrowUpRight size={15} />} size="sm" sx={softPressSx} to={entry.connectPath}>
            Connect
          </Button>
          <Button
            color="neutral"
            component={RouterLink}
            size="sm"
            startDecorator={<BookOpen size={15} />}
            sx={softPressSx}
            to={entry.guidePath}
            variant="plain"
          >
            Setup guide
          </Button>
        </>
      ) : (
        <>
          <Button onClick={() => onConnect(entry.id)} size="sm" startDecorator={<Plus size={15} />} sx={softPressSx}>
            Connect
          </Button>
          <Button
            color="neutral"
            onClick={() => onOpenGuide(entry.id)}
            size="sm"
            startDecorator={<BookOpen size={15} />}
            sx={softPressSx}
            variant="plain"
          >
            Setup guide
          </Button>
        </>
      )}
    </Stack>
  </Sheet>
);

const ComingSoonCard = ({ entry }: { entry: ComingSoonCatalogEntry }) => (
  <Sheet
    component="article"
    variant="outlined"
    sx={{
      borderRadius: "20px",
      borderStyle: "dashed",
      borderColor: "neutral.outlinedBorder",
      bgcolor: "background.level1",
      p: 2,
      display: "flex",
      flexDirection: "column",
      gap: 1.5,
    }}
  >
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
      <CardHeader entry={entry} muted />
      <Chip color="neutral" size="sm" variant="outlined">
        Coming soon
      </Chip>
    </Stack>
    <Typography level="body-sm" sx={{ color: "text.tertiary", flex: 1 }}>
      {entry.valueProp}
    </Typography>
    <Box>
      <Button
        color="neutral"
        component="a"
        href={buildIntegrationRequestHref(entry.name)}
        size="sm"
        startDecorator={<Mail size={15} />}
        sx={softPressSx}
        variant="outlined"
      >
        Notify me
      </Button>
    </Box>
  </Sheet>
);

interface IntegrationCatalogProps {
  available: Exclude<CatalogEntry, ComingSoonCatalogEntry>[];
  comingSoon: ComingSoonCatalogEntry[];
  onConnect: (platformId: string) => void;
  onOpenGuide: (platformId: string) => void;
}

export const IntegrationCatalog = ({ available, comingSoon, onConnect, onOpenGuide }: IntegrationCatalogProps) => (
  <Stack spacing={2.5}>
    {available.length > 0 ? (
      <Box sx={gridSx}>
        {available.map((entry) => (
          <AvailableCard key={entry.id} entry={entry} onConnect={onConnect} onOpenGuide={onOpenGuide} />
        ))}
      </Box>
    ) : null}

    {comingSoon.length > 0 ? (
      <Stack spacing={1.25}>
        <Typography level="title-sm" sx={{ color: "text.secondary" }}>
          On the roadmap
        </Typography>
        <Box sx={gridSx}>
          {comingSoon.map((entry) => (
            <ComingSoonCard key={entry.id} entry={entry} />
          ))}
        </Box>
      </Stack>
    ) : null}

    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={{ xs: 1, sm: 2 }}
      justifyContent="space-between"
      alignItems={{ xs: "flex-start", sm: "center" }}
      sx={{ pt: 0.5 }}
    >
      <Typography level="body-sm" sx={{ color: "text.secondary" }}>
        Don't see your tool?{" "}
        <Link href={buildIntegrationRequestHref()} level="body-sm" underline="always">
          Request an integration
        </Link>
      </Typography>
      <Link component={RouterLink} endDecorator={<ArrowUpRight size={14} />} level="body-sm" to="/integrations">
        Browse the Integration Hub
      </Link>
    </Stack>
  </Stack>
);
