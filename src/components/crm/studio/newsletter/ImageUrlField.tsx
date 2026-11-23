import * as React from "react";
import { Choice, Field } from "./AppearanceControls";
import { useNewsletterDesign } from "./NewsletterDesignContext";
import { resolveAssetUrl } from "@/lib/studio/newsletter/settings";
export default function ImageUrlField({
  onApply,
  expanded = false,
}: {
  onApply: (url: string) => void;
  /** Start open (the Image block's "Paste link" tab). */
  expanded?: boolean;
}) {
  const { settings } = useNewsletterDesign();
  const [input, setInput] = React.useState("");
  const [base, setBase] = React.useState("");
  const [error, setError] = React.useState("");
  return (
    <details className="nl-controls" open={expanded || undefined}>
      <summary>Paste a link to a photo instead</summary>
      {Boolean(settings?.assetLocations?.length) && (
        <Choice
          label="Image location"
          value={base}
          onChange={setBase}
          options={[
            { value: "", label: "Full public image URL" },
            ...(settings?.assetLocations || []).map((item) => ({
              value: item.url,
              label: item.name || item.url,
            })),
          ]}
        />
      )}
      <Field
        label={base ? "Image filename" : "Photo link"}
        value={input}
        onChange={setInput}
        placeholder={
          base ? "spring-banner.jpg" : "https://example.com/images/banner.jpg"
        }
      />
      <button
        type="button"
        className="nl-quiet"
        onClick={() => {
          const url = resolveAssetUrl(input.trim(), base);
          if (!url) {
            setError(
              "Enter a public http or https image URL, or a filename for the selected location.",
            );
            return;
          }
          onApply(url);
          setInput("");
          setError("");
        }}
      >
        Use this image
      </button>
      {error && (
        <p role="alert" className="nl-error">
          {error}
        </p>
      )}
      <p className="nl-note">
        The image stays at its original public URL. Keep that file available for
        recipients.
      </p>
    </details>
  );
}
