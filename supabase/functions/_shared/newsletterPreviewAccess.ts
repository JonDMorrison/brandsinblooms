/** Authorization must run before loading recipient/profile data with a service client. */
export class NewsletterPreviewAccessError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
  }
}
interface FilterQuery {
  eq(column: string, value: string): FilterQuery;
  maybeSingle(): PromiseLike<{ data: { id?: string } | null; error: unknown }>;
}
export interface NewsletterPreviewAccessClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
  from(table: string): { select(columns: string): FilterQuery };
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function assertNewsletterPreviewAccess(
  client: NewsletterPreviewAccessClient,
  input: {
    tenantId: string;
    campaignId?: string;
    customerId?: string;
    trustedService: boolean;
  },
): Promise<void> {
  if (
    input.tenantId === "preview-tenant" &&
    !input.campaignId &&
    !input.customerId
  )
    return;
  if (
    !UUID.test(input.tenantId) ||
    (input.campaignId && !UUID.test(input.campaignId)) ||
    (input.customerId && !UUID.test(input.customerId))
  ) {
    throw new NewsletterPreviewAccessError(
      "Select a valid account, campaign and preview contact.",
      400,
    );
  }
  if (!input.trustedService) {
    const permission = await client.rpc("has_tenant_permission", {
      p_tenant_id: input.tenantId,
      p_permission: "campaign.read",
      p_location_id: null,
    });
    if (permission.error || permission.data !== true)
      throw new NewsletterPreviewAccessError(
        "You do not have access to preview newsletters for this account.",
      );
  }
  // The JWT-scoped client enforces location RLS as well as explicit tenant matching.
  if (input.campaignId) {
    const campaign = await client
      .from("crm_campaigns")
      .select("id")
      .eq("id", input.campaignId)
      .eq("tenant_id", input.tenantId)
      .maybeSingle();
    if (campaign.error || !campaign.data?.id)
      throw new NewsletterPreviewAccessError(
        "The campaign is not available in this account.",
      );
  }
}
