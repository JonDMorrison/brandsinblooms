import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BLOOM_UPLOADS_BUCKET,
  resolveBloomKnowledgeDocumentFile,
  sanitizeBloomStorageFilename,
  type BloomKnowledgeFileType,
} from "@/components/bloom/bloomFileUtils";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/config";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  bloomSupabase,
  toBloomKnowledgeDocument,
  type BloomKnowledgeDocument,
  type BloomKnowledgeDocumentRow,
} from "@/hooks/bloom/types";

const BLOOM_KNOWLEDGE_STALE_TIME_MS = 30_000;

const BLOOM_KNOWLEDGE_DOCUMENT_COLUMNS =
  "id, tenant_id, user_id, title, content, chunk_count, status, error_message, source_file, file_type, processing_progress, metadata, processed_at, created_at, updated_at";

export const bloomKnowledgeDocumentsQueryKey = (tenantId: string | null) =>
  ["bloom-knowledge", tenantId] as const;

interface UploadKnowledgeDocumentInput {
  file: File;
  title: string;
  documentId: string;
  storagePath: string;
  fileType: BloomKnowledgeFileType;
  mimeType: string;
  onUploadProgress?: (progress: number) => void;
}

interface UploadKnowledgeDocumentOptions {
  onUploadProgress?: (progress: number) => void;
}

interface RenameKnowledgeDocumentInput {
  documentId: string;
  title: string;
}

interface DeleteKnowledgeDocumentInput {
  document: BloomKnowledgeDocument;
}

interface KnowledgeDocumentsMutationContext {
  previousDocuments: BloomKnowledgeDocument[] | undefined;
}

class BloomKnowledgeUploadError extends Error {
  documentWasCreated: boolean;

  constructor(message: string, documentWasCreated: boolean) {
    super(message);
    this.name = "BloomKnowledgeUploadError";
    this.documentWasCreated = documentWasCreated;
  }
}

const uploadUrlForPath = (storagePath: string) => {
  const encodedPath = storagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${SUPABASE_URL}/storage/v1/object/${BLOOM_UPLOADS_BUCKET}/${encodedPath}`;
};

const readUploadErrorMessage = (xhr: XMLHttpRequest) => {
  const fallback = `Upload failed with status ${xhr.status}.`;
  if (!xhr.responseText) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(xhr.responseText) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof parsed.message === "string"
    ) {
      return parsed.message;
    }
  } catch {
    return xhr.responseText.slice(0, 160) || fallback;
  }

  return fallback;
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

const sortKnowledgeDocuments = (documents: BloomKnowledgeDocument[]) =>
  [...documents].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );

const insertCachedDocument = (
  documents: BloomKnowledgeDocument[] | undefined,
  document: BloomKnowledgeDocument,
) => sortKnowledgeDocuments([document, ...(documents ?? [])]);

const upsertCachedDocument = (
  documents: BloomKnowledgeDocument[] | undefined,
  document: BloomKnowledgeDocument,
) => {
  const currentDocuments = documents ?? [];
  const documentExists = currentDocuments.some(
    (currentDocument) => currentDocument.id === document.id,
  );

  if (!documentExists) {
    return sortKnowledgeDocuments([document, ...currentDocuments]);
  }

  return sortKnowledgeDocuments(
    currentDocuments.map((currentDocument) =>
      currentDocument.id === document.id ? document : currentDocument,
    ),
  );
};

const patchCachedDocument = (
  documents: BloomKnowledgeDocument[] | undefined,
  documentId: string,
  patch: Partial<BloomKnowledgeDocument>,
) =>
  documents?.map((document) =>
    document.id === documentId ? { ...document, ...patch } : document,
  );

const removeCachedDocument = (
  documents: BloomKnowledgeDocument[] | undefined,
  documentId: string,
) => documents?.filter((document) => document.id !== documentId);

const createOptimisticDocument = (
  input: UploadKnowledgeDocumentInput,
): BloomKnowledgeDocument => {
  const now = new Date().toISOString();

  return {
    id: input.documentId,
    title: input.title.trim(),
    content: null,
    status: "processing",
    chunkCount: 0,
    sourceFile: input.storagePath,
    fileType: input.fileType,
    processingProgress: 0,
    errorMessage: null,
    metadata: {
      original_filename: input.file.name,
      file_size_bytes: input.file.size,
      mime_type: input.mimeType,
    },
    processedAt: null,
    createdAt: now,
    updatedAt: now,
  };
};

const uploadKnowledgeFile = async ({
  accessToken,
  file,
  mimeType,
  onUploadProgress,
  storagePath,
}: {
  accessToken: string;
  file: File;
  mimeType: string;
  onUploadProgress?: (progress: number) => void;
  storagePath: string;
}) => {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) {
        return;
      }

      const nextProgress = Math.min(
        99,
        Math.round((event.loaded / event.total) * 100),
      );
      onUploadProgress?.(nextProgress);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error(readUploadErrorMessage(xhr)));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Try again."));
    xhr.onabort = () => reject(new Error("Upload canceled."));

    xhr.open("POST", uploadUrlForPath(storagePath));
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.setRequestHeader("Cache-Control", "3600");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.send(file);
  });
};

const selectKnowledgeDocument = async ({
  documentId,
  tenantId,
}: {
  documentId: string;
  tenantId: string;
}): Promise<BloomKnowledgeDocument> => {
  const { data, error } = await bloomSupabase
    .from("bloom_knowledge_documents")
    .select(BLOOM_KNOWLEDGE_DOCUMENT_COLUMNS)
    .eq("id", documentId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    throw error;
  }

  return toBloomKnowledgeDocument(data);
};

export function useBloomKnowledgeDocuments(
  tenantId: string | null | undefined,
) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const resolvedTenantId = tenantId ?? null;
  const knowledgeQueryKey = bloomKnowledgeDocumentsQueryKey(resolvedTenantId);

  const documentsQuery = useQuery({
    queryKey: knowledgeQueryKey,
    enabled: Boolean(userId && resolvedTenantId),
    staleTime: BLOOM_KNOWLEDGE_STALE_TIME_MS,
    refetchInterval: (query) => {
      const documents = query.state.data;
      return documents?.some(
        (document) =>
          document.status === "uploading" || document.status === "processing",
      )
        ? 5_000
        : false;
    },
    queryFn: async (): Promise<BloomKnowledgeDocument[]> => {
      if (!userId || !resolvedTenantId) {
        return [];
      }

      const { data, error } = await bloomSupabase
        .from("bloom_knowledge_documents")
        .select(BLOOM_KNOWLEDGE_DOCUMENT_COLUMNS)
        .eq("tenant_id", resolvedTenantId)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data ?? []).map(toBloomKnowledgeDocument);
    },
  });

  return {
    data: documentsQuery.data ?? [],
    isLoading: documentsQuery.isLoading,
    error: documentsQuery.error,
    isFetching: documentsQuery.isFetching,
    refetch: documentsQuery.refetch,
    query: documentsQuery,
  };
}

export function useBloomKnowledgeMutations() {
  const queryClient = useQueryClient();
  const { session, user } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const userId = user?.id ?? null;
  const accessToken = session?.access_token ?? null;
  const knowledgeQueryKey = bloomKnowledgeDocumentsQueryKey(tenantId);

  const setDocuments = (
    updater: (
      documents: BloomKnowledgeDocument[] | undefined,
    ) => BloomKnowledgeDocument[] | undefined,
  ) => {
    queryClient.setQueryData<BloomKnowledgeDocument[]>(
      knowledgeQueryKey,
      updater,
    );
  };

  const patchDocument = (
    documentId: string,
    patch: Partial<BloomKnowledgeDocument>,
  ) => {
    setDocuments((documents) =>
      patchCachedDocument(documents, documentId, patch),
    );
  };

  const uploadDocumentMutation = useMutation({
    mutationFn: async (
      input: UploadKnowledgeDocumentInput,
    ): Promise<BloomKnowledgeDocument> => {
      if (!tenantId || !userId || !accessToken) {
        throw new BloomKnowledgeUploadError(
          "Sign in and select an organization to upload documents.",
          false,
        );
      }

      let documentWasCreated = false;

      try {
        const metadata: Json = {
          original_filename: input.file.name,
          file_size_bytes: input.file.size,
          mime_type: input.mimeType,
        };

        const { error: insertError } = await bloomSupabase
          .from("bloom_knowledge_documents")
          .insert({
            id: input.documentId,
            tenant_id: tenantId,
            user_id: userId,
            title: input.title.trim(),
            source_file: input.storagePath,
            file_type: input.fileType,
            status: "uploading",
            chunk_count: 0,
            processing_progress: 0,
            metadata,
          })
          .select("id")
          .single();

        if (insertError) {
          throw insertError;
        }

        documentWasCreated = true;

        await uploadKnowledgeFile({
          accessToken,
          file: input.file,
          mimeType: input.mimeType,
          onUploadProgress: (progress) => {
            input.onUploadProgress?.(progress);
            patchDocument(input.documentId, {
              processingProgress: progress,
              updatedAt: new Date().toISOString(),
            });
          },
          storagePath: input.storagePath,
        });

        input.onUploadProgress?.(100);
        patchDocument(input.documentId, {
          processingProgress: 10,
          status: "processing",
          updatedAt: new Date().toISOString(),
        });

        const { data: processingRow, error: processingError } =
          await bloomSupabase
            .from("bloom_knowledge_documents")
            .update({
              status: "processing",
              processing_progress: 10,
              error_message: null,
            })
            .eq("id", input.documentId)
            .eq("tenant_id", tenantId)
            .select(BLOOM_KNOWLEDGE_DOCUMENT_COLUMNS)
            .single();

        if (processingError) {
          throw processingError;
        }

        patchDocument(
          input.documentId,
          toBloomKnowledgeDocument(processingRow),
        );

        const { error: ingestError } = await supabase.functions.invoke(
          "bloom-knowledge-ingest",
          {
            body: {
              document_id: input.documentId,
              tenant_id: tenantId,
              storage_path: input.storagePath,
              file_type: input.fileType,
            },
          },
        );

        if (ingestError) {
          throw ingestError;
        }

        return selectKnowledgeDocument({
          documentId: input.documentId,
          tenantId,
        });
      } catch (error) {
        const message = toErrorMessage(error);

        if (documentWasCreated) {
          await bloomSupabase
            .from("bloom_knowledge_documents")
            .update({
              status: "failed",
              error_message: message,
              processing_progress: 0,
            })
            .eq("id", input.documentId)
            .eq("tenant_id", tenantId);
        }

        throw new BloomKnowledgeUploadError(message, documentWasCreated);
      }
    },
    onMutate: async (input): Promise<KnowledgeDocumentsMutationContext> => {
      await queryClient.cancelQueries({ queryKey: knowledgeQueryKey });
      const previousDocuments =
        queryClient.getQueryData<BloomKnowledgeDocument[]>(knowledgeQueryKey);

      setDocuments((documents) =>
        insertCachedDocument(documents, createOptimisticDocument(input)),
      );

      return { previousDocuments };
    },
    onError: (error, variables, context) => {
      if (
        error instanceof BloomKnowledgeUploadError &&
        error.documentWasCreated
      ) {
        patchDocument(variables.documentId, {
          errorMessage: error.message,
          processingProgress: 0,
          status: "failed",
          updatedAt: new Date().toISOString(),
        });
      } else {
        queryClient.setQueryData(knowledgeQueryKey, context?.previousDocuments);
      }

      toast.error("Document upload failed", {
        description: toErrorMessage(error),
      });
    },
    onSuccess: (document) => {
      setDocuments((documents) => upsertCachedDocument(documents, document));
      toast.success("Document added to Knowledge Base");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKey });
    },
  });

  const renameDocumentMutation = useMutation({
    mutationFn: async ({ documentId, title }: RenameKnowledgeDocumentInput) => {
      if (!tenantId) {
        throw new Error("Select an organization to rename documents.");
      }

      const nextTitle = title.trim();
      if (!nextTitle) {
        throw new Error("Document title is required.");
      }

      const { data, error } = await bloomSupabase
        .from("bloom_knowledge_documents")
        .update({ title: nextTitle })
        .eq("id", documentId)
        .eq("tenant_id", tenantId)
        .select(BLOOM_KNOWLEDGE_DOCUMENT_COLUMNS)
        .single();

      if (error) {
        throw error;
      }

      return toBloomKnowledgeDocument(data);
    },
    onMutate: async ({
      documentId,
      title,
    }): Promise<KnowledgeDocumentsMutationContext> => {
      await queryClient.cancelQueries({ queryKey: knowledgeQueryKey });
      const previousDocuments =
        queryClient.getQueryData<BloomKnowledgeDocument[]>(knowledgeQueryKey);

      patchDocument(documentId, {
        title: title.trim(),
        updatedAt: new Date().toISOString(),
      });

      return { previousDocuments };
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(knowledgeQueryKey, context?.previousDocuments);
      toast.error("Failed to rename document", {
        description: toErrorMessage(error),
      });
    },
    onSuccess: (document) => {
      patchDocument(document.id, document);
      toast.success("Document renamed");
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async ({ document }: DeleteKnowledgeDocumentInput) => {
      if (!tenantId) {
        throw new Error("Select an organization to delete documents.");
      }

      const { error: storageError } = await supabase.storage
        .from(BLOOM_UPLOADS_BUCKET)
        .remove([document.sourceFile]);

      if (storageError) {
        throw storageError;
      }

      const { error } = await bloomSupabase
        .from("bloom_knowledge_documents")
        .delete()
        .eq("id", document.id)
        .eq("tenant_id", tenantId);

      if (error) {
        throw error;
      }

      return document.id;
    },
    onMutate: async ({
      document,
    }): Promise<KnowledgeDocumentsMutationContext> => {
      await queryClient.cancelQueries({ queryKey: knowledgeQueryKey });
      const previousDocuments =
        queryClient.getQueryData<BloomKnowledgeDocument[]>(knowledgeQueryKey);

      setDocuments((documents) => removeCachedDocument(documents, document.id));

      return { previousDocuments };
    },
    onError: (error, _variables, context) => {
      queryClient.setQueryData(knowledgeQueryKey, context?.previousDocuments);
      toast.error("Failed to delete document", {
        description: toErrorMessage(error),
      });
    },
    onSuccess: () => {
      toast.success("Document deleted");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: knowledgeQueryKey });
    },
  });

  const uploadDocument = useCallback(
    (
      file: File,
      title: string,
      options: UploadKnowledgeDocumentOptions = {},
    ) => {
      const fileDetails = resolveBloomKnowledgeDocumentFile(file);
      if (!fileDetails) {
        return Promise.reject(
          new Error("Use a PDF, TXT, or DOCX file under 10 MB."),
        );
      }

      if (!tenantId) {
        return Promise.reject(
          new Error("Select an organization to upload documents."),
        );
      }

      const documentId = crypto.randomUUID();
      const storagePath = createBloomKnowledgeStoragePath({
        documentId,
        filename: file.name,
        tenantId,
      });

      return uploadDocumentMutation.mutateAsync({
        documentId,
        file,
        fileType: fileDetails.fileType,
        mimeType: fileDetails.mimeType,
        onUploadProgress: options.onUploadProgress,
        storagePath,
        title,
      });
    },
    [tenantId, uploadDocumentMutation],
  );

  const renameDocument = useCallback(
    (documentId: string, title: string) =>
      renameDocumentMutation.mutateAsync({ documentId, title }),
    [renameDocumentMutation],
  );

  const deleteDocument = useCallback(
    async (documentId: string) => {
      const cachedDocument = queryClient
        .getQueryData<BloomKnowledgeDocument[]>(knowledgeQueryKey)
        ?.find((document) => document.id === documentId);

      if (cachedDocument) {
        return deleteDocumentMutation.mutateAsync({ document: cachedDocument });
      }

      if (!tenantId) {
        return Promise.reject(
          new Error("Select an organization to delete documents."),
        );
      }

      const document = await selectKnowledgeDocument({ documentId, tenantId });
      return deleteDocumentMutation.mutateAsync({ document });
    },
    [deleteDocumentMutation, knowledgeQueryKey, queryClient, tenantId],
  );

  return {
    tenantId,
    uploadDocument,
    renameDocument,
    deleteDocument,
    isUploadingDocument: uploadDocumentMutation.isPending,
    isRenamingDocument: renameDocumentMutation.isPending,
    isDeletingDocument: deleteDocumentMutation.isPending,
  };
}

export function createBloomKnowledgeStoragePath({
  documentId,
  filename,
  tenantId,
}: {
  documentId: string;
  filename: string;
  tenantId: string;
}) {
  return `${tenantId}/knowledge/${documentId}/${crypto.randomUUID()}_${sanitizeBloomStorageFilename(filename)}`;
}
