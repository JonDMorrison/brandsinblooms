import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { FormSettings, FormTheme } from '@/types/formBuilder';
import { NativeSelect } from '@/components/ui/NativeSelect';

interface FormDesignTabProps {
  settings: FormSettings;
  onSettingsChange: (settings: FormSettings) => void;
}

export function FormDesignTab({ settings, onSettingsChange }: FormDesignTabProps) {
  const updateTheme = (updates: Partial<FormTheme>) => {
    onSettingsChange({
      ...settings,
      theme: { ...settings.theme, ...updates },
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how your form looks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="primary_color">Primary Color</Label>
            <div className="flex gap-2">
              <Input
                id="primary_color"
                type="color"
                value={settings.theme.primary_color || '#22C55E'}
                onChange={(e) => updateTheme({ primary_color: e.target.value })}
                className="w-16 h-10 p-1"
              />
              <Input
                value={settings.theme.primary_color || '#22C55E'}
                onChange={(e) => updateTheme({ primary_color: e.target.value })}
                className="flex-1"
                placeholder="#22C55E"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="border_radius">Border Radius</Label>
            <NativeSelect
              label=""
              value={settings.theme.border_radius || '8px'}
              onChange={(e) => updateTheme({ border_radius: e.target.value })}
              options={[
                { value: '0px', label: 'None (0px)' },
                { value: '4px', label: 'Small (4px)' },
                { value: '8px', label: 'Medium (8px)' },
                { value: '12px', label: 'Large (12px)' },
                { value: '16px', label: 'Extra Large (16px)' },
              ]}
            />
          </div>

          <div>
            <Label htmlFor="spacing">Spacing</Label>
            <NativeSelect
              label=""
              value={settings.theme.spacing || 'normal'}
              onChange={(e) => updateTheme({ spacing: e.target.value })}
              options={[
                { value: 'compact', label: 'Compact' },
                { value: 'normal', label: 'Normal' },
                { value: 'relaxed', label: 'Relaxed' },
              ]}
            />
          </div>

          <div>
            <Label htmlFor="button_style">Button Style</Label>
            <NativeSelect
              label=""
              value={settings.theme.button_style || 'filled'}
              onChange={(e) => updateTheme({ button_style: e.target.value as 'filled' | 'outline' | 'rounded' })}
              options={[
                { value: 'filled', label: 'Filled' },
                { value: 'outline', label: 'Outline' },
                { value: 'rounded', label: 'Rounded' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={settings.show_branding}
              onCheckedChange={(checked) =>
                onSettingsChange({ ...settings, show_branding: checked })
              }
            />
            <Label>Show "Powered by BloomSuite" branding</Label>
          </div>
        </CardContent>
      </Card>

      {/* Behavior */}
      <Card>
        <CardHeader>
          <CardTitle>Behavior</CardTitle>
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
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="success_redirect_url">
              Redirect URL (optional)
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
              If set, users will be redirected here instead of seeing the success message.
            </p>
          </div>

          <div>
            <Label htmlFor="notification_emails">
              Notification Emails (comma-separated)
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
            <p className="text-xs text-muted-foreground mt-1">
              Get notified when someone submits this form.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
