export interface IdealSourceEventFact {
 customer_id:string;event_type:string;external_customer_code:string;external_transaction_id:string|null;
 coupon_code:string|null;points_delta:number|null;amount:number|null;occurred_at:string|null;expires_at:string|null;
}
/** Legacy fingerprints omit expiry and points delta. A collision is not proof of equality. */
export function sameIdealSourceEvent(prior:Record<string,unknown>,expected:IdealSourceEventFact):boolean{
 for(const key of ['customer_id','event_type','external_customer_code','external_transaction_id','coupon_code'] as const)if((prior[key]??null)!==expected[key])return false;
 for(const key of ['points_delta','amount'] as const){const value=prior[key];if(value===null||value===undefined){if(expected[key]!==null)return false;}else if((typeof value!=='number'&&typeof value!=='string')||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)!==expected[key])return false;}
 for(const key of ['occurred_at','expires_at'] as const){const value=prior[key];if(value===null||value===undefined){if(expected[key]!==null)return false;}else if(typeof value!=='string'||expected[key]===null||!Number.isFinite(Date.parse(value))||Date.parse(value)!==Date.parse(expected[key]!))return false;}
 return true;
}
