/** A file hash is a replay guard, not proof an interrupted import completed. */
export function completedIdealImportReplay(existing:{status?:unknown}|null):'new'|'completed'|'recovery_required'{
 if(!existing)return 'new';
 return existing.status==='completed'?'completed':'recovery_required';
}
