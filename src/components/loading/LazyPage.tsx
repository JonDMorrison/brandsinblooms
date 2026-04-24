import type { ComponentProps, ComponentType, ReactNode } from "react";
import { Suspense } from "react";
import ChunkErrorBoundary from "@/components/loading/ChunkErrorBoundary";
import {
  PageSkeleton,
  type PageSkeletonVariant,
} from "@/components/loading/PageSkeleton";
import { lazyRetry } from "@/utils/lazyRetry";

interface LazyPageProps {
  children: ReactNode;
  skeleton?: PageSkeletonVariant;
}

type LazyImport<T extends ComponentType<any>> = () => Promise<{ default: T }>;

export function LazyPage({ children, skeleton = "default" }: LazyPageProps) {
  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PageSkeleton variant={skeleton} />}>
        {children}
      </Suspense>
    </ChunkErrorBoundary>
  );
}

export function lazyPage<T extends ComponentType<any>>(
  importFn: LazyImport<T>,
  skeleton: PageSkeletonVariant = "default",
) {
  const LazyComponent = lazyRetry(importFn);

  function WrappedLazyPage(props: ComponentProps<T>) {
    return (
      <LazyPage skeleton={skeleton}>
        <LazyComponent {...props} />
      </LazyPage>
    );
  }

  WrappedLazyPage.displayName = `LazyPage(${importFn.name || "Component"})`;

  return WrappedLazyPage;
}

export default LazyPage;
