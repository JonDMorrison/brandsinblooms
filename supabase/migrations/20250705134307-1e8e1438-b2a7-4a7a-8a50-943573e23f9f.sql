-- Add JSON schema validation for attachments column
ALTER TABLE content_tasks 
ADD CONSTRAINT attachments_schema_check 
CHECK (
  attachments IS NULL OR (
    jsonb_typeof(attachments) = 'object' AND
    (
      attachments ? 'image' = false OR
      (
        jsonb_typeof(attachments->'image') = 'object' AND
        attachments->'image' ? 'type' AND
        attachments->'image' ? 'source' AND
        attachments->'image' ? 'url' AND
        attachments->'image' ? 'alt' AND
        attachments->'image' ? 'author_name'
      )
    )
  )
);