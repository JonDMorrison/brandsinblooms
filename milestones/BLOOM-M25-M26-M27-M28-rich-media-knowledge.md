# BLOOM-M25: Image Generation

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 5 — Rich Media & Knowledge
> **Milestone:** 25 of 40

---

## Objective

Integrate image generation into Bloom by calling the existing `generate-ai-image` Edge Function (uses `LOVABLE_API_KEY` + Supabase Storage). Add `enhance-image-prompt` preprocessing, climate constraints, and inline image rendering with download/save actions.

---

## Scope

### Image Mode Activation

When the user selects the Image mode chip (🎨) or says "generate an image" / "create a picture":
- Orchestrator switches to image tool only
- LLM generates an enhanced prompt based on user's description + store context
- Calls `enhance-image-prompt` Edge Function first (already exists)
- Then calls `generate-ai-image` Edge Function with enhanced prompt
- Climate constraints from `_shared/climateConstraints.ts` applied to prompt
- Location guardrails from `_shared/locationGuard.ts` applied
- Result stored in Supabase Storage bucket `global-ai-images`

### Image Block Rendering

`ImageBlock.tsx` (from M13) enhanced:
- Image renders inline in conversation with `borderRadius: "var(--joy-radius-lg)"`
- Loading state: `Skeleton` variant="rectangular" with aspect ratio 16:9
- Actions below image: "Download" (`JoyButton` triggers browser download), "Save to Gallery" (saves reference to `image_assets`), "Generate Another" (follow-up chip), "Edit Prompt" (opens the prompt for refinement)
- Image is responsive — max-width 100% of conversation area, min-height 200px

### Image Refinement

"Make it more vibrant" / "Add more flowers" / "Make the background darker":
- Appends refinement instruction to the original prompt
- Regenerates with the enhanced prompt
- Previous image remains visible (stacked, not replaced)

---

## Acceptance Criteria

- [ ] Image generation calls existing `generate-ai-image` Edge Function
- [ ] `enhance-image-prompt` preprocessing improves prompt quality
- [ ] Climate constraints and location guardrails applied
- [ ] Image stored in Supabase Storage `global-ai-images` bucket
- [ ] Image renders inline with loading skeleton
- [ ] Download, Save, Generate Another, Edit Prompt actions work
- [ ] Image refinement appends to original prompt and regenerates
- [ ] Image mode chip toggles correctly

---

## What NOT To Do

- Do NOT implement a new image generation pipeline — use existing Edge Function
- Do NOT skip `enhance-image-prompt` — it significantly improves results
- Do NOT skip climate constraints — they prevent inappropriate content
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M26: File Upload & Analysis

> **Copilot Thinking Effort:** High
> **Branch:** `feature/bloom-assist`
> **Phase:** 5 — Rich Media & Knowledge
> **Milestone:** 26 of 40

---

## Objective

Enable users to upload CSV, Excel, and PDF files within Bloom conversations. Bloom analyzes the content and generates insights, charts, and summaries. Uses existing `analyze-csv-intelligent` Edge Function for CSV analysis and standard text extraction for PDFs.

---

## Scope

### Upload UI

In `BloomInputArea.tsx`, the file attachment `IconButton`:
- Opens a file picker via `react-dropzone` (already in deps)
- Accepted types: `.csv`, `.xlsx`, `.xls`, `.pdf`, `.txt`, `.png`, `.jpg`, `.jpeg`
- Max file size: 10MB
- Selected file shows as a `JoyChip` with filename + remove button below the textarea
- File uploaded to Supabase Storage bucket `bloom-uploads` (new bucket, tenant-scoped)
- Upload progress shown as inline `LinearProgress` (Joy)

### File Processing

**CSV/Excel files:**
- Call existing `analyze-csv-intelligent` Edge Function
- Returns column analysis, data quality report, row count, suggested visualizations
- Bloom generates summary text + optional ChartBlock based on the data

**PDF files:**
- Extract text content (first 50 pages / 100K characters)
- Send extracted text to LLM as part of the user's message
- LLM summarizes, answers questions about the content

**Images:**
- Send to OpenAI Vision API (gpt-4o supports image input)
- LLM describes, analyzes, or extracts text from the image

### File Reference in Messages

- File stored in `bloom_messages.attachments` JSONB: `[{ name, type, size, storage_path, analysis_result }]`
- File chips rendered in user messages showing filename + icon

---

## Acceptance Criteria

- [ ] File picker accepts CSV, Excel, PDF, TXT, and image files
- [ ] Upload to Supabase Storage with progress indicator
- [ ] CSV analysis uses existing `analyze-csv-intelligent` Edge Function
- [ ] PDF text extraction works for documents up to 50 pages
- [ ] Image analysis uses OpenAI Vision API
- [ ] File references persisted in message metadata
- [ ] File chips render in user messages
- [ ] 10MB file size limit enforced
- [ ] All UI uses Joy UI — `JoyChip`, `LinearProgress`, `IconButton`

---

## What NOT To Do

- Do NOT implement custom CSV parsing — use existing `analyze-csv-intelligent`
- Do NOT process files larger than 10MB
- Do NOT store files without tenant-scoping the storage path
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M27: RAG Knowledge Base

> **Copilot Thinking Effort:** XHigh
> **Branch:** `feature/bloom-assist`
> **Phase:** 5 — Rich Media & Knowledge
> **Milestone:** 27 of 40

---

## Objective

Build a per-tenant knowledge base using pgvector for semantic search. Merchants can upload store documents (policies, FAQs, product guides) that Bloom retrieves when answering questions. This gives Bloom domain-specific knowledge beyond CRM data.

---

## Scope

### Database

**`bloom_knowledge_documents`** table:
- `id`, `tenant_id`, `user_id`, `title`, `content` (full text), `chunk_count`, `status` (processing/ready/failed), `source_file` (storage path), `created_at`
- RLS: tenant-scoped

**`bloom_knowledge_chunks`** table:
- `id`, `document_id` FK, `tenant_id`, `chunk_index`, `content` (chunk text, ~500 tokens each), `embedding` (vector(1536)), `metadata` (JSONB: source page, section header), `created_at`
- RLS: tenant-scoped
- Index: `ivfflat` on `embedding` column using cosine distance

### Document Processing Edge Function: `supabase/functions/bloom-knowledge-ingest/index.ts`

1. Receives uploaded document (PDF, TXT, DOCX via text extraction)
2. Chunks text into ~500 token segments with overlap
3. Generates embeddings via OpenAI `text-embedding-3-small`
4. Stores chunks + embeddings in `bloom_knowledge_chunks`
5. Updates document status to `ready`

### Search Tool: `search_knowledge`

In the tool registry:
- Takes a `query` string
- Generates embedding for the query
- Performs cosine similarity search on `bloom_knowledge_chunks` for the tenant
- Returns top 5 most relevant chunks with source document title
- Injected into the LLM context as additional context

### Knowledge Management UI

A section in Bloom settings (or a dedicated `/bloom/knowledge` route):
- Upload documents via `react-dropzone`
- List uploaded documents with status badges
- Delete documents (cascades to chunks)
- Processing status: "Processing 3/10 pages..."
- All UI using Joy components: `JoyCard`, `JoyTable`, `JoyButton`, `JoyChip`, `LinearProgress`

---

## Acceptance Criteria

- [ ] Documents upload, chunk, and embed successfully
- [ ] pgvector cosine similarity search returns relevant chunks
- [ ] `search_knowledge` tool integrates with the tool registry
- [ ] LLM uses knowledge base content when answering questions
- [ ] Knowledge management UI allows upload, view, delete
- [ ] All data tenant-scoped via RLS
- [ ] Processing status shown with progress indicator

---

## What NOT To Do

- Do NOT use a third-party vector DB — use pgvector in Supabase
- Do NOT embed entire documents — chunk into ~500 token segments
- Do NOT skip the RLS policies on knowledge tables
- Do NOT generate test files or documentation

---
---
---

# BLOOM-M28: Voice Input

> **Copilot Thinking Effort:** Medium
> **Branch:** `feature/bloom-assist`
> **Phase:** 5 — Rich Media & Knowledge
> **Milestone:** 28 of 40

---

## Objective

Add a microphone button to Bloom's input area that captures voice and converts it to text using the Web Speech API (browser-native, no external dependency). The transcribed text appears in the textarea for review before sending.

---

## Scope

### Voice Button: `src/components/bloom/BloomVoiceInput.tsx`

- `JoyButton` size="icon" variant="ghost" with Mic icon (lucide-react)
- On click: starts `webkitSpeechRecognition` or `SpeechRecognition` API
- While recording: button pulses (red dot animation), shows "Listening..." status
- On result: transcribed text inserted into textarea (user can edit before sending)
- On error: Sonner toast with friendly message ("Voice input not supported in this browser")
- Button disabled if browser doesn't support Web Speech API

### Browser Support

- Chrome, Edge: full support via `webkitSpeechRecognition`
- Firefox, Safari: limited support — show disabled button with tooltip "Voice input requires Chrome or Edge"
- Feature detection via `'webkitSpeechRecognition' in window || 'SpeechRecognition' in window`

---

## Acceptance Criteria

- [ ] Microphone button appears in input area
- [ ] Voice recognition starts on click and transcribes speech to text
- [ ] Recording state shows visual feedback (pulse animation)
- [ ] Transcribed text appears in textarea for review
- [ ] Graceful fallback for unsupported browsers
- [ ] Uses Joy UI button with proper icon sizing

---

## What NOT To Do

- Do NOT add external speech-to-text dependencies — use browser API
- Do NOT auto-send after transcription — user must review and click Send
- Do NOT generate test files or documentation
