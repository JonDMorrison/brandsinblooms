import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Label } from "@/components/ui-legacy/label";
import { Input } from "@/components/ui-legacy/input";
import { Button } from "@/components/ui-legacy/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Palette,
  Save,
  RotateCcw,
  Upload,
  X,
  Image as ImageIcon,
  Mail,
} from "lucide-react";
import { getCompanyInitials } from "@/types/newsletterFooter";
import { cn } from "@/lib/utils";

const COLOR_PRESETS = [
  {
    name: "Green Garden (Default)",
    primary: "#22c55e",
    secondary: "#1e40af",
    accent: "#f59e0b",
    text: "#1f2937",
  },
  {
    name: "Ocean Blue",
    primary: "#0ea5e9",
    secondary: "#1e3a8a",
    accent: "#06b6d4",
    text: "#1e3a5f",
  },
  {
    name: "Rose Garden",
    primary: "#f43f5e",
    secondary: "#be123c",
    accent: "#fda4af",
    text: "#4a1c24",
  },
  {
    name: "Sunset Orange",
    primary: "#f97316",
    secondary: "#c2410c",
    accent: "#fed7aa",
    text: "#3d2414",
  },
  {
    name: "Purple Bloom",
    primary: "#a855f7",
    secondary: "#7e22ce",
    accent: "#e9d5ff",
    text: "#2d1b4e",
  },
  {
    name: "Forest Green",
    primary: "#16a34a",
    secondary: "#14532d",
    accent: "#86efac",
    text: "#1a2e1a",
  },
];

const DEFAULT_COLORS = {
  primary: "#22c55e",
  secondary: "#1e40af",
  accent: "#f59e0b",
  text: "#1f2937",
};

const DEFAULT_FOOTER_COLORS = {
  backgroundColor: "#FFFFFF",
  textColor: "#1F2937",
  linkColor: "#2563EB",
  dividerColor: "#E5E7EB",
  logoBackgroundColor: "#1F2937",
  logoTextColor: "#FFFFFF",
};

const FOOTER_BG_PRESETS = [
  { label: "Deep Green", value: "#283024" },
  { label: "Navy", value: "#1e3a5f" },
  { label: "Charcoal", value: "#374151" },
  { label: "Cream", value: "#FAF9F6" },
  { label: "White", value: "#FFFFFF" },
];

const FOOTER_ACCENT_PRESETS = [
  { label: "Warm Tan", value: "#E5BFA7" },
  { label: "Blue", value: "#3B82F6" },
  { label: "Green", value: "#22C55E" },
  { label: "Rose", value: "#F472B6" },
  { label: "Gold", value: "#F59E0B" },
];

export const BrandColorsSettings: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [footerColors, setFooterColors] = useState(DEFAULT_FOOTER_COLORS);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadBrandColors();
  }, [user]);

  const loadBrandColors = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("company_profiles")
        .select(
          "brand_primary_color, brand_secondary_color, brand_accent_color, brand_text_color, feature_flags, company_name",
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading brand colors:", error);
        return;
      }

      if (data) {
        setColors({
          primary: data.brand_primary_color || DEFAULT_COLORS.primary,
          secondary: data.brand_secondary_color || DEFAULT_COLORS.secondary,
          accent: data.brand_accent_color || DEFAULT_COLORS.accent,
          text: data.brand_text_color || DEFAULT_COLORS.text,
        });

        setCompanyName(data.company_name || "");

        // Load logo URL and footer colors from feature_flags
        const featureFlags = data.feature_flags as any;
        if (featureFlags?.company_logo_url) {
          setLogoUrl(featureFlags.company_logo_url);
        }
        if (featureFlags?.footer_colors) {
          setFooterColors({
            ...DEFAULT_FOOTER_COLORS,
            ...featureFlags.footer_colors,
          });
        }
      }
    } catch (error) {
      console.error("Error loading brand colors:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBrandColors = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      // Get current feature_flags
      const { data: profile } = await supabase
        .from("company_profiles")
        .select("feature_flags")
        .eq("user_id", user.id)
        .single();

      const currentFlags = (profile?.feature_flags as any) || {};

      const { error } = await supabase
        .from("company_profiles")
        .update({
          brand_primary_color: colors.primary,
          brand_secondary_color: colors.secondary,
          brand_accent_color: colors.accent,
          brand_text_color: colors.text,
          feature_flags: {
            ...currentFlags,
            footer_colors: footerColors,
          },
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Brand colors saved",
        description:
          "Your brand and footer colors will be used in all new email campaigns.",
      });
    } catch (error) {
      console.error("Error saving brand colors:", error);
      toast({
        title: "Error saving colors",
        description: "Failed to save brand colors. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const applyPreset = (preset: (typeof COLOR_PRESETS)[0]) => {
    setColors({
      primary: preset.primary,
      secondary: preset.secondary,
      accent: preset.accent,
      text: preset.text,
    });
  };

  const resetToDefaults = () => {
    setColors(DEFAULT_COLORS);
  };

  const resetFooterToDefaults = () => {
    setFooterColors(DEFAULT_FOOTER_COLORS);
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type - only allow email-safe formats
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid file type",
        description:
          "Please upload a PNG, JPG, or GIF image. SVG and WebP are not supported in emails.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);
    try {
      // STEP 1: Delete any existing logo files first (handles different extensions)
      const { data: existingFiles } = await supabase.storage
        .from("company-assets")
        .list(user.id, { search: "company-logo" });

      if (existingFiles && existingFiles.length > 0) {
        const pathsToDelete = existingFiles.map((f) => `${user.id}/${f.name}`);
        await supabase.storage.from("company-assets").remove(pathsToDelete);
      }

      // STEP 2: Upload new file
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/company-logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // STEP 3: Get public URL with cache-busting timestamp
      const { data: urlData } = supabase.storage
        .from("company-assets")
        .getPublicUrl(fileName);

      // Add cache-busting timestamp to force browser to fetch new image
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Get current feature_flags
      const { data: profile } = await supabase
        .from("company_profiles")
        .select("feature_flags")
        .eq("user_id", user.id)
        .single();

      const currentFlags = (profile?.feature_flags as any) || {};

      // Update company_profiles with logo URL in feature_flags
      const { error: updateError } = await supabase
        .from("company_profiles")
        .update({
          feature_flags: {
            ...currentFlags,
            company_logo_url: publicUrl,
          },
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);
      toast({
        title: "Logo uploaded",
        description: "Your company logo will appear in email footers.",
      });
    } catch (error) {
      console.error("Error uploading logo:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!user?.id) return;

    try {
      // Get current feature_flags
      const { data: profile } = await supabase
        .from("company_profiles")
        .select("feature_flags")
        .eq("user_id", user.id)
        .single();

      const currentFlags = (profile?.feature_flags as any) || {};
      delete currentFlags.company_logo_url;

      // Update company_profiles to remove logo URL
      const { error } = await supabase
        .from("company_profiles")
        .update({
          feature_flags: currentFlags,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      setLogoUrl(null);
      toast({
        title: "Logo removed",
        description: "Your company logo has been removed.",
      });
    } catch (error) {
      console.error("Error removing logo:", error);
      toast({
        title: "Error",
        description: "Failed to remove logo. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Company Logo
          </CardTitle>
          <CardDescription>
            Upload your company logo to display in email footers and other
            branded content.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif"
            onChange={handleLogoUpload}
            className="hidden"
          />

          {logoUrl ? (
            <div className="flex items-center gap-4">
              <div className="relative">
                <img
                  src={logoUrl}
                  alt="Company logo"
                  className="h-20 w-auto max-w-[200px] object-contain rounded-lg border bg-white p-2"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingLogo}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Replace Logo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveLogo}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4 mr-2" />
                  Remove Logo
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
            >
              {isUploadingLogo ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full"></div>
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    Click to upload your logo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PNG, JPG up to 2MB
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brand Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Brand Colors
          </CardTitle>
          <CardDescription>
            Customize your brand colors for email campaigns and newsletters.
            These colors will be used for buttons, headers, and other design
            elements.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Color Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  type="color"
                  value={colors.primary}
                  onChange={(e) =>
                    setColors({ ...colors, primary: e.target.value })
                  }
                  className="h-10 w-20 cursor-pointer"
                />
                <Input
                  type="text"
                  value={colors.primary}
                  onChange={(e) =>
                    setColors({ ...colors, primary: e.target.value })
                  }
                  placeholder="#22c55e"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used for CTA buttons and primary actions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="secondary-color">Secondary Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary-color"
                  type="color"
                  value={colors.secondary}
                  onChange={(e) =>
                    setColors({ ...colors, secondary: e.target.value })
                  }
                  className="h-10 w-20 cursor-pointer"
                />
                <Input
                  type="text"
                  value={colors.secondary}
                  onChange={(e) =>
                    setColors({ ...colors, secondary: e.target.value })
                  }
                  placeholder="#1e40af"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used for headers and secondary elements
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent-color">Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="accent-color"
                  type="color"
                  value={colors.accent}
                  onChange={(e) =>
                    setColors({ ...colors, accent: e.target.value })
                  }
                  className="h-10 w-20 cursor-pointer"
                />
                <Input
                  type="text"
                  value={colors.accent}
                  onChange={(e) =>
                    setColors({ ...colors, accent: e.target.value })
                  }
                  placeholder="#f59e0b"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used for highlights and accents
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="text-color">Text Color</Label>
              <div className="flex gap-2">
                <Input
                  id="text-color"
                  type="color"
                  value={colors.text}
                  onChange={(e) =>
                    setColors({ ...colors, text: e.target.value })
                  }
                  className="h-10 w-20 cursor-pointer"
                />
                <Input
                  type="text"
                  value={colors.text}
                  onChange={(e) =>
                    setColors({ ...colors, text: e.target.value })
                  }
                  placeholder="#1f2937"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used for headlines and body text in emails
              </p>
            </div>
          </div>

          {/* Live Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="border rounded-lg p-6 space-y-4 bg-white">
              <div className="space-y-2">
                <h3
                  className="text-lg font-semibold"
                  style={{ color: colors.secondary }}
                >
                  Newsletter Header
                </h3>
                <p style={{ color: colors.text }}>
                  This is how your body text will appear in emails. The text
                  color you choose will be used for headlines and paragraphs.
                </p>
              </div>
              <Button
                style={{
                  backgroundColor: colors.primary,
                  borderColor: colors.primary,
                }}
              >
                Call to Action Button
              </Button>
              <div className="flex gap-2">
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-medium text-white"
                  style={{ backgroundColor: colors.accent }}
                >
                  Accent Badge
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={resetToDefaults}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button onClick={saveBrandColors} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Colors"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Footer Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Newsletter Footer Colors
          </CardTitle>
          <CardDescription>
            Customize the default colors for email newsletter footers. These
            will be used as defaults for all campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Live Preview */}
          <div className="rounded-lg overflow-hidden border">
            <div
              className="p-4 text-center"
              style={{ backgroundColor: footerColors.backgroundColor }}
            >
              {!logoUrl && (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 font-bold text-sm"
                  style={{
                    backgroundColor: footerColors.logoBackgroundColor,
                    color: footerColors.logoTextColor,
                  }}
                >
                  {getCompanyInitials(companyName)}
                </div>
              )}
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt="Company logo"
                  className="h-10 w-auto mx-auto mb-2 object-contain"
                />
              )}
              <div
                className="text-sm font-medium"
                style={{ color: footerColors.textColor }}
              >
                {companyName || "Company Name"}
              </div>
              <div
                className="h-px w-24 mx-auto my-3"
                style={{ backgroundColor: footerColors.dividerColor }}
              />
              <div className="text-xs space-x-2">
                <span
                  style={{ color: footerColors.linkColor }}
                  className="underline cursor-pointer"
                >
                  Unsubscribe
                </span>
                <span style={{ color: footerColors.textColor, opacity: 0.6 }}>
                  |
                </span>
                <span
                  style={{ color: footerColors.linkColor }}
                  className="underline cursor-pointer"
                >
                  Manage Preferences
                </span>
              </div>
            </div>
          </div>

          {/* Background Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Background Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={footerColors.backgroundColor}
                onChange={(e) =>
                  setFooterColors({
                    ...footerColors,
                    backgroundColor: e.target.value,
                  })
                }
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={footerColors.backgroundColor}
                onChange={(e) =>
                  setFooterColors({
                    ...footerColors,
                    backgroundColor: e.target.value,
                  })
                }
                placeholder={DEFAULT_FOOTER_COLORS.backgroundColor}
                className="flex-1 font-mono text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FOOTER_BG_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() =>
                    setFooterColors({
                      ...footerColors,
                      backgroundColor: preset.value,
                    })
                  }
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    footerColors.backgroundColor === preset.value
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30",
                  )}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                />
              ))}
            </div>
          </div>

          {/* Text Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Text Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={footerColors.textColor}
                onChange={(e) =>
                  setFooterColors({
                    ...footerColors,
                    textColor: e.target.value,
                  })
                }
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={footerColors.textColor}
                onChange={(e) =>
                  setFooterColors({
                    ...footerColors,
                    textColor: e.target.value,
                  })
                }
                placeholder={DEFAULT_FOOTER_COLORS.textColor}
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>

          {/* Link Accent Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Link Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={footerColors.linkColor}
                onChange={(e) =>
                  setFooterColors({
                    ...footerColors,
                    linkColor: e.target.value,
                  })
                }
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={footerColors.linkColor}
                onChange={(e) =>
                  setFooterColors({
                    ...footerColors,
                    linkColor: e.target.value,
                  })
                }
                placeholder={DEFAULT_FOOTER_COLORS.linkColor}
                className="flex-1 font-mono text-sm"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {FOOTER_ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  onClick={() =>
                    setFooterColors({
                      ...footerColors,
                      linkColor: preset.value,
                    })
                  }
                  className={cn(
                    "w-6 h-6 rounded border-2 transition-all",
                    footerColors.linkColor === preset.value
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-transparent hover:border-muted-foreground/30",
                  )}
                  style={{ backgroundColor: preset.value }}
                  title={preset.label}
                />
              ))}
            </div>
          </div>

          {/* Divider Color */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Divider Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={footerColors.dividerColor}
                onChange={(e) =>
                  setFooterColors({
                    ...footerColors,
                    dividerColor: e.target.value,
                  })
                }
                className="w-12 h-9 p-1 cursor-pointer"
              />
              <Input
                value={footerColors.dividerColor}
                onChange={(e) =>
                  setFooterColors({
                    ...footerColors,
                    dividerColor: e.target.value,
                  })
                }
                placeholder={DEFAULT_FOOTER_COLORS.dividerColor}
                className="flex-1 font-mono text-sm"
              />
            </div>
          </div>

          {/* Logo Colors - only show if no logo image */}
          {!logoUrl && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <Label className="text-sm font-medium">
                Logo Initials Colors
              </Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Background
                  </Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="color"
                      value={footerColors.logoBackgroundColor}
                      onChange={(e) =>
                        setFooterColors({
                          ...footerColors,
                          logoBackgroundColor: e.target.value,
                        })
                      }
                      className="w-10 h-8 p-1 cursor-pointer"
                    />
                    <Input
                      value={footerColors.logoBackgroundColor}
                      onChange={(e) =>
                        setFooterColors({
                          ...footerColors,
                          logoBackgroundColor: e.target.value,
                        })
                      }
                      placeholder={DEFAULT_FOOTER_COLORS.logoBackgroundColor}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Text</Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="color"
                      value={footerColors.logoTextColor}
                      onChange={(e) =>
                        setFooterColors({
                          ...footerColors,
                          logoTextColor: e.target.value,
                        })
                      }
                      className="w-10 h-8 p-1 cursor-pointer"
                    />
                    <Input
                      value={footerColors.logoTextColor}
                      onChange={(e) =>
                        setFooterColors({
                          ...footerColors,
                          logoTextColor: e.target.value,
                        })
                      }
                      placeholder={DEFAULT_FOOTER_COLORS.logoTextColor}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={resetFooterToDefaults}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button onClick={saveBrandColors} disabled={isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Colors"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color Presets</CardTitle>
          <CardDescription>
            Quick start with pre-designed color combinations that work well
            together
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => applyPreset(preset)}
                className="border rounded-lg p-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-1">
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: preset.primary }}
                    />
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: preset.secondary }}
                    />
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: preset.accent }}
                    />
                    <div
                      className="w-6 h-6 rounded border"
                      style={{ backgroundColor: preset.text }}
                    />
                  </div>
                </div>
                <p className="text-sm font-medium">{preset.name}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
