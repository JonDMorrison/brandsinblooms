export type CertificationSummary = {version:number;tenantId:string;sourceSha256:string;reportFamily:string;status:string;committable:false;observedRows:number;sourceReviewableRows:number;reasons:Array<{code:string;count:number}>};
export function createSourceCertificationGate(context:{tenantId:string;sourceSha256:string;reportFamily:string}):{observe(row:Record<string,unknown>):void;finish():CertificationSummary};
export function validateReceiptEvidence(proof:unknown,observation:unknown,context:unknown):{status:string;committable:false;reasons:string[]};
