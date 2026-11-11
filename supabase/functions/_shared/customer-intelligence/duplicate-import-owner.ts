import type {PersistenceClient} from '../../bloom-assist/types.ts';

/** A matching fact is usable only when its owning import is usable too. */
export async function requireUsableIdealDuplicateOwner(
  client:Pick<PersistenceClient,'from'>,
  tenantId:string,
  ownerImportId:unknown,
  currentImportId:string,
):Promise<void>{
  if(typeof ownerImportId!=='string'||!ownerImportId||!tenantId||!currentImportId)
    throw new Error('Duplicate source has no verifiable import owner; recovery review required');
  const {data,error}=await client.from('customer_intelligence_imports')
    .select('id,tenant_id,source,status').eq('id',ownerImportId)
    .eq('tenant_id',tenantId).eq('source','ideal').maybeSingle();
  if(error||!data||data.id!==ownerImportId||data.tenant_id!==tenantId||data.source!=='ideal'
    ||!(data.status==='completed'||(data.id===currentImportId&&data.status==='processing')))
    throw new Error('Duplicate source belongs to an unverified or incomplete import; recovery review required');
}
