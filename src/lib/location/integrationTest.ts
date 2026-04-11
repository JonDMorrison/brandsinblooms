/**
 * Integration test for location extraction persistence.
 * Run this from browser console or a test file.
 */

import { supabase } from "@/integrations/supabase/client";
import { persistLocationExtraction } from "./persistLocationExtraction";

interface TestResult {
  testName: string;
  passed: boolean;
  details: any;
}

export async function runLocationPersistenceIntegrationTest(
  testUserId: string,
): Promise<{ passed: boolean; results: TestResult[] }> {
  const results: TestResult[] = [];
  // Test 1: Analyze Portland Nursery (multi-location site)
  try {
    const { data, error } = await supabase.functions.invoke("analyze-website", {
      body: { websiteUrl: "https://www.portlandnursery.com" },
    });

    if (error) throw error;

    const locationExtraction = data.locationExtraction;

    results.push({
      testName: "Multi-location extraction returns candidates",
      passed: locationExtraction.candidates.length >= 2,
      details: {
        candidateCount: locationExtraction.candidates.length,
        candidates: locationExtraction.candidates.map(
          (c: any) => c.postal_code,
        ),
      },
    });

    results.push({
      testName: "Multi-location sets requires_confirmation=true",
      passed: locationExtraction.requires_confirmation === true,
      details: {
        requires_confirmation: locationExtraction.requires_confirmation,
        confidence: locationExtraction.confidence,
      },
    });

    // Test 2: Persist to database
    const persistResult = await persistLocationExtraction({
      userId: testUserId,
      websiteUrl: "https://www.portlandnursery.com",
      locationExtraction: locationExtraction,
    });

    results.push({
      testName: "Persistence succeeds",
      passed: persistResult.success === true,
      details: {
        success: persistResult.success,
        profileId: persistResult.profileId,
        error: persistResult.error,
      },
    });

    results.push({
      testName: "Persistence returns needsConfirmation=true",
      passed: persistResult.needsConfirmation === true,
      details: {
        needsConfirmation: persistResult.needsConfirmation,
      },
    });

    // Test 3: Verify database state
    const { data: profile, error: fetchError } = await supabase
      .from("company_profiles")
      .select(
        `
        id, website_url, postal_code, city, state_province, country,
        location_detection_source, location_confidence,
        location_needs_confirmation, location_detection_candidates,
        location_last_detected_at
      `,
      )
      .eq("user_id", testUserId)
      .single();

    if (fetchError) throw fetchError;

    const candidates = profile.location_detection_candidates as any[] | null;

    results.push({
      testName: "Database has location_detection_candidates",
      passed: Array.isArray(candidates) && candidates.length >= 2,
      details: {
        candidateCount: candidates?.length || 0,
      },
    });

    results.push({
      testName: "Database has location_needs_confirmation=true",
      passed: profile.location_needs_confirmation === true,
      details: {
        location_needs_confirmation: profile.location_needs_confirmation,
      },
    });

    results.push({
      testName: "Database has location_detection_source",
      passed: profile.location_detection_source !== null,
      details: {
        source: profile.location_detection_source,
      },
    });

    results.push({
      testName: "Database has postal_code set",
      passed: profile.postal_code !== null && profile.postal_code.length > 0,
      details: {
        postal_code: profile.postal_code,
      },
    });

    results.push({
      testName: "Database has location_last_detected_at",
      passed: profile.location_last_detected_at !== null,
      details: {
        timestamp: profile.location_last_detected_at,
      },
    });
  } catch (error: any) {
    console.error("🧪 Test error:", error);
    results.push({
      testName: "Test execution",
      passed: false,
      details: { error: error.message },
    });
  }

  return { passed: allPassed, results };
}
