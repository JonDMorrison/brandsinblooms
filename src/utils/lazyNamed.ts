import type { ComponentType } from "react";
import { lazyRetry } from "@/utils/lazyRetry";

type ExtractLazyComponent<T> = T extends ComponentType<any> ? T : never;

export function lazyNamed<
  TModule extends Record<string, unknown>,
  TExportName extends keyof TModule & string,
>(importFn: () => Promise<TModule>, exportName: TExportName) {
  return lazyRetry<ExtractLazyComponent<TModule[TExportName]>>(async () => {
    const module = await importFn();
    const resolvedExport = module[exportName];

    if (
      !resolvedExport ||
      (typeof resolvedExport !== "function" &&
        typeof resolvedExport !== "object")
    ) {
      throw new Error(`lazyNamed could not find export "${exportName}".`);
    }

    return {
      default: resolvedExport as ExtractLazyComponent<TModule[TExportName]>,
    };
  });
}

export default lazyNamed;
