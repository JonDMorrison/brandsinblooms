-- Bloom follows the master-admin workspace switch.
-- A master admin working inside a client (admin_session_context) can use Bloom
-- there with the same tenant scope the CRM already grants via has_tenant_permission.
-- Regular users are unchanged: they still match on users.tenant_id.
-- Conversation, message, export and profile rows stay owned by auth.uid().
-- The bloom-uploads storage policies are recreated too. Their unqualified
-- `name` resolved to public.users.name instead of storage.objects.name, so no
-- upload could ever match (the bucket has zero objects). They now use
-- objects.name explicitly.

CREATE OR REPLACE FUNCTION public.bloom_can_access_tenant(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_tenant_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.tenant_id = p_tenant_id
    )
    OR (
      coalesce(public.is_master_admin(auth.uid()), false)
      AND EXISTS (
        SELECT 1 FROM public.admin_session_context context
        WHERE context.admin_user_id = auth.uid()
          AND context.active_tenant_id = p_tenant_id
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.bloom_can_access_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bloom_can_access_tenant(uuid) TO authenticated, service_role;

DROP POLICY bloom_audit_log_insert_tenant ON public.bloom_audit_log;
CREATE POLICY bloom_audit_log_insert_tenant ON public.bloom_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.bloom_can_access_tenant(bloom_audit_log.tenant_id));

DROP POLICY bloom_audit_log_select_tenant ON public.bloom_audit_log;
CREATE POLICY bloom_audit_log_select_tenant ON public.bloom_audit_log FOR SELECT TO authenticated
  USING (public.bloom_can_access_tenant(bloom_audit_log.tenant_id));

DROP POLICY bloom_conversation_exports_delete_own ON public.bloom_conversation_exports;
CREATE POLICY bloom_conversation_exports_delete_own ON public.bloom_conversation_exports FOR DELETE TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_conversation_exports.tenant_id));

DROP POLICY bloom_conversations_delete_own ON public.bloom_conversations;
CREATE POLICY bloom_conversations_delete_own ON public.bloom_conversations FOR DELETE TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_conversations.tenant_id));

DROP POLICY bloom_user_profiles_delete_own ON public.bloom_user_profiles;
CREATE POLICY bloom_user_profiles_delete_own ON public.bloom_user_profiles FOR DELETE TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_user_profiles.tenant_id));

DROP POLICY bloom_conversation_exports_insert_own ON public.bloom_conversation_exports;
CREATE POLICY bloom_conversation_exports_insert_own ON public.bloom_conversation_exports FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_conversation_exports.tenant_id));

DROP POLICY bloom_conversations_insert_own ON public.bloom_conversations;
CREATE POLICY bloom_conversations_insert_own ON public.bloom_conversations FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_conversations.tenant_id));

DROP POLICY bloom_user_profiles_insert_own ON public.bloom_user_profiles;
CREATE POLICY bloom_user_profiles_insert_own ON public.bloom_user_profiles FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_user_profiles.tenant_id));

DROP POLICY bloom_conversation_exports_select_own ON public.bloom_conversation_exports;
CREATE POLICY bloom_conversation_exports_select_own ON public.bloom_conversation_exports FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_conversation_exports.tenant_id));

DROP POLICY bloom_conversations_select_own ON public.bloom_conversations;
CREATE POLICY bloom_conversations_select_own ON public.bloom_conversations FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_conversations.tenant_id));

DROP POLICY bloom_user_profiles_select_own ON public.bloom_user_profiles;
CREATE POLICY bloom_user_profiles_select_own ON public.bloom_user_profiles FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_user_profiles.tenant_id));

DROP POLICY bloom_conversation_exports_update_own ON public.bloom_conversation_exports;
CREATE POLICY bloom_conversation_exports_update_own ON public.bloom_conversation_exports FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_conversation_exports.tenant_id))
  WITH CHECK ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_conversation_exports.tenant_id));

DROP POLICY bloom_conversations_update_own ON public.bloom_conversations;
CREATE POLICY bloom_conversations_update_own ON public.bloom_conversations FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_conversations.tenant_id))
  WITH CHECK ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_conversations.tenant_id));

DROP POLICY bloom_user_profiles_update_own ON public.bloom_user_profiles;
CREATE POLICY bloom_user_profiles_update_own ON public.bloom_user_profiles FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_user_profiles.tenant_id))
  WITH CHECK ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_user_profiles.tenant_id));

DROP POLICY bloom_messages_delete_own ON public.bloom_messages;
CREATE POLICY bloom_messages_delete_own ON public.bloom_messages FOR DELETE TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_messages.tenant_id));

DROP POLICY bloom_messages_select_own ON public.bloom_messages;
CREATE POLICY bloom_messages_select_own ON public.bloom_messages FOR SELECT TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_messages.tenant_id));

DROP POLICY bloom_messages_insert_own ON public.bloom_messages;
CREATE POLICY bloom_messages_insert_own ON public.bloom_messages FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_messages.tenant_id) AND EXISTS (SELECT 1 FROM public.bloom_conversations c WHERE c.id = bloom_messages.conversation_id AND c.user_id = auth.uid() AND c.tenant_id = bloom_messages.tenant_id));

DROP POLICY bloom_messages_update_own ON public.bloom_messages;
CREATE POLICY bloom_messages_update_own ON public.bloom_messages FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_messages.tenant_id))
  WITH CHECK ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_messages.tenant_id) AND EXISTS (SELECT 1 FROM public.bloom_conversations c WHERE c.id = bloom_messages.conversation_id AND c.user_id = auth.uid() AND c.tenant_id = bloom_messages.tenant_id));

DROP POLICY bloom_knowledge_chunks_select_tenant ON public.bloom_knowledge_chunks;
CREATE POLICY bloom_knowledge_chunks_select_tenant ON public.bloom_knowledge_chunks FOR SELECT TO authenticated
  USING (public.bloom_can_access_tenant(bloom_knowledge_chunks.tenant_id));

DROP POLICY bloom_knowledge_documents_select_tenant ON public.bloom_knowledge_documents;
CREATE POLICY bloom_knowledge_documents_select_tenant ON public.bloom_knowledge_documents FOR SELECT TO authenticated
  USING (public.bloom_can_access_tenant(bloom_knowledge_documents.tenant_id));

DROP POLICY bloom_knowledge_documents_delete_tenant ON public.bloom_knowledge_documents;
CREATE POLICY bloom_knowledge_documents_delete_tenant ON public.bloom_knowledge_documents FOR DELETE TO authenticated
  USING (public.bloom_can_access_tenant(bloom_knowledge_documents.tenant_id));

DROP POLICY bloom_knowledge_documents_update_tenant ON public.bloom_knowledge_documents;
CREATE POLICY bloom_knowledge_documents_update_tenant ON public.bloom_knowledge_documents FOR UPDATE TO authenticated
  USING (public.bloom_can_access_tenant(bloom_knowledge_documents.tenant_id))
  WITH CHECK (public.bloom_can_access_tenant(bloom_knowledge_documents.tenant_id));

DROP POLICY bloom_knowledge_documents_insert_tenant ON public.bloom_knowledge_documents;
CREATE POLICY bloom_knowledge_documents_insert_tenant ON public.bloom_knowledge_documents FOR INSERT TO authenticated
  WITH CHECK ((auth.uid() = user_id) AND public.bloom_can_access_tenant(bloom_knowledge_documents.tenant_id));

DROP POLICY bloom_proactive_insights_select_tenant ON public.bloom_proactive_insights;
CREATE POLICY bloom_proactive_insights_select_tenant ON public.bloom_proactive_insights FOR SELECT TO authenticated
  USING (public.bloom_can_access_tenant(bloom_proactive_insights.tenant_id));

DROP POLICY bloom_proactive_insights_update_dismissed_by ON public.bloom_proactive_insights;
CREATE POLICY bloom_proactive_insights_update_dismissed_by ON public.bloom_proactive_insights FOR UPDATE TO authenticated
  USING (public.bloom_can_access_tenant(bloom_proactive_insights.tenant_id))
  WITH CHECK (public.bloom_can_access_tenant(bloom_proactive_insights.tenant_id) AND auth.uid() = ANY (dismissed_by));

DROP POLICY bloom_tool_executions_insert_tenant ON public.bloom_tool_executions;
CREATE POLICY bloom_tool_executions_insert_tenant ON public.bloom_tool_executions FOR INSERT TO authenticated
  WITH CHECK (public.bloom_can_access_tenant(bloom_tool_executions.tenant_id));

DROP POLICY bloom_tool_executions_select_tenant ON public.bloom_tool_executions;
CREATE POLICY bloom_tool_executions_select_tenant ON public.bloom_tool_executions FOR SELECT TO authenticated
  USING (public.bloom_can_access_tenant(bloom_tool_executions.tenant_id));

-- Storage folder names are text; only a well-formed UUID is checked.
CREATE OR REPLACE FUNCTION public.bloom_can_access_tenant_folder(p_folder text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.bloom_can_access_tenant(p_folder::uuid)
    ELSE false
  END;
$$;

REVOKE ALL ON FUNCTION public.bloom_can_access_tenant_folder(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bloom_can_access_tenant_folder(text) TO authenticated, service_role;

DROP POLICY "Tenant users can read Bloom attachments" ON storage.objects;
CREATE POLICY "Tenant users can read Bloom attachments" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bloom-uploads'
    AND public.bloom_can_access_tenant_folder((storage.foldername(objects.name))[1])
  );

DROP POLICY "Tenant users can upload Bloom attachments" ON storage.objects;
CREATE POLICY "Tenant users can upload Bloom attachments" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bloom-uploads'
    AND public.bloom_can_access_tenant_folder((storage.foldername(objects.name))[1])
    AND (
      EXISTS (
        SELECT 1 FROM public.bloom_conversations c
        WHERE c.user_id = auth.uid()
          AND c.tenant_id::text = (storage.foldername(objects.name))[1]
          AND c.id::text = (storage.foldername(objects.name))[2]
      )
      OR EXISTS (
        SELECT 1 FROM public.bloom_knowledge_documents d
        WHERE d.tenant_id::text = (storage.foldername(objects.name))[1]
          AND (storage.foldername(objects.name))[2] = 'knowledge'
          AND d.id::text = (storage.foldername(objects.name))[3]
          AND d.source_file = objects.name
      )
    )
  );

DROP POLICY "Tenant users can delete their Bloom attachments" ON storage.objects;
CREATE POLICY "Tenant users can delete their Bloom attachments" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'bloom-uploads'
    AND public.bloom_can_access_tenant_folder((storage.foldername(objects.name))[1])
    AND (
      EXISTS (
        SELECT 1 FROM public.bloom_conversations c
        WHERE c.user_id = auth.uid()
          AND c.tenant_id::text = (storage.foldername(objects.name))[1]
          AND c.id::text = (storage.foldername(objects.name))[2]
      )
      OR EXISTS (
        SELECT 1 FROM public.bloom_knowledge_documents d
        WHERE d.tenant_id::text = (storage.foldername(objects.name))[1]
          AND (storage.foldername(objects.name))[2] = 'knowledge'
          AND d.id::text = (storage.foldername(objects.name))[3]
      )
    )
  );

-- Knowledge search uses the same access rule, so an admin in a client
-- workspace searches that client's knowledge base. Body otherwise unchanged.
CREATE OR REPLACE FUNCTION public.match_bloom_knowledge_chunks(p_tenant_id uuid, p_query_embedding vector, p_match_count integer DEFAULT 5, p_min_similarity double precision DEFAULT 0)
 RETURNS TABLE(chunk_id uuid, document_id uuid, tenant_id uuid, document_title text, chunk_index integer, content text, metadata jsonb, similarity double precision)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.tenant_id,
    d.title AS document_title,
    c.chunk_index,
    c.content,
    c.metadata,
    1 - (c.embedding <=> p_query_embedding) AS similarity
  FROM public.bloom_knowledge_chunks c
  JOIN public.bloom_knowledge_documents d
    ON d.id = c.document_id
   AND d.tenant_id = c.tenant_id
  WHERE c.tenant_id = p_tenant_id
    AND d.status = 'ready'
    AND (
      auth.role() = 'service_role'
      OR public.bloom_can_access_tenant(p_tenant_id)
    )
    AND 1 - (c.embedding <=> p_query_embedding) >= COALESCE(p_min_similarity, 0)
  ORDER BY c.embedding <=> p_query_embedding
  LIMIT LEAST(GREATEST(COALESCE(p_match_count, 5), 1), 20);
$function$;
