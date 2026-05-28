import * as React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemContent from "@mui/joy/ListItemContent";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { format, formatDistanceToNowStrict, isValid } from "date-fns";
import {
  FileSpreadsheet,
  FileText,
  Info,
  Pencil,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { toast } from "sonner";
import {
  BLOOM_KNOWLEDGE_DOCUMENT_ACCEPT,
  formatBloomFileSize,
  getBloomFileBaseName,
  MAX_BLOOM_KNOWLEDGE_DOCUMENT_BYTES,
  resolveBloomKnowledgeDocumentFile,
} from "@/components/bloom/bloomFileUtils";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import { JoyEmptyState } from "@/components/joy/JoyEmptyState";
import { JoyInput } from "@/components/joy/JoyInput";
import { PageContainer } from "@/components/joy/PageContainer";
import {
  useBloomKnowledgeDocuments,
  useBloomKnowledgeMutations,
} from "@/hooks/bloom/useBloomKnowledgeDocuments";
import type {
  BloomKnowledgeDocument,
  BloomKnowledgeDocumentStatus,
} from "@/hooks/bloom/types";
import { useTenant } from "@/hooks/useTenant";

const MOUNT_SKELETON_MS = 260;
const numberFormatter = new Intl.NumberFormat("en-US");

const statusCopy: Record<
  BloomKnowledgeDocumentStatus,
  { label: string; color: "danger" | "neutral" | "primary" | "success" }
> = {
  uploading: { label: "Processing", color: "primary" },
  processing: { label: "Processing", color: "primary" },
  ready: { label: "Ready", color: "success" },
  failed: { label: "Failed", color: "danger" },
};

function formatUploadDate(value: string) {
  const parsedDate = new Date(value);
  if (!isValid(parsedDate)) {
    return "Uploaded recently";
  }

  const elapsedMs = Date.now() - parsedDate.getTime();
  if (elapsedMs >= 0 && elapsedMs < 60_000) {
    return "Uploaded just now";
  }

  if (elapsedMs >= 0 && elapsedMs < 24 * 60 * 60 * 1000) {
    return `Uploaded ${formatDistanceToNowStrict(parsedDate, {
      addSuffix: true,
    })}`;
  }

  return `Uploaded ${format(parsedDate, "MMM d, yyyy")}`;
}

function formatCount(value: number, singular: string, plural: string) {
  return `${numberFormatter.format(value)} ${value === 1 ? singular : plural}`;
}

function readMetadataNumber(
  document: BloomKnowledgeDocument,
  key: string,
): number | null {
  const value = document.metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getDocumentFilename(document: BloomKnowledgeDocument) {
  const originalFilename = document.metadata.original_filename;
  if (typeof originalFilename === "string" && originalFilename.trim()) {
    return originalFilename.trim();
  }

  const filename = document.sourceFile.split("/").pop()?.trim();
  return filename || "Document";
}

function formatFileType(fileType: BloomKnowledgeDocument["fileType"]) {
  return fileType.toUpperCase();
}

function getDocumentContentMetric(document: BloomKnowledgeDocument) {
  const pageCount = readMetadataNumber(document, "page_count");
  if (pageCount && document.fileType === "pdf") {
    return formatCount(pageCount, "page", "pages");
  }

  const explicitCharacterCount =
    readMetadataNumber(document, "character_count") ??
    readMetadataNumber(document, "char_count") ??
    readMetadataNumber(document, "characters");
  const characterCount = explicitCharacterCount ?? document.content?.length;
  if (characterCount) {
    return formatCount(characterCount, "char", "chars");
  }

  if (pageCount) {
    return formatCount(pageCount, "page", "pages");
  }

  const docxXmlFiles = readMetadataNumber(document, "docx_xml_files");
  if (docxXmlFiles) {
    return formatCount(docxXmlFiles, "section", "sections");
  }

  const size = readMetadataNumber(document, "file_size_bytes");
  return size ? formatBloomFileSize(size) : null;
}

function getDocumentMeta(document: BloomKnowledgeDocument) {
  const details = [
    formatFileType(document.fileType),
    getDocumentContentMetric(document),
    formatCount(document.chunkCount, "chunk", "chunks"),
  ];

  return details
    .filter((detail): detail is string => Boolean(detail))
    .join(" · ");
}

function StatusChip({ document }: { document: BloomKnowledgeDocument }) {
  const config = statusCopy[document.status];
  const showSpinner =
    document.status === "uploading" || document.status === "processing";

  return (
    <JoyChip
      color={config.color}
      size="sm"
      variant="soft"
      startDecorator={
        showSpinner ? (
          <CircularProgress
            color={config.color}
            determinate={document.processingProgress > 0}
            size="sm"
            value={Math.max(0, Math.min(100, document.processingProgress))}
            sx={{ "--CircularProgress-size": "14px" }}
          />
        ) : undefined
      }
    >
      {config.label}
    </JoyChip>
  );
}

function DocumentListSkeleton() {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderColor: "neutral.200",
        borderRadius: "var(--joy-radius-lg)",
        backgroundColor: "background.surface",
        overflow: "hidden",
      }}
    >
      <Stack divider={<Divider />}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Stack
            key={index}
            direction="row"
            spacing={1.5}
            sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}
          >
            <Skeleton
              variant="circular"
              animation="wave"
              width={32}
              height={32}
            />
            <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
              <Skeleton variant="text" animation="wave" sx={{ width: "42%" }} />
              <Skeleton variant="text" animation="wave" sx={{ width: "66%" }} />
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{ width: "100%", height: 4, borderRadius: 999 }}
              />
            </Stack>
            <Skeleton
              variant="rectangular"
              animation="wave"
              sx={{ width: 72, height: 24, borderRadius: 999 }}
            />
          </Stack>
        ))}
      </Stack>
    </Sheet>
  );
}

function PageSkeleton() {
  return (
    <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
      <Stack spacing={3}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
        >
          <Stack spacing={1} sx={{ minWidth: 0 }}>
            <Skeleton
              variant="text"
              animation="wave"
              sx={{ width: 172, height: 28 }}
            />
          </Stack>
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{
              width: 148,
              height: 36,
              borderRadius: "var(--joy-radius-lg)",
            }}
          />
        </Stack>
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ height: 58, borderRadius: "var(--joy-radius-lg)" }}
        />
        <DocumentListSkeleton />
      </Stack>
    </PageContainer>
  );
}

function KnowledgeDocumentRow({
  document,
  editing,
  editTitle,
  onCancelEdit,
  onDelete,
  onEditTitleChange,
  onSaveEdit,
  onStartEdit,
  saving,
}: {
  document: BloomKnowledgeDocument;
  editing: boolean;
  editTitle: string;
  onCancelEdit: () => void;
  onDelete: () => void;
  onEditTitleChange: (title: string) => void;
  onSaveEdit: () => void;
  onStartEdit: () => void;
  saving: boolean;
}) {
  const showProgress =
    document.status === "uploading" || document.status === "processing";
  const progressValue = Math.max(0, Math.min(100, document.processingProgress));
  const FileIcon = document.fileType === "docx" ? FileSpreadsheet : FileText;

  return (
    <ListItem
      sx={{
        alignItems: "stretch",
        px: { xs: 1.5, md: 2 },
        py: 0,
        "&:not(:last-of-type)": {
          borderBottom: "1px solid",
          borderColor: "neutral.200",
        },
      }}
    >
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ width: "100%", py: 1.75, minWidth: 0 }}
      >
        <ListItemDecorator
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            flexShrink: 0,
            color: "neutral.500",
          }}
        >
          <FileIcon size={22} strokeWidth={1.8} />
        </ListItemDecorator>

        <ListItemContent sx={{ minWidth: 0, flex: 1 }}>
          <Stack spacing={0.85} sx={{ minWidth: 0 }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={{ xs: 0.75, md: 1.25 }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
              sx={{ minWidth: 0 }}
            >
              {editing ? (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  sx={{ minWidth: 0, flex: 1 }}
                >
                  <JoyInput
                    aria-label="Document title"
                    autoFocus
                    value={editTitle}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        onSaveEdit();
                      }
                      if (event.key === "Escape") {
                        event.preventDefault();
                        onCancelEdit();
                      }
                    }}
                    onValueChange={onEditTitleChange}
                    sx={{ minWidth: { xs: "100%", sm: 280 } }}
                  />
                  <Stack direction="row" spacing={0.75}>
                    <JoyButton
                      color="neutral"
                      bloomVariant="ghost"
                      disabled={saving}
                      onClick={onCancelEdit}
                    >
                      Cancel
                    </JoyButton>
                    <JoyButton loading={saving} onClick={onSaveEdit}>
                      Save
                    </JoyButton>
                  </Stack>
                </Stack>
              ) : (
                <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    level="title-sm"
                    noWrap
                    sx={{ color: "neutral.900" }}
                  >
                    {document.title}
                  </Typography>
                  <Typography
                    level="body-xs"
                    noWrap
                    sx={{ color: "neutral.500" }}
                  >
                    {getDocumentFilename(document)}
                  </Typography>
                </Stack>
              )}

              {!editing ? (
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Tooltip title="Rename" variant="solid" arrow>
                    <JoyButton
                      aria-label={`Rename ${document.title}`}
                      color="neutral"
                      bloomVariant="ghost"
                      size="icon"
                      onClick={onStartEdit}
                    >
                      <Pencil size={16} strokeWidth={1.9} />
                    </JoyButton>
                  </Tooltip>
                  <Tooltip title="Delete" variant="solid" arrow>
                    <JoyButton
                      aria-label={`Delete ${document.title}`}
                      color="danger"
                      bloomVariant="ghost"
                      size="icon"
                      onClick={onDelete}
                    >
                      <Trash2 size={16} strokeWidth={1.9} />
                    </JoyButton>
                  </Tooltip>
                </Stack>
              ) : null}
            </Stack>

            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              alignItems="center"
            >
              <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                {getDocumentMeta(document)}
              </Typography>
              <StatusChip document={document} />
            </Stack>

            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              {formatUploadDate(document.createdAt)}
            </Typography>

            {showProgress ? (
              <LinearProgress
                color="primary"
                determinate={progressValue > 0}
                size="sm"
                value={progressValue}
                variant="soft"
                sx={{
                  "--LinearProgress-radius": "999px",
                  "--LinearProgress-thickness": "4px",
                }}
              />
            ) : null}

            {document.status === "failed" && document.errorMessage ? (
              <Typography level="body-xs" color="danger">
                {document.errorMessage}
              </Typography>
            ) : null}
          </Stack>
        </ListItemContent>
      </Stack>
    </ListItem>
  );
}

function BloomKnowledgeManagementContent() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const documentsQuery = useBloomKnowledgeDocuments(tenantId);
  const {
    deleteDocument,
    isDeletingDocument,
    isRenamingDocument,
    isUploadingDocument,
    renameDocument,
    uploadDocument,
  } = useBloomKnowledgeMutations();
  const documents = documentsQuery.data;
  const [showMountSkeleton, setShowMountSkeleton] = React.useState(true);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = React.useState("");
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [uploadStage, setUploadStage] = React.useState<
    "idle" | "uploading" | "processing"
  >("idle");
  const [editingDocumentId, setEditingDocumentId] = React.useState<
    string | null
  >(null);
  const [editingTitle, setEditingTitle] = React.useState("");
  const [deleteTarget, setDeleteTarget] =
    React.useState<BloomKnowledgeDocument | null>(null);

  React.useEffect(() => {
    const timeout = window.setTimeout(
      () => setShowMountSkeleton(false),
      MOUNT_SKELETON_MS,
    );
    return () => window.clearTimeout(timeout);
  }, []);

  const resetUploadState = React.useCallback(() => {
    setSelectedFile(null);
    setUploadTitle("");
    setUploadProgress(0);
    setUploadStage("idle");
  }, []);

  const handleDrop = React.useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      const rejectedFile = fileRejections[0];
      if (rejectedFile) {
        const message =
          rejectedFile.errors[0]?.message ??
          "Choose a PDF, TXT, or DOCX file under 10 MB.";
        toast.error("Document not accepted", { description: message });
        return;
      }

      const nextFile = acceptedFiles[0];
      if (!nextFile) {
        return;
      }

      const fileDetails = resolveBloomKnowledgeDocumentFile(nextFile);
      if (!fileDetails) {
        toast.error("Document type not supported", {
          description: "Use a PDF, TXT, or DOCX file.",
        });
        return;
      }

      setSelectedFile(nextFile);
      setUploadTitle(getBloomFileBaseName(nextFile.name));
      setUploadProgress(0);
      setUploadStage("idle");
    },
    [],
  );

  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: BLOOM_KNOWLEDGE_DOCUMENT_ACCEPT,
    disabled: isUploadingDocument,
    maxFiles: 1,
    maxSize: MAX_BLOOM_KNOWLEDGE_DOCUMENT_BYTES,
    multiple: false,
    onDrop: handleDrop,
  });

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Choose a document to upload.");
      return;
    }

    const title = uploadTitle.trim();
    if (!title) {
      toast.error("Document title is required.");
      return;
    }

    if (!tenantId) {
      toast.error("Select an organization to upload documents.");
      return;
    }

    const fileDetails = resolveBloomKnowledgeDocumentFile(selectedFile);
    if (!fileDetails) {
      toast.error("Document type not supported", {
        description: "Use a PDF, TXT, or DOCX file.",
      });
      return;
    }

    setUploadStage("uploading");
    setUploadProgress(0);

    try {
      await uploadDocument(selectedFile, title, {
        onUploadProgress: (progress) => {
          setUploadProgress(progress);
          if (progress >= 100) {
            setUploadStage("processing");
          }
        },
      });
      setUploadOpen(false);
      resetUploadState();
    } catch {
      setUploadStage("idle");
    }
  };

  const handleStartEdit = (document: BloomKnowledgeDocument) => {
    setEditingDocumentId(document.id);
    setEditingTitle(document.title);
  };

  const handleSaveEdit = async () => {
    if (!editingDocumentId) {
      return;
    }

    const title = editingTitle.trim();
    if (!title) {
      toast.error("Document title is required.");
      return;
    }

    try {
      await renameDocument(editingDocumentId, title);
      setEditingDocumentId(null);
      setEditingTitle("");
    } catch {
      // The mutation owns the toast and optimistic rollback.
    }
  };

  const shouldShowSkeleton = showMountSkeleton || documentsQuery.isLoading;
  const selectedFileDetails = selectedFile
    ? resolveBloomKnowledgeDocumentFile(selectedFile)
    : null;
  const queryError =
    documentsQuery.error instanceof Error ? documentsQuery.error.message : null;

  if (shouldShowSkeleton) {
    return <PageSkeleton />;
  }

  return (
    <PageContainer sx={{ px: { xs: 2, md: 3 }, py: { xs: 3, md: 4 } }}>
      <Stack
        spacing={3}
        sx={{
          animation: "bloomKnowledgeFadeIn 240ms ease",
          "@keyframes bloomKnowledgeFadeIn": {
            from: { opacity: 0 },
            to: { opacity: 1 },
          },
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", md: "flex-start" }}
        >
          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography level="h2" sx={{ color: "neutral.900" }}>
              Knowledge Base
            </Typography>
          </Stack>
          <JoyButton
            color="primary"
            variant="solid"
            startDecorator={<Upload size={16} strokeWidth={1.9} />}
            onClick={() => setUploadOpen(true)}
          >
            Upload Document
          </JoyButton>
        </Stack>

        {queryError ? (
          <Sheet
            color="danger"
            variant="soft"
            sx={{ borderRadius: "var(--joy-radius-lg)", px: 2.5, py: 2 }}
          >
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: "stretch", sm: "center" }}
            >
              <Typography level="body-sm" color="danger">
                {queryError}
              </Typography>
              <JoyButton
                color="danger"
                variant="soft"
                onClick={() => void documentsQuery.refetch()}
              >
                Retry
              </JoyButton>
            </Stack>
          </Sheet>
        ) : null}

        {documents.length === 0 && !queryError ? (
          <Sheet
            variant="outlined"
            sx={{
              minHeight: 420,
              display: "grid",
              placeItems: "center",
              borderColor: "neutral.200",
              borderRadius: "var(--joy-radius-lg)",
              backgroundColor: "background.surface",
            }}
          >
            <JoyEmptyState
              icon={<FileText />}
              title="No documents yet"
              description="Upload store policies, product guides, or FAQs to help Bloom answer questions about your business."
              primaryAction={{
                label: "Upload Document",
                startDecorator: <Upload size={16} strokeWidth={1.9} />,
                onClick: () => setUploadOpen(true),
              }}
            />
          </Sheet>
        ) : null}

        {documents.length > 0 ? (
          <Sheet
            variant="outlined"
            sx={{
              borderColor: "neutral.200",
              borderRadius: "var(--joy-radius-lg)",
              backgroundColor: "background.surface",
              boxShadow: "var(--joy-shadow-xs)",
              overflow: "hidden",
            }}
          >
            <List
              size="sm"
              sx={{
                "--ListItem-paddingX": 0,
                "--ListItem-paddingY": 0,
              }}
            >
              {documents.map((document) => (
                <KnowledgeDocumentRow
                  key={document.id}
                  document={document}
                  editing={editingDocumentId === document.id}
                  editTitle={editingTitle}
                  onCancelEdit={() => {
                    setEditingDocumentId(null);
                    setEditingTitle("");
                  }}
                  onDelete={() => setDeleteTarget(document)}
                  onEditTitleChange={setEditingTitle}
                  onSaveEdit={() => {
                    void handleSaveEdit();
                  }}
                  onStartEdit={() => handleStartEdit(document)}
                  saving={isRenamingDocument}
                />
              ))}
            </List>
          </Sheet>
        ) : null}

        {!queryError ? (
          <Sheet
            color="neutral"
            variant="soft"
            sx={{
              borderRadius: "var(--joy-radius-lg)",
              px: { xs: 2, md: 2.5 },
              py: 1.5,
            }}
          >
            <Stack direction="row" spacing={1.25} alignItems="flex-start">
              <Box sx={{ color: "neutral.500", pt: 0.25 }}>
                <Info size={17} strokeWidth={1.9} />
              </Box>
              <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                Documents you upload here help Bloom answer questions about your
                store policies, product guides, and FAQs.
              </Typography>
            </Stack>
          </Sheet>
        ) : null}
      </Stack>

      <JoyDialog
        open={uploadOpen}
        onClose={() => {
          if (!isUploadingDocument) {
            setUploadOpen(false);
            resetUploadState();
          }
        }}
        title="Upload Document"
        description="PDF, TXT, and DOCX files are supported."
        size="md"
        disableClose={isUploadingDocument}
      >
        <JoyDialogContent>
          <Stack spacing={2.25}>
            <Sheet
              {...getRootProps()}
              variant="outlined"
              sx={{
                borderColor: isDragActive ? "primary.400" : "neutral.300",
                borderRadius: "var(--joy-radius-lg)",
                borderStyle: "dashed",
                backgroundColor: "background.surface",
                cursor: isUploadingDocument ? "not-allowed" : "pointer",
                px: 3,
                py: 4,
                transition:
                  "border-color 160ms ease, background-color 160ms ease",
                "&:hover": {
                  borderColor: isUploadingDocument
                    ? "neutral.300"
                    : "neutral.500",
                },
              }}
            >
              <input {...getInputProps()} />
              <Stack spacing={1.25} alignItems="center" textAlign="center">
                <Box sx={{ color: "neutral.500" }}>
                  <Upload size={26} strokeWidth={1.8} />
                </Box>
                <Stack spacing={0.5}>
                  <Typography level="title-sm" sx={{ color: "neutral.900" }}>
                    {isDragActive
                      ? "Drop document to upload"
                      : "Drag and drop or click to select"}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    PDF, TXT, or DOCX · max 10 MB
                  </Typography>
                </Stack>
              </Stack>
            </Sheet>

            {selectedFile ? (
              <Sheet
                variant="outlined"
                sx={{
                  borderColor: "neutral.200",
                  borderRadius: "var(--joy-radius-lg)",
                  backgroundColor: "background.surface",
                  px: 2,
                  py: 1.5,
                }}
              >
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box sx={{ color: "neutral.500", flexShrink: 0 }}>
                    <FileText size={20} strokeWidth={1.8} />
                  </Box>
                  <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                    <Typography
                      level="body-sm"
                      noWrap
                      sx={{ color: "neutral.900" }}
                    >
                      {selectedFile.name}
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      {selectedFileDetails
                        ? formatFileType(selectedFileDetails.fileType)
                        : "Document"}{" "}
                      · {formatBloomFileSize(selectedFile.size)}
                    </Typography>
                  </Stack>
                  <Tooltip title="Remove" variant="solid" arrow>
                    <JoyButton
                      aria-label="Remove selected document"
                      color="neutral"
                      bloomVariant="ghost"
                      disabled={isUploadingDocument}
                      size="icon"
                      onClick={() => {
                        setSelectedFile(null);
                        setUploadTitle("");
                        setUploadProgress(0);
                      }}
                    >
                      <X size={16} strokeWidth={1.9} />
                    </JoyButton>
                  </Tooltip>
                </Stack>
              </Sheet>
            ) : null}

            <JoyInput
              label="Title"
              value={uploadTitle}
              disabled={isUploadingDocument}
              onValueChange={setUploadTitle}
              placeholder="Document title"
            />

            {isUploadingDocument ? (
              <Stack spacing={0.75}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  spacing={1}
                >
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {uploadStage === "processing" ? "Processing" : "Uploading"}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                    {uploadStage === "processing"
                      ? "Indexing"
                      : `${uploadProgress}%`}
                  </Typography>
                </Stack>
                <LinearProgress
                  color="primary"
                  determinate={
                    uploadStage !== "processing" && uploadProgress > 0
                  }
                  size="sm"
                  value={uploadProgress}
                  variant="soft"
                  sx={{
                    "--LinearProgress-radius": "999px",
                    "--LinearProgress-thickness": "4px",
                  }}
                />
              </Stack>
            ) : null}
          </Stack>
        </JoyDialogContent>
        <JoyDialogActions>
          <JoyButton
            color="neutral"
            bloomVariant="ghost"
            disabled={isUploadingDocument}
            onClick={() => {
              setUploadOpen(false);
              resetUploadState();
            }}
          >
            Cancel
          </JoyButton>
          <JoyButton
            loading={isUploadingDocument}
            disabled={!selectedFile || !uploadTitle.trim()}
            onClick={() => void handleUpload()}
          >
            Upload
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>

      <JoyDialog
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (!isDeletingDocument) {
            setDeleteTarget(null);
          }
        }}
        title={
          deleteTarget ? `Delete '${deleteTarget.title}'?` : "Delete document?"
        }
        description="This will remove the document and all its knowledge chunks. Bloom will no longer reference this content."
        size="sm"
        disableClose={isDeletingDocument}
        hideCloseButton
      >
        <JoyDialogActions>
          <JoyButton
            color="neutral"
            bloomVariant="ghost"
            disabled={isDeletingDocument}
            onClick={() => setDeleteTarget(null)}
          >
            Cancel
          </JoyButton>
          <JoyButton
            color="danger"
            loading={isDeletingDocument}
            onClick={async () => {
              if (!deleteTarget) {
                return;
              }

              try {
                await deleteDocument(deleteTarget.id);
                setDeleteTarget(null);
              } catch {
                // The mutation owns the toast and optimistic rollback.
              }
            }}
          >
            Delete
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>
    </PageContainer>
  );
}

export default function BloomKnowledgePage() {
  return <BloomKnowledgeManagementContent />;
}
