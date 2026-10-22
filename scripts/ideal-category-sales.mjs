// Verified IdealPOS sales-category/department report, not product-level evidence.
export function createCategorySalesNormalizer(){
 let header=false,bands=false,columns=false,customer=null,category=null,group=null,grand=null,groups=0;const failures=[];
 const numeric=v=>typeof v==='number'&&Number.isFinite(v);
 const equal=(a,b)=>a.cents===b.cents&&Math.abs(a.quantity-b.quantity)<0.00001;
 const total=r=>({quantity:r[7],cents:Math.round(r[9]*100)});
 const finishGroup=()=>{if(!group)return;if(category||!group.closed)failures.push('Missing category or customer subtotal');groups++;group=null;category=null;};
 return {row(r,location,period){
 if(location.format!=='worksheet')throw Error('Category sales requires the verified worksheet layout');
 if(location.row===1){header=r[5]==='Customer Sales Report';bands=false;columns=false;if(!header)throw Error('Unexpected category sales title');return null;}
 if(location.row===9){bands=r[7]==='Sales'&&r[12]==='Profit';if(!bands)throw Error('Unexpected category sales bands');return null;}
 if(location.row===10){columns=r[0]==='Code'&&r[2]==='Description'&&r[7]==='Quantity'&&r[9]==='Amount'&&r[11]==='%'&&r[13]==='Amount'&&r[15]==='%';if(!columns)throw Error('Unexpected category sales columns');return null;}
 if(location.row<12)return null;
 if(!header||!bands||!columns)throw Error('Unverified category sales layout');
 if(r.every(v=>v===null||v===undefined||v===''))return null;
 if(grand)throw Error('Unexpected rows after category grand total');
 const a=String(r[0]??'');const match=/^Customer\s+(.+?)\s+-\s+/.exec(a);
 if(match){finishGroup();customer=match[1];group={cents:0,quantity:0,closed:false};return null;}
 const cat=/^Sales Category (\d+)\s+(.+)$/.exec(a);
 if(cat){if(!group||group.closed||category)throw Error('Unassigned or unclosed sales category');category={code:cat[1],name:cat[2],cents:0,quantity:0};return null;}
 if(r[6]==='Grand Total'){
 if(!numeric(r[8])||!numeric(r[10]))throw Error('Invalid category grand total');finishGroup();grand={quantity:r[8],cents:Math.round(r[10]*100)};return null;
 }
 if(r[1]!==null&&r[1]!==undefined&&typeof r[2]==='string'){
 if(!category||!group||group.closed||!numeric(r[8])||!numeric(r[10])||!(typeof r[1]==='string'||numeric(r[1])))throw Error('Invalid category department row');
 const quantity=r[8],amountCents=Math.round(r[10]*100);category.quantity+=quantity;category.cents+=amountCents;group.quantity+=quantity;group.cents+=amountCents;
 return {kind:'category_department_summary',customerCode:customer,fields:{categoryCode:category.code,category:category.name,departmentCode:String(r[1]),department:r[2],quantity,amountCents,...period},committable:false};
 }
 if(numeric(r[7])&&numeric(r[9])&&numeric(r[11])){
 if(category){if(!equal(category,total(r)))failures.push('Category subtotal mismatch');category=null;}
 else if(group&&!group.closed){if(!equal(group,total(r)))failures.push('Customer subtotal mismatch');group.closed=true;}
 else throw Error('Unexpected duplicate category subtotal');return null;
 }
 throw Error('Unsupported category sales row');
 },finish(){finishGroup();return {groupCount:groups,grandTotal:grand,failures};}};
}
