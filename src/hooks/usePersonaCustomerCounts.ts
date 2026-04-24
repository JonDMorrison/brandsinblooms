import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { useAllPersonas } from "@/hooks/useAllPersonas";
import { supabase } from "@/integrations/supabase/client";
import {
  buildPersonaNameIndex,
  getCustomerPersonaMetrics,
  resolveCustomerPersonaIds,
  type PersonaCustomerLike,
} from "@/lib/personaUtils";

interface PersonaCounts {
  [personaId: string]: number;
}

export interface PersonaRollup {
  customerCount: number;
  customerIds: string[];
  averageEngagement: number;
  averageValue: number;
  totalValue: number;
  topChannel: string | null;
  channelDistribution: Array<{ label: string; count: number }>;
}

export interface PersonaCoverageSummary {
  totalCustomers: number;
  assignedCustomers: number;
  unassignedCustomers: number;
  coverageRate: number;
  totalCustomerValue: number;
}

export const usePersonaCustomerCounts = () => {
  const { tenant } = useTenant();
  const { personas, loading: personasLoading } = useAllPersonas();

  const customerSourceQuery = useQuery({
    queryKey: ["persona-customer-counts-source", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      if (!tenant?.id) {
        return [] as PersonaCustomerLike[];
      }

      const { data, error } = await supabase
        .from("crm_customers")
        .select(
          `
          id,
          email,
          first_name,
          last_name,
          persona,
          persona_id,
          total_spent,
          lifetime_value,
          preferred_channel,
          email_engagement_score,
          total_emails_opened,
          total_emails_clicked,
          total_emails_sent,
          created_at,
          last_purchase_date,
          customer_personas(
            persona_id,
            predefined_persona_id
          )
        `,
        )
        .eq("tenant_id", tenant.id)
        .is("deleted_at", null);

      if (error) {
        throw error;
      }

      return (data ?? []) as PersonaCustomerLike[];
    },
  });

  const personaNameIndex = useMemo(
    () => buildPersonaNameIndex(personas),
    [personas],
  );

  const derived = useMemo(() => {
    const sourceCustomers = customerSourceQuery.data ?? [];
    const counts: PersonaCounts = {};
    const assignedCustomers = new Set<string>();
    const rollupMap = new Map<
      string,
      {
        customerIds: Set<string>;
        engagementTotal: number;
        valueTotal: number;
        channelCounts: Map<string, number>;
      }
    >();

    personas.forEach((persona) => {
      counts[persona.id] = 0;
      rollupMap.set(persona.id, {
        customerIds: new Set<string>(),
        engagementTotal: 0,
        valueTotal: 0,
        channelCounts: new Map<string, number>(),
      });
    });

    let totalCustomerValue = 0;

    sourceCustomers.forEach((customer) => {
      const personaIds = resolveCustomerPersonaIds(customer, personaNameIndex);
      const metrics = getCustomerPersonaMetrics(customer);

      totalCustomerValue += metrics.value;

      if (personaIds.length === 0) {
        return;
      }

      assignedCustomers.add(customer.id);

      personaIds.forEach((personaId) => {
        const current = rollupMap.get(personaId) ?? {
          customerIds: new Set<string>(),
          engagementTotal: 0,
          valueTotal: 0,
          channelCounts: new Map<string, number>(),
        };

        current.customerIds.add(customer.id);
        current.engagementTotal += metrics.engagementScore;
        current.valueTotal += metrics.value;

        if (metrics.preferredChannel) {
          current.channelCounts.set(
            metrics.preferredChannel,
            (current.channelCounts.get(metrics.preferredChannel) ?? 0) + 1,
          );
        }

        rollupMap.set(personaId, current);
        counts[personaId] = current.customerIds.size;
      });
    });

    const statsByPersona = personas.reduce<Record<string, PersonaRollup>>(
      (result, persona) => {
        const rollup = rollupMap.get(persona.id);
        const customerCount = rollup?.customerIds.size ?? 0;
        const channelDistribution = Array.from(
          rollup?.channelCounts.entries() ?? [],
        )
          .map(([label, count]) => ({ label, count }))
          .sort((left, right) => right.count - left.count);

        result[persona.id] = {
          customerCount,
          customerIds: Array.from(rollup?.customerIds ?? []),
          averageEngagement:
            customerCount > 0
              ? Math.round((rollup?.engagementTotal ?? 0) / customerCount)
              : 0,
          averageValue:
            customerCount > 0
              ? Math.round((rollup?.valueTotal ?? 0) / customerCount)
              : 0,
          totalValue: Math.round(rollup?.valueTotal ?? 0),
          topChannel: channelDistribution[0]?.label ?? null,
          channelDistribution,
        };
        return result;
      },
      {},
    );

    const summary: PersonaCoverageSummary = {
      totalCustomers: sourceCustomers.length,
      assignedCustomers: assignedCustomers.size,
      unassignedCustomers: Math.max(
        sourceCustomers.length - assignedCustomers.size,
        0,
      ),
      coverageRate:
        sourceCustomers.length > 0
          ? Math.round((assignedCustomers.size / sourceCustomers.length) * 100)
          : 0,
      totalCustomerValue: Math.round(totalCustomerValue),
    };

    return {
      counts,
      statsByPersona,
      summary,
    };
  }, [customerSourceQuery.data, personaNameIndex, personas]);

  const refreshCounts = useCallback(async () => {
    await customerSourceQuery.refetch();
  }, [customerSourceQuery]);

  return {
    counts: derived.counts,
    statsByPersona: derived.statsByPersona,
    summary: derived.summary,
    loading: customerSourceQuery.isLoading || personasLoading,
    refreshCounts,
  };
};
