import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Leaf } from "lucide-react";
import { JoyCard, JoyCardContent, JoyCardHeader } from "@/components/joy/JoyCard";
import { JoyChip } from "@/components/joy/JoyChip";
import type { CustomerData } from "@/hooks/useCustomerDashboard";
import { getCustomerProfileAttributes } from "@/lib/crm/customerProfileAttributes";

interface CustomerProfileAttributesCardProps {
  customer: CustomerData;
}

const AttributeChips = ({ values }: { values: string[] }) => (
  <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
    {values.map((value) => (
      <JoyChip key={value} color="success" variant="soft" size="sm">
        {value}
      </JoyChip>
    ))}
  </Stack>
);

export function CustomerProfileAttributesCard({
  customer,
}: CustomerProfileAttributesCardProps) {
  const profile = getCustomerProfileAttributes(customer);
  const hasAttributes =
    profile.interests.length > 0 ||
    Boolean(profile.experience) ||
    profile.tags.length > 0 ||
    profile.purchaseTags.length > 0 ||
    profile.customFields.length > 0;

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Interests & profile"
        description="Customer-selected preferences, observed purchase interests, tags, and imported fields."
        startDecorator={<Leaf size={18} />}
      />
      <JoyCardContent>
        {!hasAttributes ? (
          <Typography level="body-sm" color="neutral">
            No interests, experience, tags, or custom profile fields have been recorded yet.
          </Typography>
        ) : (
          <Stack spacing={1.5} divider={<Divider />}>
            {profile.experience ? (
              <Stack spacing={0.5}>
                <Typography level="body-xs" color="neutral">Gardening experience</Typography>
                <Typography level="body-sm" fontWeight="lg">{profile.experience}</Typography>
              </Stack>
            ) : null}
            {profile.interests.length ? (
              <Stack spacing={0.75}>
                <Typography level="body-xs" color="neutral">Customer-selected interests</Typography>
                <AttributeChips values={profile.interests} />
              </Stack>
            ) : null}
            {profile.purchaseTags.length ? (
              <Stack spacing={0.75}>
                <Typography level="body-xs" color="neutral">Purchase interests</Typography>
                <AttributeChips values={profile.purchaseTags} />
              </Stack>
            ) : null}
            {profile.tags.length ? (
              <Stack spacing={0.75}>
                <Typography level="body-xs" color="neutral">Tags</Typography>
                <AttributeChips values={profile.tags} />
              </Stack>
            ) : null}
            {profile.customFields.length ? (
              <Stack spacing={1}>
                <Typography level="body-xs" color="neutral">Imported fields</Typography>
                {profile.customFields.map((field) => (
                  <Stack key={field.key} direction="row" spacing={1} justifyContent="space-between">
                    <Typography level="body-sm" color="neutral">{field.label}</Typography>
                    <Typography level="body-sm" fontWeight="lg" textAlign="right">{field.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            ) : null}
          </Stack>
        )}
      </JoyCardContent>
    </JoyCard>
  );
}
