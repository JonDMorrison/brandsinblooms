import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FormSettings, FormTheme } from '@/types/formBuilder';
import { NativeSelect } from '@/components/ui/NativeSelect';
import { 
  Palette, 
  Type, 
  Layout, 
  Settings2,
  Columns,
  AlignLeft,
  Box
} from 'lucide-react';

interface FormDesignTabProps {
  settings: FormSettings;
  onSettingsChange: (settings: FormSettings) => void;
}

// Extended theme type to include all allowlist properties
interface ExtendedTheme extends FormTheme {
  secondary_color?: string;
  text_color?: string;
  background_color?: string;
  input_style?: 'default' | 'underline' | 'filled';
}

interface ExtendedSettings extends Omit<FormSettings, 'theme'> {
  theme: ExtendedTheme;
  form_title?: string;
  form_description?: string;
  form_headline?: string;
  form_subheadline?: string;
  form_width?: 'narrow' | 'medium' | 'wide' | 'full';
  field_spacing?: string;
  label_position?: 'above' | 'inline' | 'floating';
  columns?: number;
}

export function FormDesignTab({ settings, onSettingsChange }: FormDesignTabProps) {
  const extendedSettings = settings as ExtendedSettings;

  const updateTheme = (updates: Partial<ExtendedTheme>) => {
    onSettingsChange({
      ...settings,
      theme: { ...settings.theme, ...updates },
    } as FormSettings);
  };

  const updateSettings = (updates: Partial<ExtendedSettings>) => {
    onSettingsChange({
      ...settings,
      ...updates,
    } as FormSettings);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Colors
            </CardTitle>
            <CardDescription>Brand colors for your form</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ColorPicker
              label="Primary Color"
              value={extendedSettings.theme.primary_color || '#22C55E'}
              onChange={(color) => updateTheme({ primary_color: color })}
              helperText="Used for buttons and accents"
            />
            <ColorPicker
              label="Secondary Color"
              value={extendedSettings.theme.secondary_color || '#1E40AF'}
              onChange={(color) => updateTheme({ secondary_color: color })}
              helperText="Used for secondary elements"
            />
            <ColorPicker
              label="Text Color"
              value={extendedSettings.theme.text_color || '#1F2937'}
              onChange={(color) => updateTheme({ text_color: color })}
              helperText="Labels and body text"
            />
            <ColorPicker
              label="Background Color"
              value={extendedSettings.theme.background_color || '#FFFFFF'}
              onChange={(color) => updateTheme({ background_color: color })}
              helperText="Form background"
            />
          </CardContent>
        </Card>

        {/* Typography */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Typography
            </CardTitle>
            <CardDescription>Font settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="font_family">Font Family</Label>
              <NativeSelect
                label=""
                value={extendedSettings.theme.font_family || 'inherit'}
                onChange={(e) => updateTheme({ font_family: e.target.value })}
                options={[
                  { value: 'inherit', label: 'Inherit from website' },
                  { value: 'Inter, sans-serif', label: 'Inter' },
                  { value: 'system-ui, sans-serif', label: 'System UI' },
                  { value: 'Georgia, serif', label: 'Georgia (Serif)' },
                  { value: "'Roboto', sans-serif", label: 'Roboto' },
                  { value: "'Open Sans', sans-serif", label: 'Open Sans' },
                ]}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Choose "Inherit" to match your website's font
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="h-5 w-5" />
              Appearance
            </CardTitle>
            <CardDescription>Visual style settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="border_radius">Border Radius</Label>
              <NativeSelect
                label=""
                value={extendedSettings.theme.border_radius || '8px'}
                onChange={(e) => updateTheme({ border_radius: e.target.value })}
                options={[
                  { value: '0px', label: 'None (Square)' },
                  { value: '4px', label: 'Small' },
                  { value: '8px', label: 'Medium' },
                  { value: '12px', label: 'Large' },
                  { value: '16px', label: 'Extra Large' },
                  { value: '9999px', label: 'Pill' },
                ]}
              />
            </div>

            <div>
              <Label htmlFor="button_style">Button Style</Label>
              <NativeSelect
                label=""
                value={extendedSettings.theme.button_style || 'filled'}
                onChange={(e) => updateTheme({ button_style: e.target.value as 'filled' | 'outline' | 'rounded' })}
                options={[
                  { value: 'filled', label: 'Filled (Solid)' },
                  { value: 'outline', label: 'Outline (Border only)' },
                  { value: 'rounded', label: 'Rounded (Pill)' },
                ]}
              />
            </div>

            <div>
              <Label htmlFor="input_style">Input Style</Label>
              <NativeSelect
                label=""
                value={extendedSettings.theme.input_style || 'default'}
                onChange={(e) => updateTheme({ input_style: e.target.value as 'default' | 'underline' | 'filled' })}
                options={[
                  { value: 'default', label: 'Default (Border)' },
                  { value: 'underline', label: 'Underline' },
                  { value: 'filled', label: 'Filled (Gray background)' },
                ]}
              />
            </div>

            <div>
              <Label htmlFor="spacing">Field Spacing</Label>
              <NativeSelect
                label=""
                value={extendedSettings.theme.spacing || 'normal'}
                onChange={(e) => updateTheme({ spacing: e.target.value })}
                options={[
                  { value: 'compact', label: 'Compact' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'relaxed', label: 'Relaxed' },
                ]}
              />
            </div>
          </CardContent>
        </Card>

        {/* Layout */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5" />
              Layout
            </CardTitle>
            <CardDescription>Form structure settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="form_width">Form Width</Label>
              <NativeSelect
                label=""
                value={extendedSettings.form_width || 'medium'}
                onChange={(e) => updateSettings({ form_width: e.target.value as any })}
                options={[
                  { value: 'narrow', label: 'Narrow (400px)' },
                  { value: 'medium', label: 'Medium (500px)' },
                  { value: 'wide', label: 'Wide (600px)' },
                  { value: 'full', label: 'Full Width' },
                ]}
              />
            </div>

            <div>
              <Label htmlFor="label_position">Label Position</Label>
              <NativeSelect
                label=""
                value={extendedSettings.label_position || 'above'}
                onChange={(e) => updateSettings({ label_position: e.target.value as any })}
                options={[
                  { value: 'above', label: 'Above input' },
                  { value: 'inline', label: 'Inline with input' },
                  { value: 'floating', label: 'Floating label' },
                ]}
              />
            </div>

            <div>
              <Label htmlFor="columns">Columns</Label>
              <NativeSelect
                label=""
                value={String(extendedSettings.columns || 1)}
                onChange={(e) => updateSettings({ columns: parseInt(e.target.value) })}
                options={[
                  { value: '1', label: 'Single Column' },
                  { value: '2', label: 'Two Columns' },
                ]}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Form Header & Behavior */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlignLeft className="h-5 w-5" />
              Form Header
            </CardTitle>
            <CardDescription>Optional headline, title and description</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="form_headline">Headline (H2)</Label>
              <Input
                id="form_headline"
                value={extendedSettings.form_headline || ''}
                onChange={(e) => updateSettings({ form_headline: e.target.value })}
                placeholder="e.g., Stay in the Loop"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Main message shown above the form
              </p>
            </div>

            <div>
              <Label htmlFor="form_subheadline">Subheadline (H4)</Label>
              <Input
                id="form_subheadline"
                value={extendedSettings.form_subheadline || ''}
                onChange={(e) => updateSettings({ form_subheadline: e.target.value })}
                placeholder="e.g., Get weekly tips and exclusive offers"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional supporting line to add context or reassurance
              </p>
            </div>

            <Separator />

            <div>
              <Label htmlFor="form_title">Form Title</Label>
              <Input
                id="form_title"
                value={extendedSettings.form_title || ''}
                onChange={(e) => updateSettings({ form_title: e.target.value })}
                placeholder="e.g., Join Our Newsletter"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Displayed above the form fields (smaller than headline)
              </p>
            </div>

            <div>
              <Label htmlFor="form_description">Form Description</Label>
              <Textarea
                id="form_description"
                value={extendedSettings.form_description || ''}
                onChange={(e) => updateSettings({ form_description: e.target.value })}
                placeholder="e.g., Get weekly tips and exclusive offers."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Behavior */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Behavior
            </CardTitle>
            <CardDescription>What happens after submission</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="submit_button_text">Submit Button Text</Label>
              <Input
                id="submit_button_text"
                value={settings.submit_button_text}
                onChange={(e) =>
                  onSettingsChange({ ...settings, submit_button_text: e.target.value })
                }
                placeholder="Submit"
              />
            </div>

            <div>
              <Label htmlFor="success_message">Success Message</Label>
              <Textarea
                id="success_message"
                value={settings.success_message}
                onChange={(e) =>
                  onSettingsChange({ ...settings, success_message: e.target.value })
                }
                placeholder="Thank you for your submission!"
                rows={2}
              />
            </div>

            <div>
              <Label htmlFor="success_redirect_url">
                Redirect URL
                <Badge variant="outline" className="ml-2 text-xs">Optional</Badge>
              </Label>
              <Input
                id="success_redirect_url"
                value={settings.success_redirect_url || ''}
                onChange={(e) =>
                  onSettingsChange({
                    ...settings,
                    success_redirect_url: e.target.value || null,
                  })
                }
                placeholder="https://yoursite.com/thank-you"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Redirect here instead of showing success message
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <Label>Show Branding</Label>
                <p className="text-xs text-muted-foreground">
                  Display "Powered by BloomSuite"
                </p>
              </div>
              <Switch
                checked={settings.show_branding}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, show_branding: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Get notified when someone submits this form</CardDescription>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="notification_emails">
              Notification Emails
              <Badge variant="outline" className="ml-2 text-xs">Comma-separated</Badge>
            </Label>
            <Input
              id="notification_emails"
              value={(settings.notification_emails || []).join(', ')}
              onChange={(e) =>
                onSettingsChange({
                  ...settings,
                  notification_emails: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              placeholder="team@example.com, sales@example.com"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  helperText?: string;
}

function ColorPicker({ label, value, onChange, helperText }: ColorPickerProps) {
  return (
    <div>
      <Label htmlFor={label}>{label}</Label>
      <div className="flex gap-2 mt-1">
        <div className="relative">
          <Input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-12 h-10 p-1 cursor-pointer"
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 font-mono text-sm"
          placeholder="#000000"
          pattern="^#[0-9A-Fa-f]{6}$"
        />
      </div>
      {helperText && (
        <p className="text-xs text-muted-foreground mt-1">{helperText}</p>
      )}
    </div>
  );
}
