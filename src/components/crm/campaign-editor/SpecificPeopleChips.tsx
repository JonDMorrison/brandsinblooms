import Chip from "@mui/joy/Chip";
import ChipDelete from "@mui/joy/ChipDelete";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";

export interface SpecificPerson {
  id: string;
  name: string;
  email: string;
  /** Plain-English reason when this person cannot receive email; null when they can. */
  cannotReceiveReason: string | null;
}

/** WCAG 2.5.5 target size for the remove button. */
const REMOVE_TARGET_PX = 44;

/**
 * The people added one by one to a campaign, as chips. Each chip's remove
 * button is a 44x44 target named "Remove <name>".
 */
export function SpecificPeopleChips({
  people,
  loading = false,
  disabled = false,
  onRemove,
}: {
  people: SpecificPerson[];
  loading?: boolean;
  disabled?: boolean;
  onRemove: (customerId: string) => void;
}) {
  if (loading) {
    return (
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Skeleton variant="rectangular" width={176} height={REMOVE_TARGET_PX} />
        <Skeleton variant="rectangular" width={188} height={REMOVE_TARGET_PX} />
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={1}
      useFlexGap
      flexWrap="wrap"
      data-testid="specific-people-chips"
    >
      {people.map((person) => (
        <Chip
          key={person.id}
          size="lg"
          variant="soft"
          color={person.cannotReceiveReason ? "warning" : "neutral"}
          data-testid={`specific-person-chip-${person.id}`}
          endDecorator={
            disabled ? undefined : (
              <ChipDelete
                aria-label={`Remove ${person.name}`}
                onDelete={() => onRemove(person.id)}
                sx={{
                  width: REMOVE_TARGET_PX,
                  height: REMOVE_TARGET_PX,
                  minWidth: REMOVE_TARGET_PX,
                  minHeight: REMOVE_TARGET_PX,
                  mr: -1,
                }}
              />
            )
          }
          sx={{ maxWidth: "100%", minHeight: REMOVE_TARGET_PX }}
        >
          <Stack spacing={0} sx={{ minWidth: 0, py: 0.25 }}>
            <Typography level="body-sm" fontWeight="md" noWrap>
              {person.email ? `${person.name} · ${person.email}` : person.name}
            </Typography>
            {person.cannotReceiveReason ? (
              <Typography level="body-xs" sx={{ color: "warning.700" }} noWrap>
                {person.cannotReceiveReason}
              </Typography>
            ) : null}
          </Stack>
        </Chip>
      ))}
    </Stack>
  );
}
