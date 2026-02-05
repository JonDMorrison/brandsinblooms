-- Ensure PostgREST picks up newly created/updated RPCs.

NOTIFY pgrst, 'reload schema';
