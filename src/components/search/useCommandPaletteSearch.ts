import { useEffect, useMemo, useRef, useState } from "react";
import {
  getCachedDatabaseSearchGroups,
  getRetryAfterSeconds,
  getSearchWarningFromResponse,
  isDatabaseSearchRateLimited,
  mergeSearchGroups,
  normalizeSearchGroups,
  setCachedDatabaseSearchGroups,
  setDatabaseSearchCooldown,
  type SearchEntitiesFunctionResponse,
} from "@/components/search/databaseSearch";
import {
  buildSearchRequestConfig,
  type SearchFilterValue,
} from "@/components/search/searchFilters";
import { searchStaticRegistry } from "@/components/search/staticSearchRegistry";
import type { SearchResultGroup } from "@/components/search/types";
import { supabase } from "@/integrations/supabase/client";

const MIN_DATABASE_QUERY_LENGTH = 2;

type SearchResponseMeta = {
  degraded: boolean;
  fuzzy: boolean;
  total: number;
};

function normalizeSearchMeta(response: SearchEntitiesFunctionResponse | null | undefined) {
  const meta = response?.meta;

  if (!meta || typeof meta !== "object") {
    return {
      degraded: false,
      fuzzy: false,
      total: 0,
    } satisfies SearchResponseMeta;
  }

  const candidate = meta as Record<string, unknown>;

  return {
    degraded: Boolean(candidate.degraded),
    fuzzy: Boolean(candidate.fuzzy),
    total:
      typeof candidate.total === "number" && Number.isFinite(candidate.total)
        ? candidate.total
        : 0,
  } satisfies SearchResponseMeta;
}

export function useCommandPaletteSearch(
  staticQuery: string,
  databaseQuery: string,
  filter: SearchFilterValue,
  pathname: string,
  cacheScope = "global",
) {
  const trimmedStaticQuery = staticQuery.trim();
  const trimmedDatabaseQuery = databaseQuery.trim();
  const staticResults = useMemo(() => searchStaticRegistry(staticQuery), [staticQuery]);
  const requestConfig = useMemo(
    () => buildSearchRequestConfig(filter, pathname),
    [filter, pathname],
  );
  const requestConfigRef = useRef(requestConfig);
  const [databaseResults, setDatabaseResults] = useState<SearchResultGroup[]>([]);
  const [isDatabaseLoading, setIsDatabaseLoading] = useState(false);
  const [databaseMeta, setDatabaseMeta] = useState<SearchResponseMeta>({
    degraded: false,
    fuzzy: false,
    total: 0,
  });
  const [warning, setWarning] = useState<string | null>(null);

  requestConfigRef.current = requestConfig;

  useEffect(() => {
    const activeRequestConfig = requestConfigRef.current;
    const cacheKey = `${trimmedDatabaseQuery}|${activeRequestConfig.cacheKey}|${cacheScope}`;

    if (trimmedStaticQuery !== trimmedDatabaseQuery) {
      setDatabaseResults([]);
      setWarning(null);
      setDatabaseMeta({
        degraded: false,
        fuzzy: false,
        total: 0,
      });
      setIsDatabaseLoading(
        Boolean(trimmedStaticQuery) &&
          trimmedStaticQuery.length >= MIN_DATABASE_QUERY_LENGTH &&
          !activeRequestConfig.skipDatabase,
      );
      return;
    }

    if (!trimmedDatabaseQuery || trimmedDatabaseQuery.length < MIN_DATABASE_QUERY_LENGTH) {
      setDatabaseResults([]);
      setIsDatabaseLoading(false);
      setWarning(null);
      setDatabaseMeta({
        degraded: false,
        fuzzy: false,
        total: 0,
      });
      return;
    }

    if (activeRequestConfig.skipDatabase) {
      setDatabaseResults([]);
      setIsDatabaseLoading(false);
      setWarning(null);
      setDatabaseMeta({
        degraded: false,
        fuzzy: false,
        total: 0,
      });
      return;
    }

    const cachedGroups = getCachedDatabaseSearchGroups(cacheKey);

    setDatabaseResults(cachedGroups);
    setWarning(null);

    if (isDatabaseSearchRateLimited()) {
      setIsDatabaseLoading(false);
      setWarning("Some results may be missing.");
      return;
    }

    let isCancelled = false;

    setIsDatabaseLoading(true);

    void (async () => {
      try {
        const { data, error } = await supabase.functions.invoke<SearchEntitiesFunctionResponse>(
          "search-entities",
          {
            body: {
              query: trimmedDatabaseQuery,
              campaign_id: activeRequestConfig.campaignId,
              entity_types: activeRequestConfig.entityTypes,
              fuzzy: true,
            },
          },
        );

        if (isCancelled) {
          return;
        }

        if (error) {
          const retryAfterSeconds = getRetryAfterSeconds(error);

          if (retryAfterSeconds) {
            setDatabaseSearchCooldown(retryAfterSeconds);
          }

          setDatabaseResults(cachedGroups);
          setWarning("Some results may be missing.");
          setDatabaseMeta({
            degraded: false,
            fuzzy: false,
            total: cachedGroups.reduce((count, group) => count + group.results.length, 0),
          });
          setIsDatabaseLoading(false);
          return;
        }

        const nextGroups = normalizeSearchGroups(data?.groups);

        setCachedDatabaseSearchGroups(cacheKey, nextGroups);
        setDatabaseResults(nextGroups);
        setDatabaseMeta(normalizeSearchMeta(data));
        setWarning(getSearchWarningFromResponse(data));
        setIsDatabaseLoading(false);
      } catch (error) {
        if (isCancelled) {
          return;
        }

        console.error("[useCommandPaletteSearch] search-entities failed:", error);
        setDatabaseResults(cachedGroups);
        setWarning("Some results may be missing.");
        setDatabaseMeta({
          degraded: false,
          fuzzy: false,
          total: cachedGroups.reduce((count, group) => count + group.results.length, 0),
        });
        setIsDatabaseLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [cacheScope, trimmedDatabaseQuery, trimmedStaticQuery]);

  const results = useMemo(
    () => mergeSearchGroups(staticResults, databaseResults),
    [databaseResults, staticResults],
  );

  return {
    results,
    isLoading: false,
    isDatabaseLoading,
    databaseMeta,
    warning,
  };
}