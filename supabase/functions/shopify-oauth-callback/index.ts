import { createClient } from 'npm:@supabase/supabase-js@2';
import { assertEncryptionKeyConfigured, encryptToken } from '../_shared/crypto/tokens.ts';

function getSiteUrl() {
  const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('APP_BASE_URL');
  if (siteUrl && siteUrl.startsWith('http')) {
    return siteUrl.replace(/\/$/, '');
  }
  return 'https://bloomsuite.app';
}

function buildCallbackRedirect(status: 'success' | 'error', params: Record<string, string | null | undefined>) {
  const url = new URL('/integrations/shopify/callback', getSiteUrl());
  url.searchParams.set('status', status);

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length > 0) {
      url.searchParams.set(key, value);
    }
  });

  return url;
}

function normalizeShopDomain(shop: string | null) {
  return shop?.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') ?? '';
}

function isValidShopifyDomain(shopDomain: string) {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shopDomain);
}

async function verifyShopifyHmac(params: URLSearchParams, secret: string) {
  const providedHmac = params.get('hmac');
  if (!providedHmac) {
    return false;
  }

  const message = Array.from(params.entries())
    .filter(([key]) => key !== 'hmac' && key !== 'signature')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  const computedHmac = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  if (computedHmac.length !== providedHmac.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < computedHmac.length; index += 1) {
    mismatch |= computedHmac.charCodeAt(index) ^ providedHmac.charCodeAt(index);
  }

  return mismatch === 0;
}

async function cleanupPendingConnectionForState(
  supabase: any,
  stateToken: string | null,
  shopDomain: string | null,
) {
  if (!stateToken) {
    return;
  }

  const { data: stateRow } = await supabase
    .from('oauth_states')
    .select('tenant_id, domain_prefix')
    .eq('state_token', stateToken)
    .eq('provider', 'shopify')
    .maybeSingle();

  if (!stateRow?.tenant_id) {
    return;
  }

  const pendingShop = normalizeShopDomain(shopDomain) || stateRow.domain_prefix;
  if (!pendingShop) {
    return;
  }

  await supabase
    .from('shopify_connections')
    .delete()
    .eq('tenant_id', stateRow.tenant_id)
    .eq('shop_domain', pendingShop)
    .eq('status', 'pending');
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const params = url.searchParams;
  const stateToken = params.get('state');
  const shop = normalizeShopDomain(params.get('shop'));

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  try {
    assertEncryptionKeyConfigured();

    const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
    const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
    if (!clientSecret || !clientId) {
      return Response.redirect(
        buildCallbackRedirect('error', {
          message: 'Shopify OAuth is not configured on this environment.',
        }).toString(),
        302,
      );
    }

    if (!isValidShopifyDomain(shop)) {
      return Response.redirect(
        buildCallbackRedirect('error', {
          message: 'Invalid Shopify store domain received from Shopify.',
        }).toString(),
        302,
      );
    }

    const hmacValid = await verifyShopifyHmac(params, clientSecret);
    if (!hmacValid) {
      await cleanupPendingConnectionForState(supabase, stateToken, shop);
      return new Response('Invalid HMAC', { status: 401 });
    }

    const code = params.get('code');
    if (!code || !stateToken) {
      return Response.redirect(
        buildCallbackRedirect('error', {
          message: 'Missing required Shopify OAuth parameters.',
        }).toString(),
        302,
      );
    }

    const { data: oauthState, error: stateError } = await supabase
      .from('oauth_states')
      .select('tenant_id, user_id, domain_prefix, expires_at')
      .eq('state_token', stateToken)
      .eq('provider', 'shopify')
      .maybeSingle();

    if (stateError || !oauthState) {
      await cleanupPendingConnectionForState(supabase, stateToken, shop);
      return Response.redirect(
        buildCallbackRedirect('error', {
          message: 'Invalid or expired Shopify authorization state. Please try again.',
        }).toString(),
        302,
      );
    }

    if (new Date(oauthState.expires_at) < new Date()) {
      await cleanupPendingConnectionForState(supabase, stateToken, shop);
      return Response.redirect(
        buildCallbackRedirect('error', {
          message: 'Your Shopify authorization request expired. Please try again.',
        }).toString(),
        302,
      );
    }

    const expectedShop = normalizeShopDomain(oauthState.domain_prefix);
    if (expectedShop && expectedShop !== shop) {
      await cleanupPendingConnectionForState(supabase, stateToken, expectedShop);
      return Response.redirect(
        buildCallbackRedirect('error', {
          message: 'Shopify redirected back with a mismatched store domain.',
        }).toString(),
        302,
      );
    }

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return Response.redirect(
        buildCallbackRedirect('error', {
          message: `Shopify token exchange failed: ${errorText}`,
        }).toString(),
        302,
      );
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      scope?: string;
    };

    if (!tokenData.access_token) {
      return Response.redirect(
        buildCallbackRedirect('error', {
          message: 'Shopify did not return an access token.',
        }).toString(),
        302,
      );
    }

    const shopResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': tokenData.access_token,
      },
    });

    if (!shopResponse.ok) {
      const errorText = await shopResponse.text();
      return Response.redirect(
        buildCallbackRedirect('error', {
          message: `Shopify shop lookup failed: ${errorText}`,
        }).toString(),
        302,
      );
    }

    const shopPayload = (await shopResponse.json()) as {
      shop?: {
        name?: string;
        shop_owner?: string;
        email?: string;
      };
    };

    const shopData = shopPayload.shop ?? {};
    const encryptedAccessToken = await encryptToken(tokenData.access_token);

    const { error: updateError } = await supabase
      .from('shopify_connections')
      .update({
        shop_name: shopData.name ?? null,
        shop_owner: shopData.shop_owner ?? null,
        shop_email: shopData.email ?? null,
        encrypted_access_token: encryptedAccessToken,
        scope: tokenData.scope ?? null,
        status: 'connected',
        connected_at: new Date().toISOString(),
      })
      .eq('tenant_id', oauthState.tenant_id)
      .eq('user_id', oauthState.user_id)
      .eq('shop_domain', shop);

    if (updateError) {
      return Response.redirect(
        buildCallbackRedirect('error', {
          message: `Failed to save Shopify connection: ${updateError.message}`,
        }).toString(),
        302,
      );
    }

    try {
      await supabase.functions.invoke('shopify-ensure-webhooks', {
        body: { shop_domain: shop, tenant_id: oauthState.tenant_id },
      });
    } catch (webhookError: any) {
      console.warn('[SHOPIFY-OAUTH-CALLBACK] Webhook setup failed (non-blocking):', webhookError.message);
    }

    return Response.redirect(
      buildCallbackRedirect('success', {
        shop,
        shop_name: shopData.name ?? shop,
        connected: '1',
      }).toString(),
      302,
    );
  } catch (error: any) {
    return Response.redirect(
      buildCallbackRedirect('error', {
        message: error.message,
      }).toString(),
      302,
    );
  } finally {
    if (stateToken) {
      await supabase.from('oauth_states').delete().eq('state_token', stateToken);
    }
  }
});