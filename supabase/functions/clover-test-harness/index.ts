import { createClient } from 'npm:@supabase/supabase-js@2';
import { decryptToken } from '../_shared/crypto/tokens.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent, tracestate',
};

// Get Clover API base URL based on environment and region
function getCloverApiUrl(environment: string, region: string = 'na'): string {
  if (environment === 'sandbox') {
    return 'https://apisandbox.dev.clover.com';
  }
  switch (region) {
    case 'eu': return 'https://api.eu.clover.com';
    case 'la': return 'https://api.la.clover.com';
    default: return 'https://api.clover.com';
  }
}

interface EndpointResult {
  success: boolean;
  count?: number;
  samples?: any[];
  data?: any;
  error?: string;
  timing_ms: number;
  status_code?: number;
}

interface TestResults {
  merchant: EndpointResult;
  employees: EndpointResult;
  customers: EndpointResult;
  inventory: EndpointResult;
  orders: EndpointResult;
  payments: EndpointResult;
}

interface TestReport {
  status: 'success' | 'partial' | 'failed';
  summary: string;
  duration_ms: number;
  results: TestResults;
  counts: {
    employees: number;
    customers: number;
    items: number;
    orders_last_30d: number;
    payments_last_30d: number;
  };
  errors: Array<{ endpoint: string; code: string; message: string }>;
}

async function testEndpoint(
  name: string,
  url: string,
  accessToken: string,
  extractData: (data: any) => { count?: number; samples?: any[]; data?: any }
): Promise<EndpointResult> {
  const startTime = Date.now();
  
  try {
    console.log(`[CLOVER-TEST-HARNESS] Testing ${name}: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    
    const timing_ms = Date.now() - startTime;
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CLOVER-TEST-HARNESS] ${name} failed:`, response.status, errorText);
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText.substring(0, 200)}`,
        timing_ms,
        status_code: response.status,
      };
    }
    
    const responseData = await response.json();
    const extracted = extractData(responseData);
    
    console.log(`[CLOVER-TEST-HARNESS] ${name} success in ${timing_ms}ms`, 
      extracted.count !== undefined ? `count=${extracted.count}` : '');
    
    return {
      success: true,
      timing_ms,
      status_code: response.status,
      ...extracted,
    };
  } catch (error: any) {
    const timing_ms = Date.now() - startTime;
    console.error(`[CLOVER-TEST-HARNESS] ${name} exception:`, error.message);
    return {
      success: false,
      error: error.message,
      timing_ms,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const overallStart = Date.now();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    // Parse optional body parameters
    let dateRangeDays = 30;
    try {
      const body = await req.json();
      if (body.date_range_days) dateRangeDays = body.date_range_days;
    } catch {
      // No body or invalid JSON, use defaults
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');

    // Get user's tenant_id
    const { data: userData } = await supabaseClient
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (!userData?.tenant_id) throw new Error('No tenant found');

    // Get Clover connection
    const { data: connection } = await supabaseClient
      .from('clover_connections')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'connected')
      .single();

    if (!connection) throw new Error('No active Clover connection');

    console.log('[CLOVER-TEST-HARNESS] Starting comprehensive test for merchant:', connection.merchant_id);

    // Decrypt access token
    const accessToken = await decryptToken(connection.encrypted_access_token);
    const apiBaseUrl = getCloverApiUrl(connection.environment, connection.region);
    const merchantId = connection.merchant_id;

    const errors: Array<{ endpoint: string; code: string; message: string }> = [];

    // A) Test Merchant (required - auth check)
    const merchantResult = await testEndpoint(
      'Merchant',
      `${apiBaseUrl}/v3/merchants/${merchantId}`,
      accessToken,
      (data) => ({
        data: {
          id: data.id,
          name: data.name,
          timezone: data.timezone,
          currency: data.defaultCurrency,
          address: data.address,
        }
      })
    );

    if (!merchantResult.success) {
      // Auth failure - stop early
      const report: TestReport = {
        status: 'failed',
        summary: 'Authentication failed - could not access merchant data',
        duration_ms: Date.now() - overallStart,
        results: {
          merchant: merchantResult,
          employees: { success: false, error: 'Skipped due to auth failure', timing_ms: 0 },
          customers: { success: false, error: 'Skipped due to auth failure', timing_ms: 0 },
          inventory: { success: false, error: 'Skipped due to auth failure', timing_ms: 0 },
          orders: { success: false, error: 'Skipped due to auth failure', timing_ms: 0 },
          payments: { success: false, error: 'Skipped due to auth failure', timing_ms: 0 },
        },
        counts: { employees: 0, customers: 0, items: 0, orders_last_30d: 0, payments_last_30d: 0 },
        errors: [{ endpoint: 'merchant', code: 'AUTH_FAILED', message: merchantResult.error || 'Unknown error' }],
      };

      // Save failed test result
      await saveTestResult(supabaseClient, userData.tenant_id, connection.id, merchantId, user.id, report);

      return new Response(JSON.stringify(report), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // B) Test Employees
    const employeesResult = await testEndpoint(
      'Employees',
      `${apiBaseUrl}/v3/merchants/${merchantId}/employees?limit=50`,
      accessToken,
      (data) => {
        const elements = data.elements || [];
        return {
          count: elements.length,
          samples: elements.slice(0, 3).map((e: any) => ({
            id: e.id,
            name: e.name,
            role: e.role,
            email: e.email,
          })),
        };
      }
    );
    if (!employeesResult.success && employeesResult.error) {
      errors.push({ endpoint: 'employees', code: String(employeesResult.status_code || 'ERROR'), message: employeesResult.error });
    }

    // C) Test Customers
    const customersResult = await testEndpoint(
      'Customers',
      `${apiBaseUrl}/v3/merchants/${merchantId}/customers?limit=50`,
      accessToken,
      (data) => {
        const elements = data.elements || [];
        return {
          count: elements.length,
          samples: elements.slice(0, 3).map((c: any) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            email: c.emailAddresses?.elements?.[0]?.emailAddress,
            phone: c.phoneNumbers?.elements?.[0]?.phoneNumber,
          })),
        };
      }
    );
    if (!customersResult.success && customersResult.error) {
      errors.push({ endpoint: 'customers', code: String(customersResult.status_code || 'ERROR'), message: customersResult.error });
    }

    // D) Test Inventory/Items
    const inventoryResult = await testEndpoint(
      'Inventory',
      `${apiBaseUrl}/v3/merchants/${merchantId}/items?limit=50`,
      accessToken,
      (data) => {
        const elements = data.elements || [];
        return {
          count: elements.length,
          samples: elements.slice(0, 3).map((i: any) => ({
            id: i.id,
            name: i.name,
            sku: i.sku || i.code,
            price: i.price ? (i.price / 100).toFixed(2) : null,
          })),
        };
      }
    );
    if (!inventoryResult.success && inventoryResult.error) {
      errors.push({ endpoint: 'inventory', code: String(inventoryResult.status_code || 'ERROR'), message: inventoryResult.error });
    }

    // E) Test Orders (last N days)
    const startTimestamp = Date.now() - (dateRangeDays * 24 * 60 * 60 * 1000);
    const ordersResult = await testEndpoint(
      'Orders',
      `${apiBaseUrl}/v3/merchants/${merchantId}/orders?filter=createdTime>=${startTimestamp}&limit=50`,
      accessToken,
      (data) => {
        const elements = data.elements || [];
        return {
          count: elements.length,
          samples: elements.slice(0, 3).map((o: any) => ({
            id: o.id,
            total: o.total ? (o.total / 100).toFixed(2) : null,
            createdTime: o.createdTime ? new Date(o.createdTime).toISOString() : null,
            state: o.state,
          })),
        };
      }
    );
    if (!ordersResult.success && ordersResult.error) {
      errors.push({ endpoint: 'orders', code: String(ordersResult.status_code || 'ERROR'), message: ordersResult.error });
    }

    // F) Test Payments (last N days)
    const paymentsResult = await testEndpoint(
      'Payments',
      `${apiBaseUrl}/v3/merchants/${merchantId}/payments?filter=createdTime>=${startTimestamp}&limit=50`,
      accessToken,
      (data) => {
        const elements = data.elements || [];
        return {
          count: elements.length,
          samples: elements.slice(0, 3).map((p: any) => ({
            id: p.id,
            amount: p.amount ? (p.amount / 100).toFixed(2) : null,
            tender: p.tender?.label || p.tender?.labelKey,
            createdTime: p.createdTime ? new Date(p.createdTime).toISOString() : null,
          })),
        };
      }
    );
    if (!paymentsResult.success && paymentsResult.error) {
      errors.push({ endpoint: 'payments', code: String(paymentsResult.status_code || 'ERROR'), message: paymentsResult.error });
    }

    // Compile results
    const results: TestResults = {
      merchant: merchantResult,
      employees: employeesResult,
      customers: customersResult,
      inventory: inventoryResult,
      orders: ordersResult,
      payments: paymentsResult,
    };

    const counts = {
      employees: employeesResult.count || 0,
      customers: customersResult.count || 0,
      items: inventoryResult.count || 0,
      orders_last_30d: ordersResult.count || 0,
      payments_last_30d: paymentsResult.count || 0,
    };

    // Determine overall status
    const allTests = [merchantResult, employeesResult, customersResult, inventoryResult, ordersResult, paymentsResult];
    const successCount = allTests.filter(t => t.success).length;
    
    let status: 'success' | 'partial' | 'failed';
    let summary: string;
    
    if (successCount === allTests.length) {
      status = 'success';
      summary = `All ${allTests.length} endpoints tested successfully. Found ${counts.customers} customers, ${counts.items} items, ${counts.orders_last_30d} orders (${dateRangeDays}d).`;
    } else if (successCount === 0) {
      status = 'failed';
      summary = 'All endpoint tests failed. Check connection and permissions.';
    } else {
      status = 'partial';
      summary = `${successCount}/${allTests.length} endpoints succeeded. Some data may be unavailable.`;
    }

    const duration_ms = Date.now() - overallStart;

    const report: TestReport = {
      status,
      summary,
      duration_ms,
      results,
      counts,
      errors,
    };

    console.log(`[CLOVER-TEST-HARNESS] Test complete: ${status} in ${duration_ms}ms`);

    // Save test result to database
    await saveTestResult(supabaseClient, userData.tenant_id, connection.id, merchantId, user.id, report);

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[CLOVER-TEST-HARNESS] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function saveTestResult(
  supabase: any,
  tenantId: string,
  connectionId: string,
  merchantId: string,
  userId: string,
  report: TestReport
) {
  try {
    // Insert test result
    const { error: insertError } = await supabase
      .from('clover_connection_tests')
      .insert({
        tenant_id: tenantId,
        connection_id: connectionId,
        merchant_id: merchantId,
        status: report.status,
        summary: report.summary,
        raw_results: report.results,
        counts: report.counts,
        errors: report.errors,
        duration_ms: report.duration_ms,
        tested_by: userId,
      });

    if (insertError) {
      console.error('[CLOVER-TEST-HARNESS] Failed to save test result:', insertError);
    }

    // Update connection with last test info
    const { error: updateError } = await supabase
      .from('clover_connections')
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: report.status,
      })
      .eq('id', connectionId);

    if (updateError) {
      console.error('[CLOVER-TEST-HARNESS] Failed to update connection:', updateError);
    }
  } catch (err: any) {
    console.error('[CLOVER-TEST-HARNESS] Error saving test result:', err.message);
  }
}
