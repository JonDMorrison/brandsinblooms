import type { Theme } from "@mui/joy/styles";
import type { SxProps } from "@mui/joy/styles/types";
import { deepmerge } from "@mui/utils";

const flattenSx = (value: SxProps | undefined): SxProps[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => flattenSx(entry as SxProps));
  }

  return [value];
};

const resolveSxEntries = (value: SxProps, theme: Theme) => {
  const resolved = typeof value === "function" ? value(theme) : value;

  if (!resolved) {
    return [] as Array<Record<string, unknown>>;
  }

  if (Array.isArray(resolved)) {
    return resolved.flatMap((entry) =>
      resolveSxEntries(entry as SxProps, theme),
    );
  }

  return [resolved as Record<string, unknown>];
};

export const mergeSx = (...values: Array<SxProps | undefined>): SxProps => {
  const flattened = values.flatMap((value) => flattenSx(value));

  if (flattened.length === 0) {
    return {};
  }

  if (flattened.length === 1) {
    return flattened[0] as SxProps;
  }

  return (theme: Theme) =>
    flattened.reduce<Record<string, unknown>>((accumulator, value) => {
      const resolvedEntries = resolveSxEntries(value, theme);

      return resolvedEntries.reduce<Record<string, unknown>>(
        (merged, entry) => deepmerge(merged, entry),
        accumulator,
      );
    }, {});
};
