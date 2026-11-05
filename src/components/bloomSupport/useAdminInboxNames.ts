import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { bloomSupport, type Whoami } from "@/lib/bloomSupport/api";
import { adminInboxNames, type AdminInboxNames } from "@/lib/bloomSupport/adminLabels";

/**
 * Names (or emails) of the people holding the two admin alert inboxes, read from
 * the owners setting and the staff list. Only fetched for staff who may read
 * them; everyone else gets neutral "Admin" labels.
 */
export function useAdminInboxNames(me: Pick<Whoami, "permissions"> | null | undefined): AdminInboxNames {
  const canSettings = !!me?.permissions.includes("escalations.view");
  const canStaff = !!me?.permissions.includes("tickets.read_all");
  const settings = useQuery({ queryKey: ["bloom-support", "settings"], queryFn: () => bloomSupport.settings(), enabled: canSettings, retry: false });
  const staff = useQuery({ queryKey: ["bloom-support", "staff"], queryFn: () => bloomSupport.staff(), enabled: canStaff, retry: false });
  return useMemo(() => adminInboxNames(settings.data?.owners, staff.data), [settings.data, staff.data]);
}
