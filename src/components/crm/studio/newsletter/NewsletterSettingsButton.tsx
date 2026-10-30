import * as React from "react";
import Button from "@mui/joy/Button";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Typography from "@mui/joy/Typography";
import { SlidersHorizontal, X } from "lucide-react";
import AppearanceControls, {
  ColorField,
  Field,
  Choice,
  NumericField,
} from "./AppearanceControls";
import { useNewsletterDesign } from "./NewsletterDesignContext";
import {
  EMAIL_FONTS,
  normalizeNewsletterSettings,
} from "@/lib/studio/newsletter/settings";
export default function NewsletterSettingsButton() {
  const { settings, onChange } = useNewsletterDesign();
  const [open, setOpen] = React.useState(false);
  const resolved = normalizeNewsletterSettings(settings);
  if (!onChange) return null;
  return (
    <>
      <Button
        size="sm"
        variant="outlined"
        color="neutral"
        startDecorator={<SlidersHorizontal size={15} />}
        onClick={() => setOpen(true)}
      >
        Design & spacing
      </Button>
      <Modal open={open} onClose={() => setOpen(false)}>
        <ModalDialog
          sx={{
            width: 620,
            maxWidth: "calc(100vw - 24px)",
            maxHeight: "90dvh",
            overflowY: "auto",
            p: 3,
          }}
        >
          <div
            className="nl-inline"
            style={{ justifyContent: "space-between" }}
          >
            <Typography level="h4">Design & spacing</Typography>
            <button
              type="button"
              className="nl-quiet"
              aria-label="Close newsletter design"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </button>
          </div>
          <p className="nl-note">
            Defaults apply throughout this newsletter. Individual block settings
            take priority. These settings are saved with the newsletter and its
            template.
          </p>
          <div className="nl-controls">
            <Typography level="title-sm">Space between blocks</Typography>
            <p className="nl-note">Add more space between sections here. For space inside a block, select it and open Spacing in its properties.</p>
            <div className="nl-grid-2">
              <NumericField
                label="Email width (px)"
                min={480}
                max={800}
                step={10}
                value={resolved.width}
                onChange={(width) => onChange({ ...resolved, width })}
              />
              <NumericField
                label="Space between blocks (px)"
                max={96}
                value={resolved.blockGap}
                onChange={(blockGap) => onChange({ ...resolved, blockGap })}
              />
            </div>
            <p className="nl-note">
              640px is the default. Choose 700px for a wider layout. The mobile
              version fits the available screen.
            </p>
            <ColorField
              label="Outside background"
              value={resolved.backgroundColor}
              onChange={(backgroundColor) =>
                onChange({ ...resolved, backgroundColor })
              }
            />
            <ColorField
              label="Newsletter background"
              value={resolved.contentBackgroundColor}
              onChange={(contentBackgroundColor) =>
                onChange({ ...resolved, contentBackgroundColor })
              }
            />
            <Choice
              label="Default font"
              value={resolved.fontFamily || ""}
              options={[
                { value: "", label: "Use account branding" },
                ...EMAIL_FONTS.map((font) => ({
                  value: font,
                  label: font.split(",")[0],
                })),
              ]}
              onChange={(fontFamily) =>
                onChange({ ...resolved, fontFamily: fontFamily || undefined })
              }
            />
            <AppearanceControls
              master
              value={resolved.defaults}
              onChange={(defaults) => onChange({ ...resolved, defaults })}
              allowedFonts={resolved.allowedFonts}
            />
            <details>
              <summary>Allowed fonts</summary>
              <p className="nl-note">
                Choose the font stacks shown in block typography controls. Email
                apps may use the listed fallback fonts.
              </p>
              {EMAIL_FONTS.map((font) => (
                <label key={font} className="nl-inline">
                  <input
                    type="checkbox"
                    checked={
                      !resolved.allowedFonts?.length ||
                      resolved.allowedFonts.includes(font)
                    }
                    onChange={(event) => {
                      const current = resolved.allowedFonts?.length
                        ? resolved.allowedFonts
                        : [...EMAIL_FONTS];
                      onChange({
                        ...resolved,
                        allowedFonts: event.target.checked
                          ? [...current, font]
                          : current.filter((item) => item !== font),
                      });
                    }}
                  />
                  {font.split(",")[0]}
                </label>
              ))}
            </details>
            <details>
              <summary>Image URL locations</summary>
              <p className="nl-note">
                Save a public image folder URL, then enter only a filename when
                adding an image.
              </p>
              {(resolved.assetLocations || []).map((location) => (
                <div key={location.id} className="nl-fieldset">
                  <Field
                    label="Location name"
                    value={location.name}
                    onChange={(name) =>
                      onChange({
                        ...resolved,
                        assetLocations: resolved.assetLocations?.map((item) =>
                          item.id === location.id ? { ...item, name } : item,
                        ),
                      })
                    }
                  />
                  <Field
                    label="Public folder URL"
                    value={location.url}
                    onChange={(url) =>
                      onChange({
                        ...resolved,
                        assetLocations: resolved.assetLocations?.map((item) =>
                          item.id === location.id ? { ...item, url } : item,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="nl-quiet"
                    onClick={() =>
                      onChange({
                        ...resolved,
                        assetLocations: resolved.assetLocations?.filter(
                          (item) => item.id !== location.id,
                        ),
                      })
                    }
                  >
                    Remove location
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="nl-quiet"
                onClick={() =>
                  onChange({
                    ...resolved,
                    assetLocations: [
                      ...(resolved.assetLocations || []),
                      { id: crypto.randomUUID(), name: "", url: "" },
                    ],
                  })
                }
              >
                Add image location
              </button>
            </details>
          </div>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </ModalDialog>
      </Modal>
    </>
  );
}
