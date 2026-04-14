import React, { useEffect, useState } from "react";
import {
  AlignLeft,
  BellRing,
  ChevronDown,
  Layout,
  Palette,
  RotateCcw,
  Settings2,
  Type,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/NativeSelect";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useBrandColors } from "@/hooks/useBrandColors";
import {
  FORM_BACKGROUND_STYLE_OPTIONS,
  FORM_BORDER_RADIUS_OPTIONS,
  FORM_BUTTON_SHAPE_OPTIONS,
  FORM_BUTTON_STYLE_OPTIONS,
  FORM_BUTTON_WIDTH_OPTIONS,
  FORM_FONT_FAMILY_OPTIONS,
  FORM_INPUT_STYLE_OPTIONS,
  FORM_SPACING_OPTIONS,
  FORM_WIDTH_OPTIONS,
  GOOGLE_FONT_OPTIONS,
  isValidHexColor,
  normalizeFormSettings,
} from "@/lib/forms/designSettings";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FORM_SETTINGS,
  FormBackgroundStyle,
  FormButtonShape,
  FormButtonStyle,
  FormButtonWidth,
  FormInputStyle,
  FormSettings,
} from "@/types/formBuilder";

interface FormDesignTabProps {
  settings: FormSettings;
  onSettingsChange: (settings: FormSettings) => void;
}

type SectionKey =
  | "header"
  | "colors"
  | "typography"
  | "layout"
  | "behavior"
  | "notifications";

const SECTION_DEFAULTS: Record<SectionKey, boolean> = {
  header: true,
  colors: true,
  typography: true,
  layout: true,
  behavior: true,
  notifications: true,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function FormDesignTab({
  settings,
  onSettingsChange,
}: FormDesignTabProps) {
  const normalizedSettings = normalizeFormSettings(settings);
  const { data: brandColors } = useBrandColors();
  const [openSections, setOpenSections] =
    useState<Record<SectionKey, boolean>>(SECTION_DEFAULTS);
  const [pendingEmail, setPendingEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitButtonTextDraft, setSubmitButtonTextDraft] = useState(
    normalizedSettings.submit_button_text,
  );
  const [successMessageDraft, setSuccessMessageDraft] = useState(
    normalizedSettings.success_message,
  );
  const [successRedirectUrlDraft, setSuccessRedirectUrlDraft] = useState(
    normalizedSettings.success_redirect_url ?? "",
  );
  const [isSubmitButtonFocused, setIsSubmitButtonFocused] = useState(false);
  const [isSuccessMessageFocused, setIsSuccessMessageFocused] = useState(false);
  const [isSuccessRedirectFocused, setIsSuccessRedirectFocused] = useState(false);

  const updateSettings = (updates: Partial<FormSettings>) => {
    onSettingsChange(
      normalizeFormSettings({
        ...normalizedSettings,
        ...updates,
      }),
    );
  };

  const updateRawSettings = (updates: Partial<FormSettings>) => {
    onSettingsChange({
      ...settings,
      ...updates,
    });
  };

  const updateTheme = (updates: Partial<FormSettings["theme"]>) => {
    updateSettings({
      theme: {
        ...normalizedSettings.theme,
        ...updates,
      },
    });
  };

  const toggleSection = (key: SectionKey, open: boolean) => {
    setOpenSections((current) => ({ ...current, [key]: open }));
  };

  useEffect(() => {
    if (!isSubmitButtonFocused) {
      setSubmitButtonTextDraft(normalizedSettings.submit_button_text);
    }
  }, [isSubmitButtonFocused, normalizedSettings.submit_button_text]);

  useEffect(() => {
    if (!isSuccessMessageFocused) {
      setSuccessMessageDraft(normalizedSettings.success_message);
    }
  }, [isSuccessMessageFocused, normalizedSettings.success_message]);

  useEffect(() => {
    if (!isSuccessRedirectFocused) {
      setSuccessRedirectUrlDraft(normalizedSettings.success_redirect_url ?? "");
    }
  }, [isSuccessRedirectFocused, normalizedSettings.success_redirect_url]);

  const handleResetBrandColors = () => {
    updateTheme({
      primary_color:
        brandColors?.primary ?? DEFAULT_FORM_SETTINGS.theme.primary_color,
      secondary_color:
        brandColors?.secondary ?? DEFAULT_FORM_SETTINGS.theme.secondary_color,
      text_color: brandColors?.text ?? DEFAULT_FORM_SETTINGS.theme.text_color,
      background_color:
        brandColors?.background ?? DEFAULT_FORM_SETTINGS.theme.background_color,
    });
  };

  const addNotificationEmail = () => {
    const nextEmail = pendingEmail.trim().replace(/,+$/, "").toLowerCase();

    if (!nextEmail) {
      setEmailError(null);
      return;
    }

    if (!EMAIL_REGEX.test(nextEmail)) {
      setEmailError("Enter a valid email address before adding it.");
      return;
    }

    if (normalizedSettings.notification_emails.includes(nextEmail)) {
      setEmailError("That email is already in the notification list.");
      return;
    }

    updateSettings({
      notification_emails: [
        ...normalizedSettings.notification_emails,
        nextEmail,
      ],
    });
    setPendingEmail("");
    setEmailError(null);
  };

  const removeNotificationEmail = (email: string) => {
    updateSettings({
      notification_emails: normalizedSettings.notification_emails.filter(
        (currentEmail) => currentEmail !== email,
      ),
    });
  };

  return (
    <div className="space-y-4">
      <DesignSection
        title="Header Content"
        description="Control the hero copy and form introduction above the fields."
        icon={AlignLeft}
        open={openSections.header}
        onOpenChange={(open) => toggleSection("header", open)}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="form_title">Form Title</Label>
            <Input
              id="form_title"
              value={normalizedSettings.form_title ?? ""}
              onChange={(event) =>
                updateSettings({ form_title: event.target.value })
              }
              placeholder="Join our newsletter"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="form_description">Form Description</Label>
            <Textarea
              id="form_description"
              value={normalizedSettings.form_description ?? ""}
              onChange={(event) =>
                updateSettings({ form_description: event.target.value })
              }
              placeholder="Tell visitors what they get when they sign up."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="form_headline">Form Headline</Label>
            <Input
              id="form_headline"
              value={normalizedSettings.form_headline ?? ""}
              onChange={(event) =>
                updateSettings({ form_headline: event.target.value })
              }
              placeholder="Stay in the loop"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="form_subheadline">Form Subheadline</Label>
            <Input
              id="form_subheadline"
              value={normalizedSettings.form_subheadline ?? ""}
              onChange={(event) =>
                updateSettings({ form_subheadline: event.target.value })
              }
              placeholder="Weekly updates, event reminders, and product launches."
            />
          </div>
        </div>
      </DesignSection>

      <DesignSection
        title="Colors & Theme"
        description="Set the palette used for buttons, text, accents, and the form surface."
        icon={Palette}
        open={openSections.colors}
        onOpenChange={(open) => toggleSection("colors", open)}
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetBrandColors}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset to Brand Colors
          </Button>
        }
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <ColorField
            id="primary_color"
            label="Primary Color"
            value={
              normalizedSettings.theme.primary_color ??
              DEFAULT_FORM_SETTINGS.theme.primary_color ??
              "#22C55E"
            }
            helperText="Buttons, focus rings, and active states."
            onChange={(value) => updateTheme({ primary_color: value })}
          />
          <ColorField
            id="secondary_color"
            label="Secondary Color"
            value={
              normalizedSettings.theme.secondary_color ??
              DEFAULT_FORM_SETTINGS.theme.secondary_color ??
              "#1E40AF"
            }
            helperText="Accents and supportive emphasis."
            onChange={(value) => updateTheme({ secondary_color: value })}
          />
          <ColorField
            id="text_color"
            label="Text Color"
            value={
              normalizedSettings.theme.text_color ??
              DEFAULT_FORM_SETTINGS.theme.text_color ??
              "#1F2937"
            }
            helperText="Labels, headings, descriptions, and body copy."
            onChange={(value) => updateTheme({ text_color: value })}
          />
          <ColorField
            id="background_color"
            label="Background Color"
            value={
              normalizedSettings.theme.background_color ??
              DEFAULT_FORM_SETTINGS.theme.background_color ??
              "#FFFFFF"
            }
            helperText="The form container background."
            onChange={(value) => updateTheme({ background_color: value })}
          />
        </div>

        <RadioCardGroup
          title="Background Style"
          value={normalizedSettings.theme.background_style ?? "white"}
          onValueChange={(value) =>
            updateTheme({ background_style: value as FormBackgroundStyle })
          }
          columns={4}
          options={FORM_BACKGROUND_STYLE_OPTIONS}
        />
      </DesignSection>

      <DesignSection
        title="Typography & Style"
        description="Choose the font system, curvature, and input or button treatments."
        icon={Type}
        open={openSections.typography}
        onOpenChange={(open) => toggleSection("typography", open)}
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="font_family">Font Family</Label>
            <NativeSelect
              label=""
              value={
                normalizedSettings.theme.font_family ??
                DEFAULT_FORM_SETTINGS.theme.font_family ??
                "inter"
              }
              onChange={(event) =>
                updateTheme({
                  font_family: event.target
                    .value as FormSettings["theme"]["font_family"],
                })
              }
              options={FORM_FONT_FAMILY_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="google_font">Google Font</Label>
            <NativeSelect
              label=""
              value={normalizedSettings.theme.google_font ?? ""}
              onChange={(event) =>
                updateTheme({ google_font: event.target.value })
              }
              options={GOOGLE_FONT_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
            <p className="text-xs text-muted-foreground">
              Overrides the base font with a Google Font. Leave on "Inherit" to use the system font above.
            </p>
          </div>

          <RadioCardGroup
            title="Border Radius"
            value={
              normalizedSettings.theme.border_radius ??
              DEFAULT_FORM_SETTINGS.theme.border_radius ??
              "8px"
            }
            onValueChange={(value) =>
              updateTheme({
                border_radius: value as FormSettings["theme"]["border_radius"],
              })
            }
            columns={5}
            options={FORM_BORDER_RADIUS_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
          />

          <RadioCardGroup
            title="Button Style"
            value={
              normalizedSettings.theme.button_style ??
              DEFAULT_FORM_SETTINGS.theme.button_style ??
              "filled"
            }
            onValueChange={(value) =>
              updateTheme({ button_style: value as FormButtonStyle })
            }
            columns={3}
            options={FORM_BUTTON_STYLE_OPTIONS}
          />

          <RadioCardGroup
            title="Button Shape"
            value={normalizedSettings.theme.button_shape ?? "rounded"}
            onValueChange={(value) =>
              updateTheme({ button_shape: value as FormButtonShape })
            }
            columns={3}
            options={FORM_BUTTON_SHAPE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              description: o.radius,
            }))}
          />

          <RadioCardGroup
            title="Button Width"
            value={normalizedSettings.theme.button_width ?? "full"}
            onValueChange={(value) =>
              updateTheme({ button_width: value as FormButtonWidth })
            }
            columns={3}
            options={FORM_BUTTON_WIDTH_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
          />

          <RadioCardGroup
            title="Input Style"
            value={
              normalizedSettings.theme.input_style ??
              DEFAULT_FORM_SETTINGS.theme.input_style ??
              "outlined"
            }
            onValueChange={(value) =>
              updateTheme({ input_style: value as FormInputStyle })
            }
            columns={3}
            options={FORM_INPUT_STYLE_OPTIONS}
          />
        </div>
      </DesignSection>

      <DesignSection
        title="Layout"
        description="Set the form width, field grid, and spacing density."
        icon={Layout}
        open={openSections.layout}
        onOpenChange={(open) => toggleSection("layout", open)}
      >
        <div className="space-y-6">
          <RadioCardGroup
            title="Form Width"
            value={
              normalizedSettings.form_width ??
              DEFAULT_FORM_SETTINGS.form_width ??
              "medium"
            }
            onValueChange={(value) =>
              updateSettings({
                form_width: value as FormSettings["form_width"],
              })
            }
            columns={4}
            options={FORM_WIDTH_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
              description: option.maxWidth,
            }))}
          />

          <RadioCardGroup
            title="Columns"
            value={String(normalizedSettings.columns ?? 1)}
            onValueChange={(value) =>
              updateSettings({ columns: value === "2" ? 2 : 1 })
            }
            columns={2}
            options={[
              {
                value: "1",
                label: "1 Column",
                description: "Stack fields in a single column",
              },
              {
                value: "2",
                label: "2 Columns",
                description: "Use a two-column grid when space allows",
              },
            ]}
          />

          <RadioCardGroup
            title="Spacing"
            value={
              normalizedSettings.theme.spacing ??
              DEFAULT_FORM_SETTINGS.theme.spacing ??
              "normal"
            }
            onValueChange={(value) =>
              updateTheme({
                spacing: value as FormSettings["theme"]["spacing"],
              })
            }
            columns={3}
            options={FORM_SPACING_OPTIONS.map((option) => ({
              value: option.value,
              label: option.label,
              description: option.px,
            }))}
          />
        </div>
      </DesignSection>

      <DesignSection
        title="Behavior"
        description="Control the submit action, confirmation message, redirect, and branding footer."
        icon={Settings2}
        open={openSections.behavior}
        onOpenChange={(open) => toggleSection("behavior", open)}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="submit_button_text">Submit Button Text</Label>
            <Input
              id="submit_button_text"
              value={submitButtonTextDraft}
              onFocus={() => setIsSubmitButtonFocused(true)}
              onChange={(event) => {
                setSubmitButtonTextDraft(event.target.value);
                updateRawSettings({ submit_button_text: event.target.value });
              }}
              onBlur={(event) => {
                setIsSubmitButtonFocused(false);
                const nextValue =
                  event.target.value.trim() ||
                  DEFAULT_FORM_SETTINGS.submit_button_text;
                setSubmitButtonTextDraft(nextValue);
                updateSettings({ submit_button_text: nextValue });
              }}
              placeholder="Submit"
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="success_message">Success Message</Label>
            <Textarea
              id="success_message"
              value={successMessageDraft}
              onFocus={() => setIsSuccessMessageFocused(true)}
              onChange={(event) => {
                setSuccessMessageDraft(event.target.value);
                updateRawSettings({ success_message: event.target.value });
              }}
              onBlur={(event) => {
                setIsSuccessMessageFocused(false);
                const nextValue =
                  event.target.value.trim() ||
                  DEFAULT_FORM_SETTINGS.success_message;
                setSuccessMessageDraft(nextValue);
                updateSettings({ success_message: nextValue });
              }}
              placeholder="Thank you for your submission!"
              rows={3}
            />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="success_redirect_url">Redirect URL</Label>
            <Input
              id="success_redirect_url"
              value={successRedirectUrlDraft}
              onFocus={() => setIsSuccessRedirectFocused(true)}
              onChange={(event) => {
                setSuccessRedirectUrlDraft(event.target.value);
                updateRawSettings({ success_redirect_url: event.target.value });
              }}
              onBlur={(event) => {
                setIsSuccessRedirectFocused(false);
                const nextValue = event.target.value.trim();
                setSuccessRedirectUrlDraft(nextValue);
                updateSettings({
                  success_redirect_url: nextValue || null,
                });
              }}
              placeholder="https://example.com/thank-you"
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4 lg:col-span-2">
            <div className="space-y-1">
              <Label htmlFor="show_branding">Show Branding</Label>
              <p className="text-sm text-muted-foreground">
                Display a Powered by BloomSuite footer below the form.
              </p>
            </div>
            <Switch
              id="show_branding"
              checked={normalizedSettings.show_branding}
              onCheckedChange={(checked) =>
                updateSettings({ show_branding: checked })
              }
            />
          </div>
        </div>
      </DesignSection>

      <DesignSection
        title="Notifications"
        description="Store the recipients who should be notified when this form is submitted."
        icon={BellRing}
        open={openSections.notifications}
        onOpenChange={(open) => toggleSection("notifications", open)}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notification_emails">Notification Emails</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="notification_emails"
                value={pendingEmail}
                onChange={(event) => {
                  setPendingEmail(event.target.value);
                  if (emailError) {
                    setEmailError(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addNotificationEmail();
                  }
                }}
                placeholder="team@example.com"
              />
              <Button type="button" onClick={addNotificationEmail}>
                Add Email
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              FB-008 handles notification routing. This milestone stores the
              list only.
            </p>
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>

          {normalizedSettings.notification_emails.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {normalizedSettings.notification_emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
                >
                  {email}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => removeNotificationEmail(email)}
                    aria-label={`Remove ${email}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </DesignSection>
    </div>
  );
}

interface DesignSectionProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}

function DesignSection({
  title,
  description,
  icon: Icon,
  open,
  onOpenChange,
  action,
  children,
}: DesignSectionProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className="rounded-xl bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-foreground">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>

          {action && <div className="shrink-0">{action}</div>}
        </div>

        <CollapsibleContent>
          <div className="px-4 py-4 sm:px-5">{children}</div>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  helperText?: string;
  onChange: (value: string) => void;
}

function ColorField({
  id,
  label,
  value,
  helperText,
  onChange,
}: ColorFieldProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  const normalizedDraft = normalizeHexDraft(draft);
  const previewColor = isValidHexColor(normalizedDraft)
    ? normalizedDraft
    : value;

  const commitDraft = () => {
    if (!draft.trim()) {
      setDraft(value);
      setError(null);
      return;
    }

    if (!isValidHexColor(normalizedDraft)) {
      setError("Use a valid hex color like #22C55E.");
      return;
    }

    const nextValue = normalizedDraft.toUpperCase();
    setDraft(nextValue);
    setError(null);
    onChange(nextValue);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <span
          className="h-10 w-10 shrink-0 rounded-xl border border-border shadow-inner"
          style={{ backgroundColor: previewColor }}
          aria-hidden="true"
        />
        <Input
          id={id}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) {
              setError(null);
            }
          }}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          placeholder="#22C55E"
        />
        <Input
          type="color"
          value={previewColor}
          onChange={(event) => {
            const nextValue = event.target.value.toUpperCase();
            setDraft(nextValue);
            setError(null);
            onChange(nextValue);
          }}
          className="h-10 w-14 shrink-0 cursor-pointer p-1"
        />
      </div>
      {helperText && !error && (
        <p className="text-sm text-muted-foreground">{helperText}</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

interface RadioCardGroupProps {
  title: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  columns: 2 | 3 | 4 | 5;
}

function RadioCardGroup({
  title,
  value,
  onValueChange,
  options,
  columns,
}: RadioCardGroupProps) {
  return (
    <div className="space-y-3">
      <Label>{title}</Label>
      <RadioGroup
        value={value}
        onValueChange={onValueChange}
        className={cn(
          "grid gap-2",
          columns === 2 && "sm:grid-cols-2",
          columns === 3 && "sm:grid-cols-3",
          columns === 4 && "sm:grid-cols-2 xl:grid-cols-4",
          columns === 5 && "sm:grid-cols-2 xl:grid-cols-5",
        )}
      >
        {options.map((option) => {
          const optionId = `${title.replace(/\s+/g, "-").toLowerCase()}-${option.value}`;
          const selected = value === option.value;

          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border bg-background hover:border-primary/30 hover:bg-primary/5",
              )}
            >
              <RadioGroupItem
                id={optionId}
                value={option.value}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {option.label}
                </div>
                {option.description && (
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                )}
              </div>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}

function normalizeHexDraft(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}
