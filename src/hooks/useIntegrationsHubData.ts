import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useUserRole } from "@/hooks/useUserRole";
import {
  getIntegrationSeeds,
  type IntegrationDefinition,
  type IntegrationChildStatus,
} from "@/components/integrations/integrationsHubConfig";

function withPatchedItem(
  items: IntegrationDefinition[],
  slug: string,
  patch: Partial<IntegrationDefinition>,
) {
  return items.map((item) =>
    item.slug === slug ? { ...item, ...patch } : item,
  );
}

function buildMetaChildren(
  facebookConnected: boolean,
  instagramConnected: boolean,
): IntegrationChildStatus[] {
  return [
    {
      name: "Facebook",
      status: facebookConnected ? "connected" : "available",
      description: "Facebook Pages and publishing access",
    },
    {
      name: "Instagram",
      status: instagramConnected ? "connected" : "available",
      description: "Instagram Business account access",
    },
  ];
}

type IntegrationsHubQueryData = {
  items: IntegrationDefinition[];
  connections: {
    shopifyConnection: unknown;
    squareConnection: unknown;
    cloverConnection: unknown;
    lightspeedConnection: unknown;
    mailchimpConnection: unknown;
    klaviyoConnection: unknown;
    constantContactConnection: unknown;
    facebookConnection: unknown;
    instagramConnection: unknown;
    googleAnalyticsConnection: unknown;
    managedDomain: unknown;
  };
};

type PostgrestLikeError =
  | {
      code?: string;
      message?: string;
    }
  | null
  | undefined;

function isMissingRelationError(error: PostgrestLikeError) {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();

  return (
    code === "42p01" ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

function isMissingColumnError(error: PostgrestLikeError, columnName?: string) {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "").toLowerCase();

  return (
    code === "42703" ||
    (message.includes("column") &&
      message.includes("does not exist") &&
      (!columnName || message.includes(columnName.toLowerCase())))
  );
}

async function loadShopifyConnection(tenantId: string) {
  const result = await supabase
    .from("shopify_connections")
    .select("id, status, connected_at, shop_domain, tenant_id, user_id")
    .eq("tenant_id", tenantId)
    .eq("status", "connected")
    .order("connected_at", { ascending: false })
    .limit(1);

  if (isMissingRelationError(result.error)) {
    return { data: [], error: null };
  }

  return result;
}

async function loadGoogleAnalyticsConnection(tenantId: string, userId: string) {
  const preferredResult = await supabase
    .from("google_analytics_settings")
    .select(
      "id, property_id, connection_status, last_test_at, service_account_configured, user_id, tenant_id",
    )
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (isMissingRelationError(preferredResult.error)) {
    return { data: null, error: null };
  }

  if (!isMissingColumnError(preferredResult.error, "tenant_id")) {
    return preferredResult;
  }

  return await supabase
    .from("google_analytics_settings")
    .select(
      "id, property_id, connection_status, last_test_at, service_account_configured, user_id",
    )
    .eq("user_id", userId)
    .maybeSingle();
}

async function loadMailchimpConnection(tenantId: string) {
  return await supabase
    .from("provider_connections")
    .select(
      "id, provider, provider_account_name, status, connected_at, updated_at, revoked_at, tenant_id, user_id",
    )
    .eq("tenant_id", tenantId)
    .eq("provider", "mailchimp")
    .eq("status", "connected")
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .order("connected_at", { ascending: false })
    .limit(1);
}

async function loadUserScopedMarketingConnections(
  tenantId: string,
  userId: string,
) {
  return await supabase
    .from("provider_connections")
    .select(
      "id, provider, provider_account_name, status, connected_at, updated_at, revoked_at, tenant_id, user_id",
    )
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .in("provider", ["klaviyo", "constant_contact"])
    .eq("status", "connected")
    .is("revoked_at", null)
    .order("updated_at", { ascending: false })
    .order("connected_at", { ascending: false });
}

export function useIntegrationsHubData() {
  const { user, loading: authLoading } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const { hasRole } = useUserRole();
  const queryClient = useQueryClient();

  const isHubBootstrapPending = authLoading || tenantLoading;

  const cachedQueryData = useMemo(() => {
    if (!user?.id) {
      return null;
    }

    const cachedEntries = queryClient
      .getQueriesData<IntegrationsHubQueryData>({
        queryKey: ["integrations-hub"],
      })
      .filter(([queryKey, value]) => {
        if (!value) {
          return false;
        }

        const [, cachedTenantId, cachedUserId] = queryKey as [
          string,
          string | null,
          string | null,
        ];

        if (cachedUserId !== user.id) {
          return false;
        }

        if (tenant?.id) {
          return cachedTenantId === tenant.id;
        }

        return cachedTenantId !== null;
      });

    if (tenant?.id) {
      return cachedEntries[0]?.[1] ?? null;
    }

    return cachedEntries.length === 1 ? cachedEntries[0][1] : null;
  }, [queryClient, tenant?.id, user?.id]);

  const query = useQuery({
    queryKey: ["integrations-hub", tenant?.id ?? null, user?.id ?? null],
    enabled: Boolean(user?.id) && !isHubBootstrapPending,
    staleTime: 30_000,
    queryFn: async () => {
      const [
        shopifyResult,
        squareResult,
        cloverResult,
        lightspeedResult,
        mailchimpConnectionResult,
        marketingConnectionsResult,
        socialConnectionsResult,
        googleAnalyticsResult,
        emailDomainsResult,
      ] = await Promise.all([
        tenant?.id
          ? loadShopifyConnection(tenant.id)
          : Promise.resolve({ data: [], error: null }),
        tenant?.id
          ? supabase
              .from("square_connections")
              .select(
                "id, status, connected_at, merchant_name, last_synced_at, tenant_id, user_id",
              )
              .eq("tenant_id", tenant.id)
              .eq("status", "connected")
              .order("connected_at", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: [], error: null }),
        tenant?.id
          ? supabase
              .from("clover_connections")
              .select(
                "id, status, connected_at, merchant_name, last_synced_at, tenant_id, user_id",
              )
              .eq("tenant_id", tenant.id)
              .eq("status", "connected")
              .order("connected_at", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: [], error: null }),
        tenant?.id
          ? supabase
              .from("lightspeed_connections")
              .select(
                "id, status, connected_at, retailer_name, domain_prefix, last_synced_at, tenant_id, user_id",
              )
              .eq("tenant_id", tenant.id)
              .eq("status", "connected")
              .order("connected_at", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: [], error: null }),
        tenant?.id
          ? loadMailchimpConnection(tenant.id)
          : Promise.resolve({ data: [], error: null }),
        tenant?.id && user?.id
          ? loadUserScopedMarketingConnections(tenant.id, user.id)
          : Promise.resolve({ data: [], error: null }),
        user?.id
          ? supabase
              .from("social_connections")
              .select(
                "id, platform, platform_account_name, is_active, created_at, user_id, deleted_at",
              )
              .eq("user_id", user.id)
              .in("platform", ["facebook", "instagram"])
              .eq("is_active", true)
              .is("deleted_at", null)
          : Promise.resolve({ data: [], error: null }),
        tenant?.id && user?.id
          ? loadGoogleAnalyticsConnection(tenant.id, user.id)
          : Promise.resolve({ data: null, error: null }),
        tenant?.id
          ? supabase
              .from("email_domains")
              .select(
                "id, domain, status, created_at, updated_at, entri_provider, is_entri_managed",
              )
              .eq("tenant_id", tenant.id)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      const errors = [
        shopifyResult.error,
        squareResult.error,
        cloverResult.error,
        lightspeedResult.error,
        mailchimpConnectionResult.error,
        marketingConnectionsResult.error,
        socialConnectionsResult.error,
        googleAnalyticsResult.error,
        emailDomainsResult.error,
      ].filter(Boolean);

      if (errors.length > 0) {
        throw errors[0];
      }

      const shopifyConnection = shopifyResult.data?.[0] ?? null;
      const squareConnection = squareResult.data?.[0] ?? null;
      const cloverConnection = cloverResult.data?.[0] ?? null;
      const lightspeedConnection = lightspeedResult.data?.[0] ?? null;
      const providerConnections = [
        ...(mailchimpConnectionResult.data ?? []),
        ...(marketingConnectionsResult.data ?? []),
      ];
      const socialConnections = socialConnectionsResult.data ?? [];
      const googleAnalyticsConnection = googleAnalyticsResult.data;
      const emailDomains = emailDomainsResult.data ?? [];

      let items = getIntegrationSeeds().map<IntegrationDefinition>((seed) => ({
        ...seed,
        status: seed.defaultStatus,
      }));

      if (shopifyConnection) {
        items = withPatchedItem(items, "shopify", {
          status: "connected",
          connectedSince: shopifyConnection.connected_at,
          metaLabel: shopifyConnection.shop_domain ?? "Shopify store",
          actionLabel: "Configure",
        });
      }

      if (squareConnection) {
        items = withPatchedItem(items, "square", {
          status: "connected",
          connectedSince: squareConnection.connected_at,
          metaLabel: squareConnection.merchant_name ?? "Square merchant",
          actionLabel: "Configure",
        });
      }

      if (cloverConnection) {
        items = withPatchedItem(items, "clover", {
          status: "connected",
          connectedSince: cloverConnection.connected_at,
          metaLabel: cloverConnection.merchant_name ?? "Clover merchant",
          actionLabel: "Configure",
        });
      }

      if (lightspeedConnection) {
        items = withPatchedItem(items, "lightspeed", {
          status: "connected",
          connectedSince: lightspeedConnection.connected_at,
          metaLabel: lightspeedConnection.domain_prefix
            ? `${lightspeedConnection.domain_prefix}.retail.lightspeed.app`
            : (lightspeedConnection.retailer_name ?? "Lightspeed retailer"),
          actionLabel: "Configure",
          targetPath: "/integrations/lightspeed/guide",
        });
      }

      const providerByName = new Map();

      for (const connection of providerConnections) {
        if (!providerByName.has(connection.provider)) {
          providerByName.set(connection.provider, connection);
        }
      }

      const mailchimpConnection = providerByName.get("mailchimp");
      if (mailchimpConnection) {
        items = withPatchedItem(items, "mailchimp", {
          status: "connected",
          connectedSince: mailchimpConnection.connected_at,
          metaLabel:
            mailchimpConnection.provider_account_name ?? "Mailchimp account",
          actionLabel: "Configure",
        });
      }

      const klaviyoConnection = providerByName.get("klaviyo");
      if (klaviyoConnection) {
        items = withPatchedItem(items, "klaviyo", {
          status: "connected",
          connectedSince: klaviyoConnection.connected_at,
          metaLabel:
            klaviyoConnection.provider_account_name ?? "Klaviyo account",
          actionLabel: "Configure",
        });
      }

      const constantContactConnection = providerByName.get("constant_contact");
      if (constantContactConnection) {
        items = withPatchedItem(items, "constant-contact", {
          status: "connected",
          connectedSince: constantContactConnection.connected_at,
          metaLabel:
            constantContactConnection.provider_account_name ??
            "Constant Contact account",
          actionLabel: "Configure",
        });
      }

      const facebookConnection = socialConnections.find(
        (connection) =>
          connection.platform === "facebook" && connection.is_active,
      );
      const instagramConnection = socialConnections.find(
        (connection) =>
          connection.platform === "instagram" && connection.is_active,
      );
      const isMetaConnected = Boolean(
        facebookConnection || instagramConnection,
      );

      items = withPatchedItem(items, "meta", {
        status: isMetaConnected ? "connected" : "available",
        connectedSince:
          facebookConnection?.created_at ??
          instagramConnection?.created_at ??
          null,
        metaLabel:
          facebookConnection?.platform_account_name ??
          instagramConnection?.platform_account_name ??
          "Managed in Meta social connections",
        actionLabel: isMetaConnected ? "Configure" : "Connect",
        children: buildMetaChildren(
          Boolean(facebookConnection),
          Boolean(instagramConnection),
        ),
      });

      if (googleAnalyticsConnection?.connection_status === "connected") {
        items = withPatchedItem(items, "google-analytics", {
          status: "connected",
          connectedSince: googleAnalyticsConnection.last_test_at,
          metaLabel: `Property ${googleAnalyticsConnection.property_id}`,
          actionLabel: "Configure",
        });
      }

      const managedDomain = emailDomains.find((domain) =>
        ["active", "warming_up"].includes(domain.status),
      );
      const latestDomain = managedDomain ?? emailDomains[0] ?? null;
      if (latestDomain) {
        items = withPatchedItem(items, "email-infrastructure", {
          status: managedDomain ? "connected" : "available",
          connectedSince: managedDomain?.created_at ?? null,
          metaLabel: latestDomain.domain,
          actionLabel: "Manage settings",
        });
      }

      return {
        items,
        connections: {
          shopifyConnection,
          squareConnection,
          cloverConnection,
          lightspeedConnection,
          mailchimpConnection,
          klaviyoConnection,
          constantContactConnection,
          facebookConnection,
          instagramConnection,
          googleAnalyticsConnection,
          managedDomain,
        },
      };
    },
  });

  const fallbackItems = useMemo(
    () =>
      getIntegrationSeeds().map((seed) => ({
        ...seed,
        status: seed.defaultStatus,
      })),
    [],
  );

  const items =
    query.data?.items ??
    cachedQueryData?.items ??
    fallbackItems;

  const itemMap = useMemo(
    () => new Map(items.map((item) => [item.slug, item])),
    [items],
  );

  const hasResolvedData = Boolean(query.data ?? cachedQueryData);
  const isLoading =
    !hasResolvedData &&
    (authLoading || tenantLoading || (Boolean(user?.id) && query.isLoading));
  const isRefreshing = hasResolvedData && query.isFetching;
  const statusUnavailable = Boolean(query.error) && !hasResolvedData;

  return {
    items,
    itemMap,
    connections: query.data?.connections ?? cachedQueryData?.connections,
    tenant,
    user,
    canUseActions: hasRole("member"),
    isLoading,
    isFetching: query.isFetching,
    isRefreshing,
    statusUnavailable,
    error: query.error,
    refetch: query.refetch,
  };
}
