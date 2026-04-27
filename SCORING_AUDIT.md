# DISC Scoring Engine — Read-Only Audit Report

**Date:** 2026-04-27
**Project:** disc-insights-app (`~/Sites/disc-insights-app`)
**Status:** READ-ONLY AUDIT — No code was modified

---

## 1. Percentage Formula (Current Code)

### 1.1 File Location

All scoring logic is in **`src/utils/assessmentScoring.ts`**. It exports three functions:
- `calculateScores()` — tallies raw scores from responses
- `scaleScoresToPercentages()` — converts raw scores to percentages
- `getPrimaryType()` — determines the primary DISC type

Called from **`src/hooks/useAssessment.tsx`** lines 399-401:
```typescript
const rawScores = calculateDiscScores(responses);
const percentages = scaleScoresToPercentages(rawScores as any);
const primaryType = getPrimaryType(rawScores as any);
```

### 1.2a Raw Score Tallying

**File:** `src/utils/assessmentScoring.ts`, lines 9-77

For each response, the code:
- Adds **+1** to the DISC dimension of the **"Most Like Me"** selection (line 42)
- Subtracts **-1** from the DISC dimension of the **"Least Like Me"** selection (line 51)

```typescript
// Line 42: Add 1 point for most selected
scores[mostMap as keyof typeof scores] += 1;

// Line 51: Subtract 1 point for least selected
scores[leastMap as keyof typeof scores] -= 1;
```

With 30 questions, each dimension can range from **-30 to +30**. The sum of all four dimensions is always **zero** (each question adds +1 and -1).

### 1.2b Raw Scores → Percentages

**File:** `src/utils/assessmentScoring.ts`, lines 102-152 (`scaleScoresToPercentages`)

The algorithm:

1. Find the minimum raw score across all four dimensions (line 106)
2. If any score is negative, offset ALL scores by `|min|` to make them non-negative (lines 110-116)
3. Sum the offset scores (line 121)
4. Divide each offset score by the total and multiply by 100 (lines 130-135)
5. Adjust for rounding error by adding the difference to the highest-scoring trait (lines 140-148)

**Exact code (lines 102-152):**
```typescript
export const scaleScoresToPercentages = (rawScores: ScoreCalculation): PercentageScores => {
  const minScore = Math.min(rawScores.D, rawScores.I, rawScores.S, rawScores.C);
  const offset = minScore < 0 ? Math.abs(minScore) : 0;
  const adjustedScores = {
    D: rawScores.D + offset,
    I: rawScores.I + offset,
    S: rawScores.S + offset,
    C: rawScores.C + offset,
  };
  const totalAdjusted = adjustedScores.D + adjustedScores.I + adjustedScores.S + adjustedScores.C;
  if (totalAdjusted === 0) {
    return { D: 0, I: 0, S: 0, C: 0 };
  }
  let scaledScores: PercentageScores = {
    D: Math.round((adjustedScores.D / totalAdjusted) * 100),
    I: Math.round((adjustedScores.I / totalAdjusted) * 100),
    S: Math.round((adjustedScores.S / totalAdjusted) * 100),
    C: Math.round((adjustedScores.C / totalAdjusted) * 100),
  };
  // ... rounding adjustment ...
  return scaledScores;
};
```

### 1.3 What Happens When raw_score_d Is Negative

**Example:** raw scores D=-10, I=5, S=8, C=-3

1. `minScore = -10`, so `offset = 10`
2. Adjusted: D=0, I=15, S=18, C=7
3. Total = 40
4. Percentages: D=0%, I=38%, S=45%, C=18%

**This is the 51% zero-Dominance bug.** When D has the lowest raw score (which is common because D traits are frequently selected as "Least Like Me"), the offset makes D exactly zero, producing **percentage_d = 0%**.

The offset-based formula is mathematically flawed for DISC: the dimension with the lowest raw score will ALWAYS get 0%. Since raw scores sum to zero, the lowest score is always negative (or zero if tied), so there's always at least one dimension collapsed to 0%.

### 1.4 Primary Type Determination

**File:** `src/utils/assessmentScoring.ts`, lines 154-185 (`getPrimaryType`)

```typescript
export const getPrimaryType = (scores: ScoreCalculation | PercentageScores): string => {
  const sortedEntries = Object.entries(scores)
    .sort(([keyA, scoreA], [keyB, scoreB]) => {
      if (scoreB !== scoreA) return scoreB - scoreA; // Higher score wins
      return keyA.localeCompare(keyB); // Alphabetical tie-breaking (D < I < S < C)
    });
  const primaryType = sortedEntries[0][0];
  return primaryType;
};
```

**Critical finding:** `getPrimaryType` accepts EITHER raw scores OR percentage scores (union type `ScoreCalculation | PercentageScores`). In `useAssessment.tsx` line 401, it is called with **raw scores**:

```typescript
const primaryType = getPrimaryType(rawScores as any); // line 401
```

But in `EnhancedHeroSection.tsx` line 43, it is called with **percentage scores** for fallback:

```typescript
const primaryType = result.primary_type || getPrimaryType(scores); // scores = percentages
```

**This explains the "a b" anomaly** (D=34%, I=0%, S=33%, C=33%, primary_type='C'): The primary_type stored in the DB was computed from **raw scores**, not percentages. With raw scores, C could have been highest even though after the offset-and-scale transformation, D becomes the highest percentage. The two score spaces produce different winners.

**Tie-breaking:** Alphabetical — D wins ties over I, I over S, S over C (line 161: `keyA.localeCompare(keyB)`).

---

## 2. Results Page Behavior

### 2.1 Data Loading

**File:** `src/hooks/useAssessmentData.tsx`, lines 47-63

The Results page loads data via `useAssessmentData()`, which reads `assessment_results` from the DB and transforms it:

```typescript
const transformedResult = hasValidScores ? {
  // ...
  d_score: rawResult.percentage_d ?? 0,    // line 51
  i_score: rawResult.percentage_i ?? 0,    // line 52
  s_score: rawResult.percentage_s ?? 0,    // line 53
  c_score: rawResult.percentage_c ?? 0,    // line 54
  percentage_d: rawResult.percentage_d,     // line 55
  percentage_i: rawResult.percentage_i,     // line 56
  percentage_s: rawResult.percentage_s,     // line 57
  percentage_c: rawResult.percentage_c,     // line 58
  primary_type: rawResult.primary_type,     // line 59
  // ...
} : null;
```

### 2.2 Answer: Reads from DB

**YES — the Results page reads `percentage_d/i/s/c` and `primary_type` directly from the `assessment_results` DB row.** It does NOT recompute percentages from raw scores on display.

The `d_score` field is mapped to `percentage_d` (not `raw_score_d`) — see line 51.

### 2.3 Primary Type Display

`primary_type` is **read from DB** (line 59). However, `EnhancedHeroSection.tsx` line 43 has a fallback:

```typescript
const primaryType = result.primary_type || getPrimaryType(scores);
```

If `primary_type` is null in the DB, it recalculates from **percentages** (not raw scores). This is a secondary inconsistency — the stored `primary_type` was computed from raw scores, but the fallback computes from percentages.

### 2.4 Will a DB-Only Fix Be Visible to Users?

**YES** — a database-only fix to `percentage_d/i/s/c` and `primary_type` columns WILL be immediately visible to users because the Results page reads directly from the DB. No frontend changes are required for the fix to take effect.

There is also a display adapter in `src/utils/scoreDisplay.ts` (`getDisplayScores`) that has a fallback recompute path, but it is only used when `percentage_*` columns are undefined (null). If the DB fix populates valid percentages, this fallback never fires.

**Additional note:** `src/utils/scoreDisplay.ts` lines 48-49 contain the SAME offset-based formula as `assessmentScoring.ts` (line 106-116). If any code path falls back to recomputing from raw scores, it will reproduce the same 0% bug. Both files would need to be updated if the formula changes.

---

## 3. Response Saving Status

### 3.1 Code That Writes to assessment_responses

**File:** `src/hooks/useAssessment.tsx`, lines 434-455

```typescript
// Submit individual responses (only for classic questions to avoid FK issues with enhanced questions)
const isUsingEnhancedQuestions = questions.length >= 30;

if (!isUsingEnhancedQuestions) {
  const responseEntries = Object.entries(responses).map(([questionId, response]) => ({
    assessment_id: result.id,
    question_id: questionId,
    most_selected: response.most,
    least_selected: response.least
  }));

  const { error: responsesError } = await supabase
    .from('assessment_responses')
    .insert(responseEntries);

  if (responsesError) {
    console.error('Error submitting responses:', responsesError);
    // Continue even if responses fail to save
  }
} else {
  console.log('Skipping individual response saves for enhanced questions (FK mismatch)');
}
```

### 3.2 Answer: Code Exists But Is Intentionally Disabled

**The code explicitly skips response saving when using enhanced questions** (line 435-454). The check `questions.length >= 30` is always true because the app loads 30 enhanced questions (line 72 limits to 30).

The `assessment_responses` table has a foreign key `question_id` → `questions.id`. The enhanced questions come from the `enhanced_questions` table, which has different IDs. Inserting enhanced question IDs into `assessment_responses.question_id` would violate the FK constraint.

**Timeline:** The `enhanced_questions` table was introduced on **2025-10-14** (commit `5f41967`). Before that, the app used 24 classic questions and responses WERE saved. After that date, `isUsingEnhancedQuestions` became true and responses were silently skipped. This matches the observed cutoff of ~Sept 27, 2025 (the last classic-question assessment before the switch).

### 3.3 This is NOT a bug — it's a known FK constraint workaround with a logged skip message:
```
'Skipping individual response saves for enhanced questions (FK mismatch)'
```

To re-enable response saving, either:
- Change the FK on `assessment_responses.question_id` to reference `enhanced_questions` instead
- Create a unified questions view/table
- Remove the FK constraint and store question IDs as plain UUIDs

---

## 4. Additional Findings (Bugs Noted, Not Fixed)

### 4.1 `hasValidScores` Check Is Wrong

**File:** `src/hooks/useAssessmentData.tsx`, lines 42-45

```typescript
const hasValidScores = rawResult && (
  (rawResult.raw_score_d > 0 || rawResult.raw_score_i > 0 || rawResult.raw_score_s > 0 || rawResult.raw_score_c > 0) ||
  (rawResult.percentage_d > 0 || rawResult.percentage_i > 0 || rawResult.percentage_s > 0 || rawResult.percentage_c > 0)
);
```

This uses `> 0` (strictly positive). If a user's only positive raw score is in a dimension that also has `percentage = 0` due to the offset bug, AND all other raw scores are ≤ 0, this could incorrectly mark a valid assessment as invalid. In practice, at least one of I/S/C is usually positive, so this hasn't caused widespread data loss — but it's a latent bug.

### 4.2 `getPrimaryType` Called on Two Different Score Spaces

As documented in Section 1.4, `primary_type` is computed from **raw scores** during submission (useAssessment.tsx:401) but from **percentages** in the display fallback (EnhancedHeroSection.tsx:43). These can produce different results. After a DB fix to percentages, the stored `primary_type` (from raw scores) might disagree with what `getPrimaryType(percentages)` would return.

### 4.3 `scoreDisplay.ts` Duplicates the Broken Formula

`src/utils/scoreDisplay.ts` lines 47-73 contain an independent copy of the offset-based percentage formula. If `assessmentScoring.ts` is fixed but `scoreDisplay.ts` is not, any code path using `getDisplayScores()` with only raw scores (no percentages) will still produce 0% values.

---

## 5. Recent Commits Touching Scoring (Last 60 Days)

| Date | Hash | Message |
|------|------|---------|
| 2026-04-27 | `727890b` | fix: prevent duplicate assessment submissions with useRef guard |
| 2026-04-23 | `7fdaf2e` | feat(ai): free-tier auto-generated style summary on assessment completion |
| 2026-02-12 | `5c47fa6` | feat: permanently switch to 30-question assessment and fix UI labels |
| 2026-02-08 | `f9f1fe6` | feat(ui): premium UI overhaul, critical fixes, and new marketing sections |

**Historical (scoring formula changes):**
| Date | Hash | Message |
|------|------|---------|
| 2025-10-14 | `5f41967` | Refactor assessment to 50 questions ← **response saving broke here** |
| 2025-09-26 | `d160674` | Fix DISC scoring inaccuracies ← last change to assessmentScoring.ts |
| 2025-09-05 | `beb96d8` | Fix assessment scoring logic |

---

## 6. Recommended Fix Surface

### Is a DB-Only Fix Sufficient?

**YES for existing data.** The Results page reads `percentage_d/i/s/c` and `primary_type` directly from the DB. Updating those columns with correct values will immediately fix the display for all 355 existing users.

**NO for future assessments.** The scoring formula in `assessmentScoring.ts` must also be fixed, or every new assessment will be stored with the same 0% bug. Two files contain the broken formula:

### Minimum Code Surface

| # | File | What to Change |
|---|------|---------------|
| 1 | `src/utils/assessmentScoring.ts` | Fix `scaleScoresToPercentages()` — replace offset-based formula with one that doesn't collapse the lowest score to 0% |
| 2 | `src/utils/scoreDisplay.ts` | Fix `getDisplayScores()` — same formula duplication |
| 3 | `src/hooks/useAssessment.tsx` line 401 | Decide: should `getPrimaryType` use raw scores or percentages? Make it consistent with what's stored |
| 4 | Database migration | Recompute `percentage_d/i/s/c` and `primary_type` for all 355 existing rows using the new formula |

### Safe Order of Operations

1. **Write the new formula** in `assessmentScoring.ts` and `scoreDisplay.ts` (do NOT deploy yet)
2. **Write a DB migration script** that recomputes all 355 rows using the new formula
3. **Deploy the frontend** with the new formula
4. **Run the migration** to fix historical data
5. **Verify** by spot-checking known anomalies (the "a b" user, users with 0% D)

If rollback is needed: the DB migration should store old values in a backup column (e.g., `percentage_d_old`) before overwriting. The frontend change is safe to roll back independently since the Results page reads from DB.

### Response Saving Fix

**Independent of the math fix.** The FK constraint issue is a separate problem that doesn't affect scoring accuracy. It can be fixed before, after, or never — it only affects whether per-question responses are available for audit/debugging. Recommended: fix it after the scoring math is stable, since you'll want response data for future score validation.

---

## 7. Open Questions for Jon

1. **What percentage formula do you want?** The current offset-based formula guarantees one dimension is always 0%. Common alternatives:
   - **Min-max normalization:** Map the range [min_raw, max_raw] to [5%, max%] so no dimension is ever zero
   - **Absolute-value share:** `|raw_score| / sum(|all_raw_scores|) * 100` — but loses the sign information
   - **Shifted proportional:** Add a fixed constant (e.g., 30) to all raw scores before computing percentages, ensuring all are positive

2. **Should `primary_type` be computed from raw scores or percentages?** Currently raw scores (at submission time). If you switch to percentages, the primary_type might change for some users after the formula fix.

3. **Do you want to preserve the existing `primary_type` values or recompute them?** Some users may have built team reports, shared results, or made decisions based on their current type assignment.

4. **For the "a b" anomaly specifically:** The stored primary_type='C' was computed from raw scores where C was highest. After fixing percentages, D becomes highest. Should this user's primary_type change to D?

5. **Response saving:** Do you want to fix the FK constraint to re-enable per-question response storage? This would require either altering the FK or creating a new table.
