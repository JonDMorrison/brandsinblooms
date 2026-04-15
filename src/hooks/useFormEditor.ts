import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ToastAction } from "@/components/ui-legacy/toast";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "@/hooks/useForms";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Database, Json } from "@/integrations/supabase/types";
import {
  DEFAULT_FORM_AUDIENCE,
  DEFAULT_FORM_COMPLIANCE,
  DEFAULT_FORM_SETTINGS,
  Form,
  FormAudience,
  FormCompliance,
  FormField,
  FormSettings,
  FormStatus,
  FormWithStats,
} from "@/types/formBuilder";
import { normalizeFormSettings } from "@/lib/forms/designSettings";

type FormRow = Database["public"]["Tables"]["forms"]["Row"];
type SaveStatus = "saved" | "pending" | "saving" | "error";

interface EditorState {
  name: string;
  fields: FormField[];
  settings: FormSettings;
  compliance: FormCompliance;
  audience: FormAudience;
}

interface ApplyTemplateInput {
  name?: string;
  fields_json?: FormField[];
  settings_json?: FormSettings;
  compliance_json?: FormCompliance;
}

interface QueuedSave {
  force: boolean;
  resolvers: Array<(result: boolean) => void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeSettings(value: unknown): FormSettings {
  return normalizeFormSettings(value);
}

function normalizeCompliance(value: unknown): FormCompliance {
  const candidate = isRecord(value) ? (value as Partial<FormCompliance>) : {};

  return {
    ...DEFAULT_FORM_COMPLIANCE,
    ...candidate,
  };
}

function normalizeAudience(value: unknown): FormAudience {
  const candidate = isRecord(value) ? (value as Partial<FormAudience>) : {};

  return {
    assign_personas: Array.isArray(candidate.assign_personas)
      ? candidate.assign_personas.filter(
          (personaId): personaId is string => typeof personaId === "string",
        )
      : [],
    assign_tags: Array.isArray(candidate.assign_tags)
      ? candidate.assign_tags.filter(
          (tagId): tagId is string => typeof tagId === "string",
        )
      : [],
  };
}

function normalizeFields(value: unknown): FormField[] {
  return Array.isArray(value) ? (value as FormField[]) : [];
}

function mapFormRow(row: FormRow): Form {
  return {
    ...row,
    fields_json: normalizeFields(row.fields_json),
    settings_json: normalizeSettings(row.settings_json),
    compliance_json: normalizeCompliance(row.compliance_json),
    audience_json: normalizeAudience(row.audience_json),
  };
}

function createEditorState(form: Form): EditorState {
  return {
    name: form.name,
    fields: form.fields_json,
    settings: form.settings_json,
    compliance: form.compliance_json,
    audience: form.audience_json,
  };
}

function serializeEditorState(state: EditorState): string {
  return JSON.stringify(state);
}

export function useFormEditor(formId: string | undefined) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { tenant, loading: tenantLoading, error: tenantError } = useTenant();
  const tenantId = tenant?.id;
  const formQuery = useForm(formId, tenantId);

  const [savedForm, setSavedForm] = useState<Form | null>(null);
  const [name, setName] = useState("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [settings, setSettings] = useState<FormSettings>(DEFAULT_FORM_SETTINGS);
  const [compliance, setCompliance] = useState<FormCompliance>(
    DEFAULT_FORM_COMPLIANCE,
  );
  const [audience, setAudience] = useState<FormAudience>(DEFAULT_FORM_AUDIENCE);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  const isMountedRef = useRef(true);
  const hydratedFormIdRef = useRef<string | null>(null);
  const workingStateRef = useRef<EditorState>({
    name: "",
    fields: [],
    settings: DEFAULT_FORM_SETTINGS,
    compliance: DEFAULT_FORM_COMPLIANCE,
    audience: DEFAULT_FORM_AUDIENCE,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSaveRef = useRef<Promise<boolean> | null>(null);
  const queuedSaveRef = useRef<QueuedSave | null>(null);
  const requestSaveRef = useRef<(force?: boolean) => Promise<boolean>>(
    async () => false,
  );
  const lastSavedSnapshotRef = useRef("");
  const lastFailedSnapshotRef = useRef<string | null>(null);

  const currentSnapshot = useMemo(
    () =>
      serializeEditorState({
        name,
        fields,
        settings,
        compliance,
        audience,
      }),
    [name, fields, settings, compliance, audience],
  );

  const hasUnsavedChanges = Boolean(savedForm)
    ? currentSnapshot !== lastSavedSnapshotRef.current
    : false;

  const form = useMemo(() => {
    if (!savedForm) {
      return null;
    }

    return {
      ...savedForm,
      name,
      fields_json: fields,
      settings_json: settings,
      compliance_json: compliance,
      audience_json: audience,
    };
  }, [savedForm, name, fields, settings, compliance, audience]);

  const updateCaches = useCallback(
    (nextForm: Form) => {
      queryClient.setQueryData(["form", tenantId, nextForm.id], nextForm);
      queryClient.setQueryData<FormWithStats[] | undefined>(
        ["forms"],
        (currentForms) =>
          currentForms?.map((currentForm) =>
            currentForm.id === nextForm.id
              ? { ...currentForm, ...nextForm }
              : currentForm,
          ),
      );
    },
    [queryClient, tenantId],
  );

  const performSave = useCallback(
    async (force = false): Promise<boolean> => {
      if (!formId || !tenantId) {
        return false;
      }

      const nextState = workingStateRef.current;
      const snapshot = serializeEditorState(nextState);

      if (!force) {
        if (snapshot === lastSavedSnapshotRef.current) {
          if (isMountedRef.current) {
            setSaveStatus("saved");
            setSaveError(null);
          }
          return true;
        }

        if (snapshot === lastFailedSnapshotRef.current) {
          if (isMountedRef.current) {
            setSaveStatus("error");
          }
          return false;
        }
      } else {
        lastFailedSnapshotRef.current = null;
      }

      if (isMountedRef.current) {
        setSaveStatus("saving");
        setSaveError(null);
      }

      try {
        const { data, error } = await supabase
          .from("forms")
          .update({
            name: nextState.name,
            fields_json: nextState.fields as unknown as Json,
            settings_json: nextState.settings as unknown as Json,
            compliance_json: nextState.compliance as unknown as Json,
            audience_json: nextState.audience as unknown as Json,
          })
          .eq("id", formId)
          .eq("tenant_id", tenantId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        const nextForm = mapFormRow(data as FormRow);
        lastSavedSnapshotRef.current = snapshot;
        lastFailedSnapshotRef.current = null;
        updateCaches(nextForm);

        if (isMountedRef.current) {
          setSavedForm(nextForm);

          const latestSnapshot = serializeEditorState(workingStateRef.current);
          setSaveStatus(latestSnapshot === snapshot ? "saved" : "pending");
          setSaveError(null);
        }

        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to save form.";

        lastFailedSnapshotRef.current = snapshot;

        if (isMountedRef.current) {
          setSaveStatus("error");
          setSaveError(message);
          toast({
            title: "Error saving form",
            description: message,
            variant: "destructive",
            action: createElement(
              ToastAction,
              {
                altText: "Retry save",
                onClick: () => {
                  void requestSaveRef.current(true);
                },
              },
              "Retry Save",
            ),
          });
        }

        return false;
      }
    },
    [formId, tenantId, toast, updateCaches],
  );

  const processQueuedSave = useCallback(() => {
    if (activeSaveRef.current || !queuedSaveRef.current) {
      return;
    }

    const queuedSave = queuedSaveRef.current;
    queuedSaveRef.current = null;

    const savePromise = performSave(queuedSave.force);
    activeSaveRef.current = savePromise;

    void savePromise
      .then((result) => {
        queuedSave.resolvers.forEach((resolve) => resolve(result));
      })
      .finally(() => {
        activeSaveRef.current = null;

        if (queuedSaveRef.current) {
          processQueuedSave();
        }
      });
  }, [performSave]);

  const requestSave = useCallback(
    (force = false): Promise<boolean> => {
      if (activeSaveRef.current) {
        return new Promise<boolean>((resolve) => {
          if (queuedSaveRef.current) {
            queuedSaveRef.current.force = queuedSaveRef.current.force || force;
            queuedSaveRef.current.resolvers.push(resolve);
            return;
          }

          queuedSaveRef.current = {
            force,
            resolvers: [resolve],
          };
        });
      }

      const savePromise = performSave(force);
      activeSaveRef.current = savePromise;

      return savePromise.finally(() => {
        activeSaveRef.current = null;

        if (queuedSaveRef.current) {
          processQueuedSave();
        }
      });
    },
    [performSave, processQueuedSave],
  );

  const saveNow = useCallback(
    async (options?: { force?: boolean }) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      return requestSave(options?.force ?? false);
    },
    [requestSave],
  );

  const retrySave = useCallback(() => saveNow({ force: true }), [saveNow]);

  const updateStatus = useCallback(
    async (nextStatus: FormStatus) => {
      if (!formId || !tenantId) {
        return null;
      }

      setIsStatusUpdating(true);

      try {
        const { data, error } = await supabase
          .from("forms")
          .update({ status: nextStatus })
          .eq("id", formId)
          .eq("tenant_id", tenantId)
          .select()
          .single();

        if (error) {
          throw error;
        }

        const nextForm = mapFormRow(data as FormRow);
        updateCaches(nextForm);

        if (isMountedRef.current) {
          setSavedForm(nextForm);
        }

        return nextForm;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : nextStatus === "published"
              ? "Unable to publish form."
              : "Unable to unpublish form.";

        if (isMountedRef.current) {
          toast({
            title:
              nextStatus === "published"
                ? "Error publishing form"
                : "Error unpublishing form",
            description: message,
            variant: "destructive",
          });
        }

        return null;
      } finally {
        if (isMountedRef.current) {
          setIsStatusUpdating(false);
        }
      }
    },
    [formId, tenantId, toast, updateCaches],
  );

  const applyTemplate = useCallback((template: ApplyTemplateInput) => {
    if (template.name) {
      setName(template.name);
    }

    if (template.fields_json) {
      setFields(template.fields_json);
    }

    if (template.settings_json) {
      setSettings(normalizeSettings(template.settings_json));
    }

    if (template.compliance_json) {
      setCompliance(normalizeCompliance(template.compliance_json));
    }
  }, []);

  useEffect(() => {
    requestSaveRef.current = requestSave;
  }, [requestSave]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    workingStateRef.current = {
      name,
      fields,
      settings,
      compliance,
      audience,
    };
  }, [name, fields, settings, compliance, audience]);

  useEffect(() => {
    if (!formQuery.data) {
      return;
    }

    if (hydratedFormIdRef.current === formQuery.data.id) {
      return;
    }

    const nextState = createEditorState(formQuery.data);
    const snapshot = serializeEditorState(nextState);

    hydratedFormIdRef.current = formQuery.data.id;
    lastSavedSnapshotRef.current = snapshot;
    lastFailedSnapshotRef.current = null;
    workingStateRef.current = nextState;

    setSavedForm(formQuery.data);
    setName(nextState.name);
    setFields(nextState.fields);
    setSettings(nextState.settings);
    setCompliance(nextState.compliance);
    setAudience(nextState.audience);
    setSaveStatus("saved");
    setSaveError(null);
  }, [formQuery.data]);

  useEffect(() => {
    if (!savedForm) {
      return;
    }

    if (!hasUnsavedChanges) {
      if (saveStatus !== "saving" && saveStatus !== "saved") {
        setSaveStatus("saved");
        setSaveError(null);
      }
      return;
    }

    if (saveStatus === "saving") {
      return;
    }

    if (saveStatus === "error") {
      if (currentSnapshot === lastFailedSnapshotRef.current) {
        return;
      }

      setSaveStatus("pending");
      setSaveError(null);
      return;
    }

    if (saveStatus === "saved") {
      setSaveStatus("pending");
    }
  }, [currentSnapshot, hasUnsavedChanges, saveStatus, savedForm]);

  useEffect(() => {
    if (!savedForm) {
      return;
    }

    if (!hasUnsavedChanges) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      return;
    }

    if (
      saveStatus === "error" &&
      currentSnapshot === lastFailedSnapshotRef.current
    ) {
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void requestSave();
    }, 2000);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [currentSnapshot, hasUnsavedChanges, requestSave, saveStatus, savedForm]);

  return {
    tenantId,
    form,
    savedForm,
    name,
    setName,
    fields,
    setFields,
    settings,
    setSettings,
    compliance,
    setCompliance,
    audience,
    setAudience,
    applyTemplate,
    hasUnsavedChanges,
    saveStatus,
    saveError,
    isStatusUpdating,
    isLoading: tenantLoading || formQuery.isLoading,
    loadError: tenantError || formQuery.error,
    saveNow,
    retrySave,
    updateStatus,
  };
}
