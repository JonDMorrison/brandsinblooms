import * as React from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Plus, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyCard, JoyCardContent, JoyCardHeader } from "@/components/joy/JoyCard";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { useCRMTags } from "@/hooks/useCRMTags";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";

interface CustomerTagsCardProps {
  customerId: string;
  canManage: boolean;
}

/** Tag membership belongs to the contact; tag definitions belong to the active tenant. */
export function CustomerTagsCard({ customerId, canManage }: CustomerTagsCardProps) {
  const { tenant } = useTenant();
  const { tags, loading: tagsLoading, fetchTags } = useCRMTags();
  const queryClient = useQueryClient();
  const [selectedTagId, setSelectedTagId] = React.useState("");
  const [newTagName, setNewTagName] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  const queryKey = ["customer-tags", tenant?.id, customerId] as const;
  const membershipQuery = useQuery({
    queryKey,
    enabled: Boolean(tenant?.id && customerId),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("customer_tags")
        .select("tag_id")
        .eq("contact_id", customerId);
      if (error) throw error;
      return (data ?? []).map((row) => row.tag_id);
    },
  });

  const assignedIds = new Set(membershipQuery.data ?? []);
  const availableToAdd = tags.filter((tag) => !assignedIds.has(tag.id));
  const assigned = tags.filter((tag) => assignedIds.has(tag.id));

  const assignTag = async (tagId: string) => {
    // Only current-tenant definitions may be assigned to this contact.
    if (!canManage || !tenant?.id || !tags.some((tag) => tag.id === tagId)) return;
    const { error } = await supabase
      .from("customer_tags")
      .upsert(
        { contact_id: customerId, tag_id: tagId },
        { onConflict: "contact_id,tag_id", ignoreDuplicates: true },
      );
    if (error) throw error;
    await queryClient.invalidateQueries({ queryKey: ["customer-tags", tenant.id, customerId] });
    await queryClient.invalidateQueries({ queryKey: ["customers", tenant.id] });
  };

  const addSelected = async () => {
    if (!selectedTagId || isSaving) return;
    setIsSaving(true);
    try {
      await assignTag(selectedTagId);
      setSelectedTagId("");
      toast.success("Tag added");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add tag");
    } finally {
      setIsSaving(false);
    }
  };

  const createAndAssign = async () => {
    const name = newTagName.trim();
    if (!name || isSaving || !canManage || !tenant?.id) return;
    setIsSaving(true);
    try {
      const existing = tags.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
      let tagId = existing?.id;
      if (!tagId) {
        const { data, error } = await supabase
          .from("crm_tags")
          .insert({ tenant_id: tenant.id, name })
          .select("id")
          .single();
        if (error) throw error;
        tagId = data.id;
        await fetchTags();
      }
      await assignTag(tagId);
      setNewTagName("");
      toast.success("Tag saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create tag");
    } finally {
      setIsSaving(false);
    }
  };

  const removeTag = async (tagId: string) => {
    if (!canManage || !tenant?.id || isSaving || !assignedIds.has(tagId)) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("customer_tags")
        .delete()
        .eq("contact_id", customerId)
        .eq("tag_id", tagId);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["customer-tags", tenant.id, customerId] });
      await queryClient.invalidateQueries({ queryKey: ["customers", tenant.id] });
      toast.success("Tag removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove tag");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <JoyCard variant="outlined">
      <JoyCardHeader
        title="Tags"
        description="Organize this customer for targeting and reporting."
      />
      <JoyCardContent>
        {membershipQuery.isLoading || tagsLoading ? (
          <CircularProgress size="sm" />
        ) : membershipQuery.isError ? (
          <Typography level="body-sm" color="danger">Could not load customer tags.</Typography>
        ) : (
          <Stack spacing={1.5}>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
              {assigned.length ? assigned.map((tag) => (
                <Box key={tag.id} sx={{ display: "inline-flex", alignItems: "center" }}>
                  <Chip size="sm" variant="soft" color="neutral">{tag.name}</Chip>
                  {canManage ? (
                    <IconButton
                      size="sm"
                      variant="plain"
                      color="neutral"
                      aria-label={`Remove ${tag.name} tag`}
                      disabled={isSaving}
                      onClick={() => void removeTag(tag.id)}
                    >
                      <X size={14} />
                    </IconButton>
                  ) : null}
                </Box>
              )) : <Typography level="body-sm" sx={{ color: "neutral.500" }}>No tags assigned.</Typography>}
            </Stack>
            {canManage ? (
              <>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <JoySelect
                    value={selectedTagId}
                    onValueChange={setSelectedTagId}
                    placeholder="Choose an existing tag"
                    options={availableToAdd.map((tag) => ({ value: tag.id, label: tag.name }))}
                    disabled={isSaving || availableToAdd.length === 0}
                  />
                  <JoyButton size="sm" variant="outlined" color="neutral" disabled={!selectedTagId || isSaving} onClick={() => void addSelected()}>
                    Add tag
                  </JoyButton>
                </Stack>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <JoyInput
                    value={newTagName}
                    onChange={(event) => setNewTagName(event.target.value)}
                    placeholder="New tag name"
                    disabled={isSaving}
                    sx={{ flex: 1 }}
                  />
                  <JoyButton size="sm" variant="outlined" color="neutral" startDecorator={<Plus size={14} />} disabled={!newTagName.trim() || isSaving} onClick={() => void createAndAssign()}>
                    Create and add
                  </JoyButton>
                </Stack>
              </>
            ) : null}
          </Stack>
        )}
      </JoyCardContent>
    </JoyCard>
  );
}
