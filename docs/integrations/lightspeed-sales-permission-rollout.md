# Lightspeed sales permission rollout

Lightspeed product and inventory access remains read-only unless sales permissions are explicitly requested and approved.

## Controls

- `LIGHTSPEED_SALES_SCOPE_REQUEST_ENABLED`: master switch for requesting the additional X-Series scopes. It defaults to off.
- `LIGHTSPEED_SALES_SCOPE_SITE_IDS`: comma-separated BloomSites UUIDs allowed to request those scopes. An empty list allows no site to request them.
- `LIGHTSPEED_SALES_WRITE_ENABLED`: separate master switch for the signed sale endpoint. Keep off until account mapping and controlled order verification pass.
- BloomSites `LIGHTSPEED_SALES_EXPORT_ENABLED`: separate outbox switch. Keep off until checkout, merchant approval, and the handoff checks pass.

The authority requests the extra scopes only when the master switch is on and the trusted CMS site ID is in the allowlist. It does not accept site IDs from the browser request. Enabling scope consent does not enable sale creation; the sale endpoint still requires `LIGHTSPEED_SALES_WRITE_ENABLED=true`, a grant containing the required sales scopes, a valid signed CMS request, and the durable one-shot order claim.

For Scott's, the allowlist candidate is site `ecee4ff0-2534-491f-98b2-3b63a0639f43`. Do not add it or turn on either write/export switch until an authorized operator completes the permission rollout and the register/payment/tax mapping is verified.

## Safe rollout

1. Confirm the Lightspeed developer application supports the requested scopes and its callback is registered.
2. Set the scope-request master switch on and add only the approved site UUID to the scope allowlist.
3. Have an authorized merchant admin complete the OAuth consent in Lightspeed.
4. Verify the grant contains the scopes and read the approved register, outlet, tax and external payment configuration.
5. Keep sale writing and the BloomSites outbox off until a controlled paid-order verification is approved and complete.
6. Enable the two write switches only after the preceding gates pass.

All controls are server-side. Never expose credentials, tokens, or privileged write settings in the storefront.
