-- A live grant must own a source sale claim; a repeat can never create another sale.
begin;
insert into public.lightspeed_storefront_grants
(id,site_id,state_hash,prefix,public_key,expires_at,status,token_ciphertext,
 retailer_id,currency,token_expires_at)
values(
 '193e1fb1-78bf-4a56-b797-e30227c7a37f',
 'ecee4ff0-2534-491f-98b2-3b63a0639f43',
 repeat('A',43),'test-merchant',
 '{"kty":"EC","crv":"P-256","x":"test","y":"test"}'::jsonb,
 now()+interval '1 hour','active','encrypted-placeholder','retailer','CAD',now()+interval '1 hour'
);
set role authenticated;
do $$
begin
  begin
    perform public.lightspeed_authority_sale_claim_v1(
      '193e1fb1-78bf-4a56-b797-e30227c7a37f',
      'ecee4ff0-2534-491f-98b2-3b63a0639f43',
      'ac620a49-e05f-456b-ae40-e8ebd31b4b3a'
    );
    raise exception 'authenticated claim was permitted';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
set role service_role;
do $$
declare ok boolean;
begin
  begin
    perform public.lightspeed_authority_sale_claim_v1(
      '193e1fb1-78bf-4a56-b797-e30227c7a37f',
      '11111111-1111-4111-8111-111111111111',
      'ac620a49-e05f-456b-ae40-e8ebd31b4b3a'
    );
    raise exception 'cross-site sale claim was permitted';
  exception when insufficient_privilege then null;
  end;
  ok:=public.lightspeed_authority_sale_claim_v1(
    '193e1fb1-78bf-4a56-b797-e30227c7a37f',
    'ecee4ff0-2534-491f-98b2-3b63a0639f43',
    'ac620a49-e05f-456b-ae40-e8ebd31b4b3a'
  );
  if not ok then raise exception 'first sale claim did not succeed'; end if;
  ok:=public.lightspeed_authority_sale_claim_v1(
    '193e1fb1-78bf-4a56-b797-e30227c7a37f',
    'ecee4ff0-2534-491f-98b2-3b63a0639f43',
    'ac620a49-e05f-456b-ae40-e8ebd31b4b3a'
  );
  if ok then raise exception 'duplicate sale claim succeeded'; end if;
  perform public.lightspeed_authority_sale_finish_v1(
    '193e1fb1-78bf-4a56-b797-e30227c7a37f',
    'ac620a49-e05f-456b-ae40-e8ebd31b4b3a',
    'confirmed','ab86a10a-0b34-4e68-a039-a352fb3c3d63'
  );
  if not exists(
    select 1 from public.lightspeed_storefront_sale_exports
    where source_order_id='ac620a49-e05f-456b-ae40-e8ebd31b4b3a'
      and status='confirmed' and provider_sale_id='ab86a10a-0b34-4e68-a039-a352fb3c3d63'
  ) then raise exception 'confirmed sale not persisted'; end if;
end $$;
reset role;
rollback;
