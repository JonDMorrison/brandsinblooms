import { useEffect, useRef } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";
import { BloomConversationArea } from "@/components/bloom/BloomConversationArea";
import { useBloom } from "@/components/bloom/BloomContext";
import { BloomInputArea } from "@/components/bloom/BloomInputArea";
import type { BloomShellOutletContext } from "@/components/bloom/BloomShell";
import {
  bloomSupabase,
  toBloomProactiveInsight,
  type BloomProactiveInsightRow,
} from "@/hooks/bloom/types";
import { useTenant } from "@/hooks/useTenant";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );

function BloomPageParamHandler() {
  const { createConversation, sendMessage } = useBloom();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tenant, loading: tenantLoading } = useTenant();
  const isProcessingRef = useRef(false);

  useEffect(() => {
    const insightId = searchParams.get("insight")?.trim() ?? "";
    const queryConversationId = searchParams.get("conversationId")?.trim() ?? "";
    const continueConversationId = searchParams.get("continue")?.trim() ?? "";
    const shouldCreateNewConversation = searchParams.get("new") === "true";

    if (
      !insightId &&
      !queryConversationId &&
      !continueConversationId &&
      !shouldCreateNewConversation
    ) {
      isProcessingRef.current = false;
      return;
    }

    if (location.pathname !== "/bloom" || isProcessingRef.current) {
      return;
    }

    const remainingParams = new URLSearchParams(searchParams);
    remainingParams.delete("conversationId");
    remainingParams.delete("continue");
    remainingParams.delete("new");
    remainingParams.delete("insight");
    const remainingSearch = remainingParams.toString();

    if (insightId) {
      if (!isUuid(insightId)) {
        isProcessingRef.current = true;
        toast.error("Bloom insight unavailable", {
          description: "That Bloom insight link is invalid.",
        });
        navigate(
          {
            pathname: "/bloom",
            search: remainingSearch ? `?${remainingSearch}` : "",
          },
          { replace: true },
        );
        return;
      }

      if (tenantLoading) {
        return;
      }

      if (!tenant?.id) {
        isProcessingRef.current = true;
        toast.error("Bloom insight unavailable", {
          description:
            "Select an organization before opening Bloom insight links.",
        });
        navigate(
          {
            pathname: "/bloom",
            search: remainingSearch ? `?${remainingSearch}` : "",
          },
          { replace: true },
        );
        return;
      }

      isProcessingRef.current = true;

      void bloomSupabase
        .from("bloom_proactive_insights")
        .select(
          "id, tenant_id, insight_type, title, description, action_prompt, entity_type, entity_id, severity, dismissed_by, expires_at, created_at",
        )
        .eq("id", insightId)
        .eq("tenant_id", tenant.id)
        .maybeSingle()
        .then(async ({ data, error }) => {
          if (error) {
            throw error;
          }

          if (!data) {
            toast.error("Bloom insight unavailable", {
              description:
                "That Bloom insight no longer exists for this organization.",
            });
            navigate(
              {
                pathname: "/bloom",
                search: remainingSearch ? `?${remainingSearch}` : "",
              },
              { replace: true },
            );
            return;
          }

          const insight = toBloomProactiveInsight(
            data as BloomProactiveInsightRow,
          );
          const isExpired = Boolean(
            insight.expiresAt &&
            new Date(insight.expiresAt).getTime() <= Date.now(),
          );

          if (isExpired) {
            toast.error("Bloom insight expired", {
              description:
                "This proactive Bloom insight is no longer available.",
            });
            navigate(
              {
                pathname: "/bloom",
                search: remainingSearch ? `?${remainingSearch}` : "",
              },
              { replace: true },
            );
            return;
          }

          if (!insight.actionPrompt) {
            toast.error("Bloom insight unavailable", {
              description:
                "This proactive Bloom insight cannot start a conversation.",
            });
            navigate(
              {
                pathname: "/bloom",
                search: remainingSearch ? `?${remainingSearch}` : "",
              },
              { replace: true },
            );
            return;
          }

          await sendMessage(insight.actionPrompt);

          const currentPathname =
            typeof window !== "undefined"
              ? window.location.pathname
              : location.pathname;

          navigate(
            {
              pathname: currentPathname,
              search: remainingSearch ? `?${remainingSearch}` : "",
            },
            { replace: true },
          );
        })
        .catch((error: unknown) => {
          toast.error("Failed to open Bloom insight", {
            description:
              error instanceof Error
                ? error.message
                : "Something went wrong loading that Bloom insight.",
          });
          navigate(
            {
              pathname: "/bloom",
              search: remainingSearch ? `?${remainingSearch}` : "",
            },
            { replace: true },
          );
        });

      return;
    }

    if (queryConversationId && isUuid(queryConversationId)) {
      isProcessingRef.current = true;
      navigate(
        {
          pathname: `/bloom/${queryConversationId}`,
          search: remainingSearch ? `?${remainingSearch}` : "",
        },
        { replace: true },
      );
      return;
    }

    if (continueConversationId && isUuid(continueConversationId)) {
      isProcessingRef.current = true;
      navigate(
        {
          pathname: `/bloom/${continueConversationId}`,
          search: remainingSearch ? `?${remainingSearch}` : "",
        },
        { replace: true },
      );
      return;
    }

    if (!shouldCreateNewConversation) {
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;
    void createConversation()
      .then((conversationId) => {
        if (!remainingSearch) {
          return;
        }

        navigate(
          {
            pathname: `/bloom/${conversationId}`,
            search: `?${remainingSearch}`,
          },
          { replace: true },
        );
      })
      .finally(() => {
        isProcessingRef.current = false;
      });
  }, [
    createConversation,
    location.pathname,
    navigate,
    searchParams,
    sendMessage,
    tenant?.id,
    tenantLoading,
  ]);

  return null;
}

export default function BloomPage() {
  const { prioritizePageContext } = useOutletContext<BloomShellOutletContext>();

  return (
    <>
      <BloomPageParamHandler />
      <BloomConversationArea prioritizePageContext={prioritizePageContext} />
      <BloomInputArea />
    </>
  );
}
