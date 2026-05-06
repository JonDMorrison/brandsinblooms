import type { Theme } from "@mui/joy/styles";
import type { SxProps } from "@mui/joy/styles/types";

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Object.prototype.toString.call(value) === "[object Object]";
};

const mergeRecords = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> => {
  const merged = { ...target };

  for (const [key, value] of Object.entries(source)) {
    const currentValue = merged[key];

    if (Array.isArray(currentValue) && Array.isArray(value)) {
      merged[key] = [...currentValue, ...value];
      continue;
    }

    if (isPlainObject(currentValue) && isPlainObject(value)) {
      merged[key] = mergeRecords(currentValue, value);
      continue;
    }

    merged[key] = value;
  }

  return merged;
};

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
        (merged, entry) => mergeRecords(merged, entry),
        accumulator,
      );
    }, {});
};
