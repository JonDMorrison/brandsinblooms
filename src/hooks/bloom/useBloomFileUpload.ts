import * as React from "react";
import { toast } from "sonner";
import {
  BLOOM_UPLOADS_BUCKET,
  MAX_BLOOM_ATTACHMENT_BYTES,
  MAX_BLOOM_ATTACHMENTS,
  resolveBloomAttachmentMimeType,
} from "@/components/bloom/bloomFileUtils";
import { useAuth } from "@/contexts/AuthContext";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "@/integrations/supabase/config";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { BloomJsonArray, BloomJsonObject } from "@/hooks/bloom/types";

export type BloomUploadStatus = "uploading" | "uploaded" | "error";

export interface BloomUploadingFile {
  id: string;
  file: File;
  filename: string;
  mimeType: string;
  size: number;
  progress: number;
  status: BloomUploadStatus;
  storagePath: string | null;
  errorMessage: string | null;
  tenantId: string;
  conversationId: string;
}

interface UseBloomFileUploadOptions {
  activeConversationId: string | null;
  ensureConversationId: () => Promise<string>;
}

type UploadTarget = {
  id: string;
  file: File;
  mimeType: string;
  storagePath: string;
};

const uploadUrlForPath = (storagePath: string) => {
  const encodedPath = storagePath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${SUPABASE_URL}/storage/v1/object/${BLOOM_UPLOADS_BUCKET}/${encodedPath}`;
};

const sanitizeStorageFilename = (filename: string) => {
  const sanitized = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

  return sanitized || "attachment";
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

const createAttachmentPayload = (
  uploadingFile: BloomUploadingFile,
): BloomJsonObject | null => {
  if (uploadingFile.status !== "uploaded" || !uploadingFile.storagePath) {
    return null;
  }

  return {
    original_filename: uploadingFile.filename,
    filename: uploadingFile.filename,
    mime_type: uploadingFile.mimeType,
    size: uploadingFile.size,
    storage_path: uploadingFile.storagePath,
    processing_status: "processing",
  };
};

export function useBloomFileUpload({
  activeConversationId,
  ensureConversationId,
}: UseBloomFileUploadOptions) {
  const { session } = useAuth();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const accessToken = session?.access_token ?? null;
  const [files, setFiles] = React.useState<BloomUploadingFile[]>([]);
  const uploadRequestsRef = React.useRef<Map<string, XMLHttpRequest>>(
    new Map(),
  );

  const updateFile = React.useCallback(
    (id: string, updater: (file: BloomUploadingFile) => BloomUploadingFile) => {
      setFiles((current) =>
        current.map((file) => (file.id === id ? updater(file) : file)),
      );
    },
    [],
  );

  const uploadFile = React.useCallback(
    async (target: UploadTarget) => {
      if (!accessToken) {
        throw new Error("Sign in to upload attachments.");
      }

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        uploadRequestsRef.current.set(target.id, xhr);

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable || event.total <= 0) {
            return;
          }

          const nextProgress = Math.min(
            99,
            Math.round((event.loaded / event.total) * 100),
          );
          updateFile(target.id, (file) => ({
            ...file,
            progress: nextProgress,
          }));
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
        xhr.onloadend = () => {
          uploadRequestsRef.current.delete(target.id);
        };

        xhr.open("POST", uploadUrlForPath(target.storagePath));
        xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
        xhr.setRequestHeader("Content-Type", target.mimeType);
        xhr.setRequestHeader("Cache-Control", "3600");
        xhr.setRequestHeader("x-upsert", "false");
        xhr.send(target.file);
      });
    },
    [accessToken, updateFile],
  );

  const startUpload = React.useCallback(
    (uploadingFile: BloomUploadingFile) => {
      void (async () => {
        const storagePath = `${uploadingFile.tenantId}/${uploadingFile.conversationId}/${crypto.randomUUID()}_${sanitizeStorageFilename(uploadingFile.filename)}`;

        updateFile(uploadingFile.id, (file) => ({
          ...file,
          errorMessage: null,
          progress: 0,
          status: "uploading",
          storagePath,
        }));

        try {
          await uploadFile({
            id: uploadingFile.id,
            file: uploadingFile.file,
            mimeType: uploadingFile.mimeType,
            storagePath,
          });

          updateFile(uploadingFile.id, (file) => ({
            ...file,
            progress: 100,
            status: "uploaded",
            storagePath,
          }));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Upload failed.";
          updateFile(uploadingFile.id, (file) => ({
            ...file,
            errorMessage: message,
            status: "error",
          }));
          if (message !== "Upload canceled.") {
            toast.error("File upload failed", { description: message });
          }
        }
      })();
    },
    [updateFile, uploadFile],
  );

  const addFiles = React.useCallback(
    async (selectedFiles: File[]) => {
      if (selectedFiles.length === 0) {
        return;
      }

      if (!tenantId || !accessToken) {
        toast.error("Sign in and select an organization to upload files.");
        return;
      }

      const availableSlots = MAX_BLOOM_ATTACHMENTS - files.length;
      if (availableSlots <= 0) {
        toast.error("You can attach up to 3 files per message.");
        return;
      }

      if (selectedFiles.length > availableSlots) {
        toast.error("You can attach up to 3 files per message.");
      }

      const validFiles: Array<{ file: File; mimeType: string }> = [];
      for (const file of selectedFiles.slice(0, availableSlots)) {
        const mimeType = resolveBloomAttachmentMimeType(file);
        if (!mimeType) {
          toast.error("File type not supported", { description: file.name });
          continue;
        }

        if (file.size > MAX_BLOOM_ATTACHMENT_BYTES) {
          toast.error("File exceeds 10MB limit", { description: file.name });
          continue;
        }

        validFiles.push({ file, mimeType });
      }

      if (validFiles.length === 0) {
        return;
      }

      let conversationId = activeConversationId;
      try {
        conversationId = conversationId ?? (await ensureConversationId());
      } catch (error) {
        toast.error("Unable to start a Bloom conversation", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
        return;
      }

      const uploadingFiles: BloomUploadingFile[] = validFiles.map(
        ({ file, mimeType }) => ({
          id: crypto.randomUUID(),
          file,
          filename: file.name,
          mimeType,
          size: file.size,
          progress: 0,
          status: "uploading",
          storagePath: null,
          errorMessage: null,
          tenantId,
          conversationId,
        }),
      );

      setFiles((current) => [...current, ...uploadingFiles]);
      uploadingFiles.forEach(startUpload);
    },
    [
      accessToken,
      activeConversationId,
      ensureConversationId,
      files.length,
      startUpload,
      tenantId,
    ],
  );

  const removeFile = React.useCallback((id: string) => {
    const activeRequest = uploadRequestsRef.current.get(id);
    if (activeRequest) {
      activeRequest.abort();
      uploadRequestsRef.current.delete(id);
    }

    setFiles((current) => {
      const fileToRemove = current.find((file) => file.id === id);
      if (fileToRemove?.status === "uploaded" && fileToRemove.storagePath) {
        void supabase.storage
          .from(BLOOM_UPLOADS_BUCKET)
          .remove([fileToRemove.storagePath]);
      }

      return current.filter((file) => file.id !== id);
    });
  }, []);

  const retryFile = React.useCallback(
    (id: string) => {
      const file = files.find((item) => item.id === id);
      if (!file || file.status !== "error") {
        return;
      }

      startUpload(file);
    },
    [files, startUpload],
  );

  React.useEffect(() => {
    if (!activeConversationId || files.length === 0) {
      return;
    }

    files
      .filter((file) => file.conversationId !== activeConversationId)
      .forEach((file) => removeFile(file.id));
  }, [activeConversationId, files, removeFile]);

  const clearFiles = React.useCallback(() => {
    uploadRequestsRef.current.forEach((request) => request.abort());
    uploadRequestsRef.current.clear();
    setFiles([]);
  }, []);

  React.useEffect(
    () => () => {
      uploadRequestsRef.current.forEach((request) => request.abort());
      uploadRequestsRef.current.clear();
    },
    [],
  );

  const attachments = React.useMemo<BloomJsonArray>(
    () =>
      files
        .map(createAttachmentPayload)
        .filter((attachment): attachment is BloomJsonObject =>
          Boolean(attachment),
        ),
    [files],
  );

  const isUploading = files.some((file) => file.status === "uploading");
  const hasUnreadyFiles = files.some((file) => file.status !== "uploaded");

  return {
    files,
    attachments,
    addFiles,
    removeFile,
    retryFile,
    clearFiles,
    isUploading,
    hasUnreadyFiles,
  };
}
