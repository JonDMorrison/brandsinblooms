import * as React from "react";
import type { QueryClient } from "@tanstack/react-query";
import type {
  AskBloomNavigationPrompt,
  ResourceFocus,
} from "@/types/askBloom";
import {
  getAskBloomResourceRegistrySnapshot,
  getResourceFocusFromCache,
  subscribeToAskBloomResourceRegistry,
} from "@/utils/askBloomResourceRegistry";
import { parseResourceFromPath } from "@/utils/askBloomRouteContext";

interface UseAskBloomNavigationOptions {
  pathname: string;
  isOpen: boolean;
  currentResourceFocus: ResourceFocus | null;
  navigationPrompt: AskBloomNavigationPrompt | null;
  queryClient: QueryClient;
  onNavigationPromptChange: (prompt: AskBloomNavigationPrompt | null) => void;
}

export function useAskBloomNavigation({
  pathname,
  isOpen,
  currentResourceFocus,
  navigationPrompt,
  queryClient,
  onNavigationPromptChange,
}: UseAskBloomNavigationOptions) {
  const previousPathnameRef = React.useRef(pathname);
  const attemptedPromptPathRef = React.useRef<string | null>(null);
  const activePromptPathRef = React.useRef<string | null>(null);
  const registryVersion = React.useSyncExternalStore(
    subscribeToAskBloomResourceRegistry,
    getAskBloomResourceRegistrySnapshot,
    getAskBloomResourceRegistrySnapshot,
  );

  React.useEffect(() => {
    if (navigationPrompt) {
      activePromptPathRef.current = pathname;
      return;
    }

    if (activePromptPathRef.current === pathname) {
      attemptedPromptPathRef.current = pathname;
    }
    activePromptPathRef.current = null;
  }, [navigationPrompt, pathname]);

  React.useEffect(() => {
    if (!navigationPrompt) {
      return;
    }

    const nextRouteResource = parseResourceFromPath(pathname);
    if (
      !nextRouteResource ||
      nextRouteResource.resourceType !== navigationPrompt.newResourceType ||
      nextRouteResource.resourceId !== navigationPrompt.newResourceId
    ) {
      onNavigationPromptChange(null);
    }
  }, [navigationPrompt, onNavigationPromptChange, pathname]);

  React.useEffect(() => {
    if (!isOpen || !currentResourceFocus) {
      previousPathnameRef.current = pathname;
      onNavigationPromptChange(null);
      return;
    }

    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;
    const nextRouteResource = parseResourceFromPath(pathname);
    const hasRouteChanged = pathname !== previousPathname;
    if (hasRouteChanged) {
      attemptedPromptPathRef.current = null;
      activePromptPathRef.current = null;
    }
    const routePointsAtDifferentResource =
      Boolean(nextRouteResource) &&
      (nextRouteResource.resourceType !== currentResourceFocus.resourceType ||
        nextRouteResource.resourceId !== currentResourceFocus.resourceId);

    if (
      (!hasRouteChanged && !routePointsAtDifferentResource) ||
      attemptedPromptPathRef.current === pathname
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!nextRouteResource) {
        onNavigationPromptChange(null);
        return;
      }

      if (
        nextRouteResource.resourceType === currentResourceFocus.resourceType &&
        nextRouteResource.resourceId === currentResourceFocus.resourceId
      ) {
        onNavigationPromptChange(null);
        return;
      }

      const nextFocus = getResourceFocusFromCache(
        nextRouteResource.resourceType,
        nextRouteResource.resourceId,
        queryClient,
      );

      if (!nextFocus) {
        return;
      }

      attemptedPromptPathRef.current = pathname;
      onNavigationPromptChange({
        newResourceType: nextFocus.resourceType,
        newResourceId: nextFocus.resourceId,
        newResourceLabel: nextFocus.resourceLabel,
        buildNewContext: () => nextFocus,
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    currentResourceFocus,
    isOpen,
    onNavigationPromptChange,
    pathname,
    queryClient,
    registryVersion,
  ]);
}
