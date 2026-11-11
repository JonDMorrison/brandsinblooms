import { useCallback, useRef, useState, type ReactNode } from "react";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import ModalClose from "@mui/joy/ModalClose";
import Typography from "@mui/joy/Typography";
import Stack from "@mui/joy/Stack";
import FormControl from "@mui/joy/FormControl";
import FormLabel from "@mui/joy/FormLabel";
import FormHelperText from "@mui/joy/FormHelperText";
import Input from "@mui/joy/Input";
import Textarea from "@mui/joy/Textarea";
import Select from "@mui/joy/Select";
import Option from "@mui/joy/Option";
import Checkbox from "@mui/joy/Checkbox";
import Button from "@mui/joy/Button";

/**
 * A small, friendly form dialog that replaces window.prompt/confirm in Bloom Support.
 * `ask()` resolves with the entered values, or null if the person cancels.
 * Fixed choices are always selects or checkboxes, never free text.
 */
export type AskField =
  | { name: string; label: string; kind: "text" | "email" | "textarea"; placeholder?: string; helper?: string; required?: boolean; initial?: string }
  | { name: string; label: string; kind: "select"; options: Array<{ value: string; label: string; hint?: string }>; helper?: string; required?: boolean; initial?: string }
  | { name: string; label: string; kind: "checkboxes"; options: Array<{ value: string; label: string; hint?: string }>; helper?: string; initial?: string[] };

export interface AskOptions {
  title: string;
  description?: ReactNode;
  fields?: AskField[];
  confirmLabel?: string;
  tone?: "primary" | "danger";
}

export type AskValues = Record<string, string | string[]>;

type Pending = AskOptions & { resolve: (v: AskValues | null) => void };

const initialValues = (fields: AskField[] = []): AskValues =>
  Object.fromEntries(fields.map((f) => [f.name, f.kind === "checkboxes" ? f.initial ?? [] : f.initial ?? ""]));

export function useAskDialog() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [values, setValues] = useState<AskValues>({});
  const pendingRef = useRef<Pending | null>(null);

  const ask = useCallback((opts: AskOptions) => new Promise<AskValues | null>((resolve) => {
    const next = { ...opts, resolve };
    pendingRef.current = next;
    setValues(initialValues(opts.fields));
    setPending(next);
  }), []);

  const close = (result: AskValues | null) => {
    pendingRef.current?.resolve(result);
    pendingRef.current = null;
    setPending(null);
  };

  const missing = (pending?.fields ?? []).some((f) => f.kind !== "checkboxes" && f.required && !String(values[f.name] ?? "").trim());

  const dialog = (
    <Modal open={!!pending} onClose={() => close(null)}>
      <ModalDialog sx={{ width: "min(520px, 94vw)", borderRadius: "xl", p: 3 }}>
        <ModalClose />
        {pending && (
          <form onSubmit={(e) => { e.preventDefault(); if (!missing) close(values); }}>
            <Stack spacing={2.25}>
              <div>
                <Typography level="title-lg">{pending.title}</Typography>
                {pending.description && <Typography level="body-md" textColor="text.secondary" sx={{ mt: 0.5 }}>{pending.description}</Typography>}
              </div>
              {(pending.fields ?? []).map((f, i) => (
                <FormControl key={f.name} required={f.kind !== "checkboxes" && f.required}>
                  <FormLabel>{f.label}</FormLabel>
                  {f.kind === "text" || f.kind === "email" ? (
                    <Input autoFocus={i === 0} type={f.kind} placeholder={f.placeholder} value={String(values[f.name] ?? "")} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                  ) : f.kind === "textarea" ? (
                    <Textarea autoFocus={i === 0} minRows={3} placeholder={f.placeholder} value={String(values[f.name] ?? "")} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                  ) : f.kind === "select" ? (
                    <Select value={String(values[f.name] ?? "") || null} placeholder="Choose one" onChange={(_, val) => setValues((v) => ({ ...v, [f.name]: String(val ?? "") }))}>
                      {f.options.map((o) => (
                        <Option key={o.value} value={o.value} label={o.label}>
                          <Stack>
                            <Typography level="body-md">{o.label}</Typography>
                            {o.hint && <Typography level="body-xs" textColor="text.tertiary">{o.hint}</Typography>}
                          </Stack>
                        </Option>
                      ))}
                    </Select>
                  ) : f.kind === "checkboxes" ? (
                    <Stack spacing={1} sx={{ pt: 0.5 }}>
                      {f.options.map((o) => {
                        const list = (values[f.name] as string[]) ?? [];
                        return (
                          <Checkbox
                            key={o.value}
                            label={o.hint ? `${o.label} — ${o.hint}` : o.label}
                            checked={list.includes(o.value)}
                            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked ? [...list, o.value] : list.filter((x) => x !== o.value) }))}
                          />
                        );
                      })}
                    </Stack>
                  ) : null}
                  {f.helper && <FormHelperText>{f.helper}</FormHelperText>}
                </FormControl>
              ))}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button variant="plain" color="neutral" onClick={() => close(null)}>Cancel</Button>
                <Button type="submit" size="lg" color={pending.tone === "danger" ? "danger" : "primary"} disabled={missing} sx={{ borderRadius: "xl" }}>{pending.confirmLabel ?? "Save"}</Button>
              </Stack>
            </Stack>
          </form>
        )}
      </ModalDialog>
    </Modal>
  );

  return { ask, dialog };
}

/** Comma/line separated list helper for email-style inputs. */
export const splitList = (s: unknown) => String(s ?? "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
