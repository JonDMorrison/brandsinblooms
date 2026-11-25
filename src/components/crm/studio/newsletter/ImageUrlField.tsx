import * as React from "react";
import { Choice, Field } from "./AppearanceControls";
import { useNewsletterDesign } from "./NewsletterDesignContext";
import { resolveAssetUrl } from "@/lib/studio/newsletter/settings";
export default function ImageUrlField({
  onApply,
  currentUrl = "",
  expanded = false,
}: {
  onApply: (url: string) => void;
  currentUrl?: string;
  /** Start open (the Image block's "Paste link" tab). */
  expanded?: boolean;
}) {
  const { settings } = useNewsletterDesign();
  const [input, setInput] = React.useState(currentUrl);
  const [base, setBase] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    setInput(currentUrl);
    setBase("");
    setError("");
  }, [currentUrl]);
  // A block whose photo is a pasted web address (not an upload in our own
  // storage) reopens with this section expanded, showing that address.
  const usesPublicUrl =
    /^https?:\/\//i.test(currentUrl) && !currentUrl.includes("/storage/v1/");
  return (
    <details className="nl-controls" open={expanded || usesPublicUrl || undefined}>
      <summary>Use a public image URL</summary>
      {Boolean(settings?.assetLocations?.length) && (
        <Choice
          label="Image location"
          value={base}
          onChange={(location) => {
            setBase(location);
            setInput(location ? "" : currentUrl);
            setError("");
          }}
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
        label={base ? "Image filename" : "Photo URL"}
        value={input}
        onChange={setInput}
        placeholder={
          base ? "spring-banner.jpg" : "https://example.com/images/banner.jpg"
        }
      />
      {base && <p className="nl-note">Enter a filename or relative path from the selected image location.</p>}
      <div className="nl-grid-2">
        {[{ label: "Banner placeholder", size: "640x360" }, { label: "Square placeholder", size: "1200x1200" }].map(({ label, size }) => (
          <button key={size} type="button" className="nl-quiet" onClick={() => {
            // One click applies the placeholder; no separate "Use this image".
            const url = `https://placehold.co/${size}/png`;
            onApply(url);
            setBase("");
            setInput(url);
            setError("");
          }}>{label}</button>
        ))}
      </div>
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
          setInput(url);
          setBase("");
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
        recipients. Replace placeholder images before sending.
      </p>
    </details>
  );
}
