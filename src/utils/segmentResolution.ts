/**
 * Pure segment resolution engine — no React dependencies.
 * Classifies DB segments into system | user | system_pending states.
 */
import { SegmentDefinition } from '@/config/segmentDefinitions';

// ── Types ───────────────────────────────────────────────────────────

export interface DbSegment {
  id: string;
  name: string;
  description?: string | null;
  conditions: any;
  customer_count: number;
  is_system_segment?: boolean;
  auto_update?: boolean;
  persona_id?: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: any; // allow extra DB fields
}

export type SegmentState = 'system' | 'user' | 'system_pending';

export interface ResolvedSegment {
  id: string | null;
  definition_id: string;
  name: string;
  description: string;
  state: SegmentState;
  is_system_segment: boolean;
  customer_count: number;
  db_record: DbSegment | null;
  duplicates?: string[];
}

export interface DuplicateWarning {
  name: string;
  count: number;
  ids: string[];
}

export interface SegmentResolutionResult {
  resolved: ResolvedSegment[];
  systemSegments: ResolvedSegment[];
  userSegments: ResolvedSegment[];
  pendingSystemSegments: ResolvedSegment[];
  duplicateWarnings: DuplicateWarning[];
}

// ── Helpers ─────────────────────────────────────────────────────────

export const normalizeName = (name: string): string =>
  name.trim().toLowerCase();

// ── Core resolver ───────────────────────────────────────────────────

export function resolveSegments(
  dbSegments: DbSegment[],
  systemDefinitions: SegmentDefinition[],
): SegmentResolutionResult {
  const resolved: ResolvedSegment[] = [];
  const duplicateWarnings: DuplicateWarning[] = [];

  // Track which DB rows have been claimed by a system definition
  const claimedDbIds = new Set<string>();

  // 1. Resolve each system definition against DB rows
  for (const def of systemDefinitions) {
    const normalizedDefName = normalizeName(def.name);

    // Find all DB rows whose name matches this definition (case-insensitive)
    const matches = dbSegments.filter(
      (row) => normalizeName(row.name) === normalizedDefName,
    );

    if (matches.length === 0) {
      // No DB row → system_pending
      resolved.push({
        id: null,
        definition_id: def.id,
        name: def.name,
        description: def.description,
        state: 'system_pending',
        is_system_segment: true,
        customer_count: 0,
        db_record: null,
      });
      continue;
    }

    // Flag duplicates
    if (matches.length > 1) {
      duplicateWarnings.push({
        name: def.name,
        count: matches.length,
        ids: matches.map((m) => m.id),
      });
    }

    // Pick the first row flagged as system; fallback to first match
    const primary =
      matches.find((m) => m.is_system_segment === true) ?? matches[0];
    const duplicateIds = matches
      .filter((m) => m.id !== primary.id)
      .map((m) => m.id);

    // Mark all matched rows as claimed
    matches.forEach((m) => claimedDbIds.add(m.id));

    resolved.push({
      id: primary.id,
      definition_id: def.id,
      name: def.name,
      description: def.description,
      state: primary.is_system_segment ? 'system' : 'user',
      is_system_segment: !!primary.is_system_segment,
      customer_count: primary.customer_count ?? 0,
      db_record: primary,
      ...(duplicateIds.length > 0 ? { duplicates: duplicateIds } : {}),
    });
  }

  // 2. All remaining (unclaimed) DB rows are user segments
  for (const row of dbSegments) {
    if (claimedDbIds.has(row.id)) continue;

    resolved.push({
      id: row.id,
      definition_id: row.id, // user segments use their DB id
      name: row.name,
      description: row.description ?? '',
      state: 'user',
      is_system_segment: false,
      customer_count: row.customer_count ?? 0,
      db_record: row,
    });
  }

  return {
    resolved,
    systemSegments: resolved.filter((r) => r.state === 'system'),
    userSegments: resolved.filter((r) => r.state === 'user'),
    pendingSystemSegments: resolved.filter((r) => r.state === 'system_pending'),
    duplicateWarnings,
  };
}
