
# Add Segments to SMS Campaign Builder

## Problem Summary

Christine from Down To Earth cannot find segments (like "Perks members") in the SMS builder, and "All SMS Subscribers" only shows a few members.

**Root Causes Identified:**

1. **SMS wizard queries wrong table**: It queries `custom_segments` (empty) instead of `crm_segments` (where segments are actually stored)
2. **System segments not included**: Predefined segments like "Loyalty Members" and "High-Value Customers" are visible on the CRM Segments page but not available in the SMS wizard
3. **No "Perks Members" segment**: The system has "Loyalty Members" but it's tag-based, not linked to the `is_perks_member` field in `customer_loyalty_metrics`
4. **Low SMS opt-in**: Only 1 of 622 customers has both a phone number AND sms_opt_in enabled

---

## Solution Overview

### Part 1: Fix Segment Loading in SMS Wizard

Update the SMS Campaign Wizard to load segments from the correct sources:

```text
CURRENT:  custom_segments table only (empty)
FIXED:    crm_segments table + predefined system segments with live counts
```

### Part 2: Add "Perks Members" as a System Segment

Create a new predefined segment based on `is_perks_member = true` from the `customer_loyalty_metrics` table.

---

## Implementation Details

### File 1: `src/components/sms/SMSCampaignWizard.tsx`

**Change: Update `loadSegments()` function**

Currently queries `custom_segments` table (wrong). Will update to:
1. Query `crm_segments` table (correct table for custom segments)
2. Include predefined system segments with live customer counts
3. Use `useSegmentCounts` hook for system segment counts
4. Show both system and custom segments in the audience selector

**Before:**
```typescript
const { data, error } = await supabase
  .from('custom_segments')  // Wrong table!
  .select('*')
  .eq('tenant_id', tenant?.id)
  .eq('is_active', true)
```

**After:**
```typescript
// 1. Load custom segments from crm_segments
const { data, error } = await supabase
  .from('crm_segments')  // Correct table
  .select('*')
  .eq('tenant_id', tenant?.id);

// 2. Add predefined segments with counts
const allSegments = [
  ...SYSTEM_SEGMENTS.map(s => ({
    id: s.id,
    name: s.name,
    description: s.description,
    customer_count: counts[s.id] || 0,
    type: 'predefined' as const
  })),
  ...customSegments
];
```

### File 2: `src/config/segmentDefinitions.ts`

**Change: Add Perks Members segment**

Add a new system segment for Perks program members:

```typescript
{
  id: 'perks-members',
  name: 'Perks Members',
  description: 'Customers enrolled in your Perks loyalty program',
  icon: 'crown',
  is_system: true,
  conditions: {
    rules: [
      { field: 'is_perks_member', operator: '=', value: true }
    ],
    logic: 'AND'
  },
}
```

### File 3: `src/hooks/useSegmentCounts.ts`

**Change: Add Perks Members count calculation**

Update the hook to count customers who have `is_perks_member = true` in `customer_loyalty_metrics`:

```typescript
// Add to interface
interface SegmentCounts {
  'loyalty-members': number;
  'high-value': number;
  'new-customers': number;
  'lapsed-customers': number;
  'seasonal-shoppers': number;
  'frequent-buyers': number;
  'perks-members': number;  // NEW
}

// Add count calculation
const { data: perksMembers } = await supabase
  .from('customer_loyalty_metrics')
  .select('customer_id')
  .eq('is_perks_member', true)
  .in('customer_id', customers.map(c => c.id));

'perks-members': perksMembers?.length || 0
```

### File 4: `src/hooks/useAllSegments.ts`

**Change: Add Perks Members to predefined segments list**

```typescript
{
  id: 'perks-members',
  name: 'Perks Members',
  description: 'Customers enrolled in your Perks loyalty program',
  customer_count: 0,
}
```

---

## Updated SMS Wizard Audience Section

After implementation, the "Target Audience" section will show:

```text
[ ] All SMS Subscribers (X customers)

System Segments
[ ] Perks Members (X customers)     ← NEW
[ ] Loyalty Members (X customers)
[ ] High-Value Customers (X customers)
[ ] New Customers (X customers)
[ ] Lapsed Customers (X customers)
[ ] Frequent Buyers (X customers)

Custom Segments
[ ] Plant killer (0 customers)
```

---

## Segment Targeting Logic for SMS

When a segment is selected, customers are filtered by:

1. **System segments**: Evaluate conditions against customer data (e.g., `is_perks_member = true` for Perks Members)
2. **Custom segments**: Query `customer_segments` table for membership
3. **Always apply**: `sms_opt_in = true` AND `phone IS NOT NULL`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/sms/SMSCampaignWizard.tsx` | Fix segment loading, add system segments |
| `src/config/segmentDefinitions.ts` | Add Perks Members definition |
| `src/hooks/useSegmentCounts.ts` | Add Perks Members count calculation |
| `src/hooks/useAllSegments.ts` | Add Perks Members to predefined list |
| `src/pages/crm/CRMSegmentsPage.tsx` | Add Perks Members to display list |

---

## Note on Low SMS Subscriber Count

The "All SMS Subscribers" showing only a few members is a **data issue**, not a code bug:
- 622 total customers
- Only 1 has `phone` populated
- Only 1 has `sms_opt_in = true`

To increase SMS subscribers:
1. Customers need to have phone numbers imported/added
2. Customers need to explicitly opt-in to SMS (toggle sms_opt_in to true)
3. Consider adding an SMS opt-in prompt during checkout or in customer profiles
