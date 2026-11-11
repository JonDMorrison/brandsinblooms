// This report explanation is specific to West Coast Gardens' IdealPOS imports.
export function showIdealReportNotice(tenantId: string | undefined, loading: boolean, isMasterAdmin: boolean, activeTenantId: string | null, hydrated: boolean): boolean {
  return !loading && tenantId === "c190325a-5da0-49f6-b374-187464762021" &&
    (!isMasterAdmin || (hydrated && activeTenantId === tenantId));
}
