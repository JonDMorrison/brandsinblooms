#!/usr/bin/env npx tsx
/**
 * Manual CLI test for VMX API sync.
 *
 * Usage:
 *   VMX_TEST_CLIENT_ID=<key> npx tsx scripts/test-vmx-sync.ts <tenant_id>
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TOKEN_ENCRYPTION_KEY env vars.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "https://udldmkqwnxhdeztyqcau.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VMX_KEY = process.env.VMX_TEST_CLIENT_ID;
const TENANT_ID = process.argv[2];

if (!VMX_KEY) { console.error("Set VMX_TEST_CLIENT_ID env var"); process.exit(1); }
if (!TENANT_ID) { console.error("Usage: npx tsx scripts/test-vmx-sync.ts <tenant_id>"); process.exit(1); }
if (!SERVICE_KEY) { console.error("Set SUPABASE_SERVICE_ROLE_KEY env var"); process.exit(1); }

async function main() {
  console.log("=== VMX Sync Test ===");
  console.log(`Tenant: ${TENANT_ID}`);
  console.log(`VMX Key: ${VMX_KEY!.substring(0, 8)}...`);

  // Step 1: Test VMX API directly
  console.log("\n1. Testing VMX API connection...");
  const testRes = await fetch("https://bcg.vmxllc.com/pos/api/customers?start=today&page=1", {
    headers: { "VMX-Client-ID": VMX_KEY! },
  });
  console.log(`   Status: ${testRes.status}`);
  const testData = await testRes.json();
  console.log(`   Customers returned: ${Array.isArray(testData) ? testData.length : "N/A"}`);

  // Step 2: Connect via vmx-connect
  console.log("\n2. Calling vmx-connect...");
  // We need a user JWT for this — skip if service-role only
  // Instead, directly insert a test connection
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "apikey": SERVICE_KEY!,
  };

  // Step 3: Call vmx-sync-customers
  console.log("\n3. Checking for existing VMX connection...");
  const connRes = await fetch(`${SUPABASE_URL}/rest/v1/pos_connections?tenant_id=eq.${TENANT_ID}&platform=eq.vmx&select=id`, {
    headers: { ...headers, "apikey": SERVICE_KEY! },
  });
  const conns = await connRes.json();

  if (!Array.isArray(conns) || conns.length === 0) {
    console.log("   No VMX connection found. Create one first via vmx-connect endpoint.");
    console.log("   Or insert manually into pos_connections with encrypted credentials.");
    return;
  }

  const connectionId = conns[0].id;
  console.log(`   Found connection: ${connectionId}`);

  // Step 4: Sync customers
  console.log("\n4. Syncing customers...");
  const t1 = Date.now();
  const custRes = await fetch(`${SUPABASE_URL}/functions/v1/vmx-sync-customers`, {
    method: "POST",
    headers,
    body: JSON.stringify({ connection_id: connectionId, full_sync: false }),
  });
  const custData = await custRes.json();
  console.log(`   Status: ${custRes.status}`);
  console.log(`   Result: ${JSON.stringify(custData)}`);
  console.log(`   Duration: ${Date.now() - t1}ms`);

  // Step 5: Sync receipts
  console.log("\n5. Syncing receipts...");
  const t2 = Date.now();
  const rcptRes = await fetch(`${SUPABASE_URL}/functions/v1/vmx-sync-receipts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ connection_id: connectionId, full_sync: false }),
  });
  const rcptData = await rcptRes.json();
  console.log(`   Status: ${rcptRes.status}`);
  console.log(`   Result: ${JSON.stringify(rcptData)}`);
  console.log(`   Duration: ${Date.now() - t2}ms`);

  console.log("\n=== Done ===");
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
