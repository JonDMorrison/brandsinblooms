import * as React from "react";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Typography from "@mui/joy/Typography";
import { useDesignSystem } from "@/contexts/DesignSystemContext";
import type { StudioBlock } from "@/types/studioBlocks";
import {
  IMPORT_FIELDS,
  IMPORT_MAX_BYTES,
  inferImportMapping,
  parseDelimited,
  parseJsonFeed,
  rowsFromMatrix,
  loadPublicFeed,
  importRowsToBlocks,
  type ImportMapping,
  type ImportRow,
  type ImportTarget,
  type ImportField,
} from "@/lib/studio/newsletter/dataImport";
import { Choice, Field } from "./AppearanceControls";
export default function DataImportDialog({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (blocks: StudioBlock[]) => void;
}) {
  const { designSystem } = useDesignSystem();
  const [rows, setRows] = React.useState<ImportRow[]>([]);
  const [mapping, setMapping] = React.useState<ImportMapping>({});
  const [target, setTarget] = React.useState<ImportTarget>("coupon");
  const [columns, setColumns] = React.useState("3");
  const [url, setUrl] = React.useState("");
  const [paste, setPaste] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const abort = React.useRef<AbortController | null>(null);
  const generation = React.useRef(0);
  const isOpen = React.useRef(open);
  isOpen.current = open;
  React.useEffect(() => {
    if (!open) {
      setRows([]);
      setMapping({});
      setPaste("");
      setUrl("");
      setError("");
      setBusy(false);
    }
    return () => {
      generation.current++;
      abort.current?.abort();
    };
  }, [open]);
  const current = (request: number) =>
    isOpen.current && generation.current === request;
  const beginRead = () => {
    abort.current?.abort();
    setRows([]);
    setMapping({});
    setError("");
    setBusy(true);
    return ++generation.current;
  };
  const close = () => {
    generation.current++;
    abort.current?.abort();
    setRows([]);
    setMapping({});
    setError("");
    setBusy(false);
    onClose();
  };
  const apply = (next: ImportRow[]) => {
    setRows(next);
    setMapping(inferImportMapping(Object.keys(next[0] || {})));
    setError("");
  };
  return (
    <Modal open={open} onClose={close}>
      <ModalDialog
        sx={{
          width: 820,
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "90dvh",
          overflowY: "auto",
          p: 3,
        }}
      >
        <Typography level="h4">Import newsletter content</Typography>
        <p className="nl-note">
          Upload Excel (.xlsx), CSV, TSV or JSON, paste spreadsheet rows, or
          load a public feed. Review the data before adding it. Imports create
          editable copies, never send a campaign or overwrite existing blocks.
        </p>
        <div className="nl-controls">
          <input
            aria-label="Upload newsletter data"
            type="file"
            accept=".xlsx,.csv,.tsv,.json"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const request = beginRead();
              try {
                if (file.size > IMPORT_MAX_BYTES)
                  throw new Error("Keep files below 2 MB.");
                if (/\.xlsx$/i.test(file.name)) {
                  const { readSheet } = await import("read-excel-file/browser");
                  const matrix = await readSheet(file);
                  if (current(request)) apply(rowsFromMatrix(matrix));
                } else {
                  const text = await file.text();
                  if (current(request))
                    apply(
                      /\.json$/i.test(file.name)
                        ? parseJsonFeed(text)
                        : parseDelimited(
                            text,
                            /\.tsv$/i.test(file.name) ? "\t" : undefined,
                          ),
                    );
                }
              } catch (err) {
                if (!current(request)) return;
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not read this file.",
                );
              } finally {
                if (current(request)) setBusy(false);
              }
            }}
          />
          <details>
            <summary>Paste spreadsheet rows</summary>
            <Field
              label="Tab-separated rows with column headings"
              multiline
              value={paste}
              onChange={setPaste}
            />
            <button
              type="button"
              className="nl-quiet"
              disabled={busy}
              onClick={() => {
                beginRead();
                try {
                  apply(parseDelimited(paste));
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Could not parse the data.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Read pasted rows
            </button>
          </details>
          <details>
            <summary>Load a data feed</summary>
            <Field
              label="Public CSV or JSON feed URL"
              value={url}
              onChange={setUrl}
              placeholder="https://example.com/promotions.json"
            />
            <button
              type="button"
              className="nl-quiet"
              disabled={busy || !url.trim()}
              onClick={async () => {
                const request = beginRead();
                const controller = new AbortController();
                abort.current = controller;
                const timeout = setTimeout(() => controller.abort(), 15000);
                try {
                  const result = await loadPublicFeed(url, controller.signal);
                  if (current(request)) apply(result);
                } catch (err) {
                  if (!current(request)) return;
                  setError(
                    err instanceof Error && err.name === "AbortError"
                      ? "The feed request timed out or was cancelled."
                      : err instanceof Error
                        ? err.message
                        : "Could not load this feed. The host may not allow browser access.",
                  );
                } finally {
                  clearTimeout(timeout);
                  if (current(request)) setBusy(false);
                }
              }}
            >
              Load and preview feed
            </button>
            <p className="nl-note">
              Feeds must allow cross-origin browser access. This takes a
              snapshot when loaded; it does not change sent emails or
              automatically refresh a scheduled campaign.
            </p>
          </details>
          {rows.length > 0 && (
            <>
              <div className="nl-grid-2">
                <Choice
                  label="Create"
                  value={target}
                  onChange={(value) => setTarget(value as ImportTarget)}
                  options={[
                    { value: "coupon", label: "Coupon / promotion cards" },
                    { value: "product-card", label: "Product cards" },
                    { value: "product-gallery", label: "Product gallery rows" },
                    { value: "image-gallery", label: "Image gallery rows" },
                    { value: "data-table", label: "Data table" },
                  ]}
                />
                {target.includes("gallery") && (
                  <Choice
                    label="Items across each row"
                    value={columns}
                    onChange={setColumns}
                    options={[1, 2, 3, 4].map((n) => ({
                      value: String(n),
                      label: String(n),
                    }))}
                  />
                )}
              </div>
              {target !== "data-table" && (
                <details open>
                  <summary>Map spreadsheet columns</summary>
                  <div className="nl-grid-2">
                    {(Object.keys(IMPORT_FIELDS) as ImportField[]).map(
                      (field) => (
                        <Choice
                          key={field}
                          label={IMPORT_FIELDS[field]}
                          value={mapping[field] || ""}
                          onChange={(value) =>
                            setMapping((current) => ({
                              ...current,
                              [field]: value || undefined,
                            }))
                          }
                          options={[
                            { value: "", label: "Skip this field" },
                            ...Object.keys(rows[0]).map((value) => ({
                              value,
                              label: value,
                            })),
                          ]}
                        />
                      ),
                    )}
                  </div>
                </details>
              )}
              <p className="nl-note">
                {rows.length} rows loaded. First five rows shown below.
              </p>
              <div style={{ overflow: "auto", maxHeight: 240 }}>
                <table
                  style={{
                    borderCollapse: "collapse",
                    width: "100%",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr>
                      {Object.keys(rows[0]).map((key) => (
                        <th
                          key={key}
                          style={{
                            padding: 8,
                            textAlign: "left",
                            border: "1px solid #bac8cb",
                          }}
                        >
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 5).map((row, index) => (
                      <tr key={index}>
                        {Object.entries(row).map(([key, value]) => (
                          <td
                            key={key}
                            style={{
                              padding: 8,
                              border: "1px solid #d2dbdd",
                              maxWidth: 200,
                              overflowWrap: "anywhere",
                            }}
                          >
                            {value.slice(0, 160)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {busy && (
            <p role="status" className="nl-note">
              Reading data…
            </p>
          )}
          {error && (
            <p role="alert" className="nl-error">
              {error}
            </p>
          )}
          <div
            className="nl-inline"
            style={{ marginTop: 20, justifyContent: "flex-end" }}
          >
            <button type="button" className="nl-quiet" onClick={close}>
              Cancel
            </button>
            <button
              type="button"
              className="nl-action"
              disabled={busy || !rows.length}
              onClick={() => {
                try {
                  const blocks = importRowsToBlocks(
                    rows,
                    target,
                    mapping,
                    designSystem,
                    Number(columns),
                  );
                  onInsert(blocks);
                  setRows([]);
                  setPaste("");
                  close();
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "Please check the mapped columns.",
                  );
                }
              }}
            >
              Add to newsletter
            </button>
          </div>
        </div>
      </ModalDialog>
    </Modal>
  );
}
