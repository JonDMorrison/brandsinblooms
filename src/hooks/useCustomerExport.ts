import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  downloadTextFile,
  formatDateStamp,
  sanitizeFileNamePart,
} from "@/lib/crm/campaignRecipientOperations";
import {
  buildCustomerExportCsv,
  normalizeCustomerExportPage,
} from "@/lib/crm/customerExport";

const EXPORT_PAGE_SIZE = 1000;
const MAX_EXPORT_PAGES = 10_000;

export function useCustomerExport() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportedCount, setExportedCount] = React.useState(0);

  const exportAllCustomers = React.useCallback(
    async (tenantName?: string | null) => {
      setIsExporting(true);
      setExportedCount(0);

      try {
        const customers: Array<Record<string, unknown>> = [];
        let cursor: string | null = null;
        let hasMore = true;

        for (let pageNumber = 0; hasMore; pageNumber += 1) {
          if (pageNumber >= MAX_EXPORT_PAGES) {
            throw new Error(
              "The customer export exceeded its safe page limit.",
            );
          }

          const { data, error } = await supabase.rpc(
            "get_customer_export_page",
            {
              p_after_id: cursor,
              p_limit: EXPORT_PAGE_SIZE,
            },
          );
          if (error) throw error;

          const page = normalizeCustomerExportPage(data);
          customers.push(...page.items);
          setExportedCount(customers.length);

          if (
            page.hasMore &&
            (!page.nextCursor || page.nextCursor === cursor)
          ) {
            throw new Error(
              "Customer export pagination did not advance safely.",
            );
          }

          cursor = page.nextCursor;
          hasMore = page.hasMore;
        }

        const csv = buildCustomerExportCsv(customers);
        const tenantPart = sanitizeFileNamePart(tenantName || "bloomsuite");
        downloadTextFile(
          `\uFEFF${csv}`,
          `${tenantPart || "bloomsuite"}-customers-${formatDateStamp()}.csv`,
          "text/csv;charset=utf-8",
        );

        toast({
          title: "Customer export ready",
          description: `${customers.length.toLocaleString()} active customer record${customers.length === 1 ? "" : "s"} exported with consent, POS, loyalty, segment, and custom-field data.`,
        });
      } catch (error) {
        toast({
          title: "Customer export failed",
          description:
            error instanceof Error
              ? error.message
              : "The export could not be completed.",
          variant: "destructive",
        });
      } finally {
        setIsExporting(false);
      }
    },
    [toast],
  );

  return { exportAllCustomers, isExporting, exportedCount };
}
