import * as React from "react";
import type {
  StudioBlock,
  GalleryImage,
  GalleryProduct,
} from "@/types/studioBlocks";
import type {
  CouponOffer,
  NewsletterLink,
  ProductBadge,
} from "@/types/newsletterDesign";
import StudioImageUpload, {
  uploadStudioImageFile,
} from "../fields/StudioImageUpload";
import StudioRichTextField from "../fields/StudioRichTextField";
import StudioSwitchField from "../fields/StudioSwitchField";
import { ButtonPaddingFields, ImageSpacingFields, Field, NumericField, Choice, ColorField } from "./AppearanceControls";
import { safeEmailUrl } from "@/lib/studio/newsletter/settings";
import { navigationLinkColor } from "@/lib/studio/newsletter/settings";
import { useNewsletterDesign } from "./NewsletterDesignContext";
import { upcAImage } from "@/lib/studio/newsletter/barcode";
import { couponUsesOldPrice, couponUsesPrice, validUpcA } from "@/lib/studio/newsletter/renderExtensions";
import { chartDataTextFor, parseChartDataText } from "@/lib/studio/newsletter/chartData";

type Update = (
  field: keyof StudioBlock,
  value: StudioBlock[keyof StudioBlock],
) => void;
const offers: Array<{ value: CouponOffer; label: string }> = [
  { value: "25", label: "25% off" },
  { value: "50", label: "50% off" },
  { value: "percent", label: "Another percentage off" },
  { value: "amount", label: "Dollars off (like $5 off)" },
  { value: "price", label: "A sale price (like $19.99)" },
  { value: "bogo", label: "Buy one, get one free" },
  { value: "buy-x-get-one", label: "Buy a few, get one free" },
  { value: "multi-buy", label: "A deal for buying several (like 3 for $10)" },
  { value: "tiered", label: "A lower price when you buy more" },
];
// A new table starts with empty cells. Joining those gave a box that already
// held a tab, so the first thing typed landed in the second column. An
// all-empty table shows as an empty box.
function tableCellsToText(rows: string[][]) {
  const text = rows.map((row) => row.join("\t")).join("\n");
  return text.replace(/[\t\n]/g, "") === "" ? "" : text;
}
function LinksEditor({
  block,
  update,
  max = 3,
}: {
  block: StudioBlock;
  update: Update;
  max?: number;
}) {
  const links = block.links || [];
  const change = (id: string, patch: Partial<NewsletterLink>) =>
    update(
      "links",
      links.map((link) => (link.id === id ? { ...link, ...patch } : link)),
    );
  return (
    <div>
      {links.map((link, index) => (
        <fieldset key={link.id} className="nl-fieldset">
          <legend>
            {block.type === "survey" ? "Answer" : "Link"} {index + 1}
          </legend>
          <Field
            label="Label"
            value={link.label}
            onChange={(label) => change(link.id, { label })}
          />
          <Field
            label="Link (web address)"
            value={link.url}
            onChange={(url) => change(link.id, { url })}
          />
          {block.type === "button-group" && (
            <>
              <ColorField
                label="Button colour"
                transparent
                value={link.color}
                onChange={(color) => change(link.id, { color })}
              />
              <ColorField
                label="Button text colour"
                value={link.textColor}
                onChange={(textColor) => change(link.id, { textColor })}
              />
            </>
          )}
          {block.type === "navigation" && link.textColor && (
            <ColorField
              label="Link colour override"
              value={link.textColor}
              onChange={(textColor) => change(link.id, { textColor })}
            />
          )}
          <button
            type="button"
            className="nl-quiet"
            onClick={() =>
              update(
                "links",
                links.filter((item) => item.id !== link.id),
              )
            }
          >
            Remove
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="nl-quiet"
        disabled={links.length >= max}
        onClick={() =>
          update("links", [
            ...links,
            { id: crypto.randomUUID(), label: "", url: "" },
          ])
        }
      >
        Add {block.type === "survey" ? "answer" : "link"}
      </button>
    </div>
  );
}
export function BadgeFields({
  block,
  update,
}: {
  block: StudioBlock;
  update: Update;
}) {
  const badges = block.badges || [];
  const change = (id: string, patch: Partial<ProductBadge>) =>
    update(
      "badges",
      badges.map((badge) => (badge.id === id ? { ...badge, ...patch } : badge)),
    );
  return (
    <details className="nl-controls">
      <summary>Add a small tag, like "New" or "Sale"</summary>
      {badges.map((badge, index) => (
        <fieldset key={badge.id} className="nl-fieldset">
          <legend>Badge {index + 1}</legend>
          <Choice
            label="Badge preset"
            value={
              [
                "New",
                "Sale",
                "Rare",
                "Clearance",
                "Special",
                "Popular",
              ].includes(badge.label)
                ? badge.label
                : ""
            }
            options={[
              { value: "", label: "Custom text" },
              ...["New", "Sale", "Rare", "Clearance", "Special", "Popular"].map(
                (value) => ({ value, label: value }),
              ),
            ]}
            onChange={(label) => {
              if (label) change(badge.id, { label });
            }}
          />
          <Field
            label="Badge text"
            value={badge.label}
            onChange={(label) => change(badge.id, { label })}
          />
          <ColorField
            label="Badge colour"
            value={badge.color}
            onChange={(color) => change(badge.id, { color })}
          />
          <ColorField
            label="Badge text colour"
            value={badge.textColor}
            onChange={(textColor) => change(badge.id, { textColor })}
          />
          <button
            type="button"
            className="nl-quiet"
            onClick={() =>
              update(
                "badges",
                badges.filter((item) => item.id !== badge.id),
              )
            }
          >
            Remove badge
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="nl-quiet"
        disabled={badges.length >= 3}
        onClick={() =>
          update("badges", [
            ...badges,
            {
              id: crypto.randomUUID(),
              label: "New",
              color: "#1f4341",
              textColor: "#ffffff",
            },
          ])
        }
      >
        Add badge
      </button>
    </details>
  );
}
function ButtonFields({
  block,
  update,
}: {
  block: StudioBlock;
  update: Update;
}) {
  return (
    <fieldset className="nl-fieldset">
      <legend>Button</legend>
      <Field
        label="Words on the button"
        value={block.buttonText}
        onChange={(value) => update("buttonText", value)}
      />
      <Field
        label="Link (web address)"
        value={block.buttonUrl}
        onChange={(value) => update("buttonUrl", value)}
      />
      {block.buttonUrl?.trim() && (
        <div className="nl-note">
          {safeEmailUrl(block.buttonUrl) ? (
            <a href={safeEmailUrl(block.buttonUrl)} target="_blank" rel="noopener noreferrer">Open destination to check link</a>
          ) : "Enter a public website address, such as example.com/page."}
        </div>
      )}
      <Choice
        label="How the button looks"
        value={block.buttonStyle || "filled"}
        onChange={(value) =>
          update("buttonStyle", value as StudioBlock["buttonStyle"])
        }
        options={[
          { value: "filled", label: "Filled button" },
          { value: "outlined", label: "Outlined button" },
          { value: "link", label: "Text link" },
        ]}
      />
      <ColorField
        label="Button colour"
        transparent
        value={block.buttonColor}
        onChange={(value) => update("buttonColor", value)}
      />
      <ColorField
        label="Button text colour"
        value={block.buttonTextColor}
        onChange={(value) => update("buttonTextColor", value)}
      />
      <StudioSwitchField
        label="Full-width button"
        checked={Boolean(block.fullWidthButton)}
        onChange={(value) => update("fullWidthButton", value)}
      />
      <ButtonPaddingFields value={block.appearance} onChange={(appearance) => update("appearance", appearance)} />
    </fieldset>
  );
}
function CouponFields({
  block,
  update,
}: {
  block: StudioBlock;
  update: Update;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  return (
    <>
      <Field
        label="Introduction"
        value={block.tagLabel}
        onChange={(value) => update("tagLabel", value)}
        placeholder="Example: Summer savings"
      />
      <Field
        label="Title"
        value={block.headline}
        onChange={(value) => update("headline", value)}
        placeholder="Example: Japanese Skimmia"
      />
      <Field
        label="Second line (like the botanical name)"
        value={block.subheading}
        onChange={(value) => update("subheading", value)}
        placeholder="Example: Skimmia japonica"
      />
      <StudioRichTextField
        label="Description"
        value={block.body || ""}
        onChange={(value) => update("body", value)}
      />
      <Choice
        label="What is the offer?"
        value={block.couponOffer || "25"}
        onChange={(value) => update("couponOffer", value as CouponOffer)}
        options={offers}
      />
      {block.couponOffer === "percent" && (
        <NumericField
          label="Percentage off"
          value={block.couponPercent ?? 25}
          max={100}
          onChange={(value) => update("couponPercent", value)}
        />
      )}
      {block.couponOffer === "amount" && (
        <Field
          label="Amount off (with currency)"
          value={block.couponAmount}
          onChange={(value) => update("couponAmount", value)}
          placeholder="$5"
        />
      )}
      {block.couponOffer === "buy-x-get-one" && (
        <NumericField
          label="Buy quantity"
          min={1}
          max={1000}
          value={block.couponBuyQuantity ?? 2}
          onChange={(value) => update("couponBuyQuantity", value)}
        />
      )}
      {block.couponOffer === "multi-buy" && (
        <>
          <NumericField
            label="Bundle quantity"
            min={1}
            max={1000}
            value={block.couponBundleQuantity ?? 3}
            onChange={(value) => update("couponBundleQuantity", value)}
          />
          <Field
            label="Bundle price"
            value={block.couponBundlePrice}
            onChange={(value) => update("couponBundlePrice", value)}
            placeholder="$20"
          />
        </>
      )}
      {couponUsesPrice(block.couponOffer) && (
        <Field
          label={
            block.couponOffer === "tiered"
              ? "Price per item at minimum quantity"
              : "Sale price"
          }
          value={block.couponPrice}
          onChange={(value) => update("couponPrice", value)}
          placeholder="Example: $19.99"
        />
      )}
      {block.couponOffer === "tiered" && (
        <>
          <NumericField
            label="Minimum quantity"
            min={1}
            max={1000}
            value={block.couponMinimumQuantity ?? 3}
            onChange={(value) => update("couponMinimumQuantity", value)}
          />
          <Field
            label="Otherwise, regular price"
            value={block.couponRegularPrice}
            onChange={(value) => update("couponRegularPrice", value)}
            placeholder="$24.99"
          />
        </>
      )}
      {couponUsesOldPrice(block.couponOffer) && (
        <Field
          label="Old price (shown crossed out after the sale price)"
          value={block.originalPrice}
          onChange={(value) => update("originalPrice", value)}
        />
      )}
      <Field
        label="Size or type this applies to"
        value={block.couponSizing}
        onChange={(value) => update("couponSizing", value)}
        placeholder="Example: #2 pot size only"
      />
      <Field
        label="Conditions"
        multiline
        value={block.couponConditions}
        onChange={(value) => update("couponConditions", value)}
      />
      <Field
        label="Expiry"
        value={block.couponExpiry}
        onChange={(value) => update("couponExpiry", value)}
        placeholder="Example: October 31, 2026"
      />
      <p className="nl-note">
        The conditions and expiry show in small print at the bottom of the
        coupon.
      </p>
      <StudioImageUpload
        label="Coupon image"
        value={block.imageUrl || ""}
        onChange={(value) => update("imageUrl", value)}
      />
      <Field
        label="Describe the photo"
        value={block.imageAlt}
        onChange={(value) => update("imageAlt", value)}
      />
      <Choice
        label="Image placement"
        value={block.couponImageSide || "left"}
        options={["left", "right", "top"].map((value) => ({
          value,
          label: value,
        }))}
        onChange={(value) =>
          update("couponImageSide", value as StudioBlock["couponImageSide"])
        }
      />
      <ImageSpacingFields value={block.appearance} onChange={(appearance) => update("appearance", appearance)} />
      {!block.appearance?.border?.style && (
        <StudioSwitchField
          label="Default dashed border"
          checked={block.couponBorder !== false}
          onChange={(value) => update("couponBorder", value)}
        />
      )}
      <p className="nl-note">Custom border settings below override the default dashed border.</p>
      <StudioSwitchField
        label="Scissors / cut line"
        checked={block.couponScissors !== false}
        onChange={(value) => update("couponScissors", value)}
      />
      <BadgeFields block={block} update={update} />
      <StudioSwitchField label="Show button" checked={block.showButton !== false}
        onChange={(value) => update("showButton", value)} />
      {block.showButton !== false && <ButtonFields block={block} update={update} />}
      <details>
        <summary>Add a barcode your till can scan</summary>
        <Field
          label="12-digit coupon code from your till"
          value={block.couponBarcode}
          onChange={(value) => {
            update("couponBarcode", value);
            update("couponBarcodeImageUrl", "");
          }}
        />
        <p className="nl-note">
          Use a coupon code already configured in your POS. This prints the
          barcode; it does not create a redeemable discount.
        </p>
        <button
          type="button"
          className="nl-quiet"
          disabled={busy || !validUpcA(block.couponBarcode || "")}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const file = await upcAImage(block.couponBarcode || "");
              const url = await uploadStudioImageFile(file);
              update("couponBarcodeImageUrl", url);
            } catch (err) {
              setError(
                err instanceof Error
                  ? err.message
                  : "Could not generate barcode.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Creating barcode…" : "Create printable barcode"}
        </button>
        {block.couponBarcode && !validUpcA(block.couponBarcode) && (
          <p className="nl-error">The UPC-A check digit is invalid.</p>
        )}
        {error && (
          <p role="alert" className="nl-error">
            {error}
          </p>
        )}
      </details>
    </>
  );
}
/** The ratio the gallery renders with (see productGalleryImageSizing). */
function galleryImageRatio(block: StudioBlock): string {
  if (block.imageRatio) return block.imageRatio;
  return block.imageHeight == null ? "1:1" : "";
}

function GalleryFields({
  block,
  update,
}: {
  block: StudioBlock;
  update: Update;
}) {
  const product = block.type === "product-gallery";
  const count =
    block.layout === "feature-grid"
      ? 3
      : Math.max(1, Math.min(4, block.gridColumns || 3));
  const images = block.galleryImages || [];
  const products = block.galleryProducts || [];
  const patchImage = (index: number, patch: Partial<GalleryImage>) => {
    const next = Array.from(
      { length: Math.max(count, images.length) },
      (_, i) => images[i] || { id: crypto.randomUUID(), url: "", alt: "" },
    );
    next[index] = { ...next[index], ...patch };
    update("galleryImages", next);
  };
  const patchProduct = (index: number, patch: Partial<GalleryProduct>) => {
    const next = Array.from(
      { length: Math.max(count, products.length) },
      (_, i) =>
        products[i] || {
          id: crypto.randomUUID(),
          imageUrl: "",
          name: "",
          price: "",
        },
    );
    next[index] = { ...next[index], ...patch };
    update("galleryProducts", next);
    // Entering an original price is a clear sign the user wants it shown.
    if (patch.originalPrice?.trim() && block.showOriginalPrice === false) {
      update("showOriginalPrice", true);
    }
  };
  // "Copy details to the next slot": everything except the slot's own id
  // and photo, so the next product/image only needs its picture and any
  // differences filled in.
  const copyToNext = (index: number) => {
    if (product) {
      const source = products[index];
      if (!source) return;
      const { id: _id, imageUrl: _imageUrl, ...details } = source;
      patchProduct(index + 1, details);
    } else {
      const source = images[index];
      if (!source) return;
      const { id: _id, url: _url, ...details } = source;
      patchImage(index + 1, details);
    }
  };
  const slotCount = Math.max(count, product ? products.length : images.length);
  return (
    <>
      <p className="nl-note">
        Choose a row layout. Existing content is retained when changing the
        number of columns.
      </p>
      <div className="nl-grid-2">
        {[1, 2, 3, 4].map((n) => (
          <button
            type="button"
            key={n}
            aria-pressed={block.layout === `row-${n}`}
            className="nl-quiet"
            style={{
              borderColor: block.layout === `row-${n}` ? "#234b49" : undefined,
            }}
            onClick={() => {
              update("layout", `row-${n}`);
              update(
                "layoutPreset",
                `${product ? "product-gallery" : "gallery"}-row-${n}`,
              );
              update("gridColumns", n);
            }}
          >
            {"▯".repeat(n)} &nbsp; {n} across
          </button>
        ))}
        {product && (
          <button
            type="button"
            className="nl-quiet"
            aria-pressed={block.layout === "feature-product"}
            onClick={() => {
              update("layout", "feature-product");
              update("layoutPreset", "product-gallery-feature");
              update("gridColumns", 1);
            }}
          >
            Image beside details
          </button>
        )}
        {!product && (
          <button
            type="button"
            className="nl-quiet"
            aria-pressed={block.layout === "feature-grid"}
            onClick={() => {
              update("layout", "feature-grid");
              update("layoutPreset", "gallery-feature-grid");
              update("gridColumns", 3);
            }}
          >
            Feature + grid
          </button>
        )}
      </div>
      <NumericField
        label="Gap between cards (px)"
        value={product ? block.cardGap : block.gridGap}
        max={48}
        onChange={(value) => update(product ? "cardGap" : "gridGap", value)}
      />
      {product && (
        <details className="nl-controls">
          <summary>Product display options</summary>
          <Choice label="Image ratio" value={galleryImageRatio(block)}
            options={[
              ...(galleryImageRatio(block) === "" ? [{ value: "", label: "Fixed height" }] : []),
              { value: "1:1", label: "Square" }, { value: "4:3", label: "4:3" }, { value: "3:4", label: "3:4" }, { value: "auto", label: "Original" },
            ]}
            onChange={(value) => update("imageRatio", (value || undefined) as StudioBlock["imageRatio"])} />
          <Choice label="How the photos fit" value={block.imageFit || "cover"}
            options={[{ value: "contain", label: "Show whole photo" }, { value: "cover", label: "Fill the space" }, { value: "fill", label: "Stretch to fit" }]}
            onChange={(value) => update("imageFit", value as StudioBlock["imageFit"])} />
          {/* Older galleries set a fixed height; a chosen ratio replaces it. */}
          {block.imageRatio == null && block.imageHeight != null && (
            <NumericField label="Image height (px)" value={block.imageHeight} min={120} max={480}
              onChange={(value) => update("imageHeight", value)} />
          )}
          <StudioSwitchField
            label="Show prices"
            checked={block.showPrices !== false}
            onChange={(value) => update("showPrices", value)}
          />
          <StudioSwitchField
            label="Show original prices"
            checked={block.showOriginalPrice !== false}
            onChange={(value) => update("showOriginalPrice", value)}
          />
          <StudioSwitchField
            label="Show descriptions"
            checked={block.showDescription !== false}
            onChange={(value) => update("showDescription", value)}
          />
          <StudioSwitchField
            label="Show badges"
            checked={block.showBadges !== false}
            onChange={(value) => update("showBadges", value)}
          />
          <StudioSwitchField
            label="Show buttons"
            checked={block.showCtaButtons !== false}
            onChange={(value) => update("showCtaButtons", value)}
          />
          <StudioSwitchField
            label="Show card borders"
            checked={
              block.showBorder !== false && block.showCardBorder !== false
            }
            onChange={(value) => {
              update("showBorder", value);
              update("showCardBorder", value);
            }}
          />
        </details>
      )}
      {product && (
        <fieldset className="nl-fieldset">
          <legend>Gallery buttons</legend>
          <Choice label="Button alignment" value={block.buttonAlign || "left"}
            options={["left", "center", "right"].map((value) => ({ value, label: value === "center" ? "Centre" : value[0].toUpperCase() + value.slice(1) }))}
            onChange={(value) => update("buttonAlign", value as StudioBlock["buttonAlign"])} />
          <StudioSwitchField label="Full width buttons" checked={Boolean(block.fullWidthButton)}
            onChange={(value) => update("fullWidthButton", value)} />
          <ButtonPaddingFields value={block.appearance} onChange={(appearance) => update("appearance", appearance)} />
        </fieldset>
      )}
      {Array.from(
        { length: Math.max(count, product ? products.length : images.length) },
        (_, index) => (
          <details key={index} open={index === 0} className="nl-fieldset">
            <summary>
              {product ? "Product" : "Image"} {index + 1}
              {block.layout === "feature-grid"
                ? index === 0
                  ? " · Featured"
                  : " · Side image"
                : ""}
            </summary>
            <StudioImageUpload
              label={`${product ? "Product" : "Image"} ${index + 1} photo`}
              value={
                product
                  ? products[index]?.imageUrl || ""
                  : images[index]?.url || ""
              }
              onChange={(value) =>
                product
                  ? patchProduct(index, { imageUrl: value })
                  : patchImage(index, { url: value })
              }
            />
            <ImageSpacingFields
              value={{
                imagePadding: product ? products[index]?.imagePadding : images[index]?.imagePadding,
                imageMargin: product ? products[index]?.imageMargin : images[index]?.imageMargin,
              }}
              onChange={(next) => product
                ? patchProduct(index, { imagePadding: next.imagePadding, imageMargin: next.imageMargin })
                : patchImage(index, { imagePadding: next.imagePadding, imageMargin: next.imageMargin })}
            />
            {product ? (
              <>
                <Field
                  label="Name"
                  value={products[index]?.name}
                  onChange={(name) => patchProduct(index, { name })}
                />
                <Field
                  label="Alternative / botanical name"
                  value={products[index]?.altName}
                  onChange={(altName) => patchProduct(index, { altName })}
                />
                <Field
                  label="Price"
                  value={products[index]?.price}
                  onChange={(price) => patchProduct(index, { price })}
                />
                <Field
                  label="Original price"
                  value={products[index]?.originalPrice}
                  onChange={(originalPrice) =>
                    patchProduct(index, { originalPrice })
                  }
                />
                <Field
                  label="Description"
                  multiline
                  value={products[index]?.description}
                  onChange={(description) =>
                    patchProduct(index, { description })
                  }
                />
                <Field
                  label="Image link URL"
                  value={products[index]?.linkUrl}
                  onChange={(linkUrl) => patchProduct(index, { linkUrl })}
                />
                <Field
                  label="Button label"
                  value={products[index]?.buttonText}
                  onChange={(buttonText) => patchProduct(index, { buttonText })}
                />
                <Field
                  label="Button URL"
                  value={products[index]?.buttonUrl}
                  onChange={(buttonUrl) => patchProduct(index, { buttonUrl })}
                />
                <Field
                  label="Badge text"
                  value={products[index]?.badgeText}
                  onChange={(badgeText) => patchProduct(index, { badgeText })}
                />
                <ColorField label="Badge colour" value={products[index]?.badgeColor}
                  onChange={(badgeColor) => patchProduct(index, { badgeColor })} />
                <ColorField label="Badge text colour" value={products[index]?.badgeTextColor}
                  onChange={(badgeTextColor) => patchProduct(index, { badgeTextColor })} />
              </>
            ) : (
              <>
                <Field
                  label="Alt text"
                  value={images[index]?.alt}
                  onChange={(alt) => patchImage(index, { alt })}
                />
                <Field
                  label="Caption"
                  value={images[index]?.caption}
                  onChange={(caption) => patchImage(index, { caption })}
                />
                <Field
                  label="Image link URL"
                  value={images[index]?.linkUrl}
                  onChange={(linkUrl) => patchImage(index, { linkUrl })}
                />
              </>
            )}
            <button
              type="button"
              className="nl-quiet"
              onClick={() =>
                product
                  ? patchProduct(index, {
                      imageUrl: "",
                      name: "",
                      altName: "",
                      price: "",
                      originalPrice: "",
                      description: "",
                      linkUrl: "",
                      buttonText: "",
                      buttonUrl: "",
                      badgeText: "",
                    })
                  : patchImage(index, {
                      url: "",
                      alt: "",
                      caption: "",
                      linkUrl: "",
                    })
              }
            >
              Clear this slot
            </button>
            {index < slotCount - 1 && (
              <button
                type="button"
                className="nl-quiet"
                style={{ marginLeft: 8 }}
                disabled={!(product ? products[index] : images[index])}
                onClick={() => copyToNext(index)}
              >
                Copy details to {product ? "Product" : "Image"} {index + 2}
              </button>
            )}
          </details>
        ),
      )}
    </>
  );
}
export default function ExtendedBlockProperties({
  block,
  update,
}: {
  block: StudioBlock;
  update: Update;
}) {
  const { settings } = useNewsletterDesign();
  const textField = (
    label: string,
    key: keyof StudioBlock,
    multiline = false,
  ) => (
    <Field
      label={label}
      value={typeof block[key] === "string" ? String(block[key]) : ""}
      multiline={multiline}
      onChange={(value) => update(key, value)}
    />
  );
  let content: React.ReactNode;
  switch (block.type) {
    case "divider":
      content = (
        <>
          <Choice
            label="Line style"
            value={block.lineStyle || "solid"}
            options={["solid", "dashed", "dotted"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value) => {
              update("lineStyle", value as StudioBlock["lineStyle"]);
              update("lineType", value as StudioBlock["lineType"]);
            }}
          />
          <div className="nl-grid-2">
            <NumericField
              label="Line thickness (px)"
              value={block.lineThickness ?? 1}
              min={1}
              max={12}
              onChange={(value) => update("lineThickness", value)}
            />
            <NumericField
              label="Line width (%)"
              value={block.lineWidth ?? 100}
              min={1}
              max={100}
              onChange={(value) => update("lineWidth", value)}
            />
          </div>
          <ColorField
            label="Line colour"
            value={block.lineColor}
            onChange={(value) => update("lineColor", value)}
          />
          <Choice
            label="Line alignment"
            value={block.textAlign || "center"}
            options={["left", "center", "right"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value) =>
              update("textAlign", value as StudioBlock["textAlign"])
            }
          />
          <StudioSwitchField
            label="Centre ornament"
            checked={block.layout === "ornamental"}
            onChange={(value) =>
              update("layout", value ? "ornamental" : "standard")
            }
          />
          {block.layout === "ornamental" && (
            <>
              <Choice
                label="Ornament symbol"
                value={block.ornamentSymbol || "✦"}
                options={["✦", "●", "◆", "★", "─"].map((value) => ({
                  value,
                  label: value,
                }))}
                onChange={(value) =>
                  update(
                    "ornamentSymbol",
                    value as StudioBlock["ornamentSymbol"],
                  )
                }
              />
              <ColorField
                label="Ornament colour"
                value={block.ornamentColor}
                onChange={(value) => update("ornamentColor", value)}
              />
            </>
          )}
          <ColorField
            label="Block background"
            transparent
            value={block.appearance?.background ?? settings?.defaults?.background ?? block.backgroundColor}
            onChange={(background) => update("appearance", { ...block.appearance, background })}
          />
        </>
      );
      break;

    case "coupon":
      content = <CouponFields block={block} update={update} />;
      break;
    case "image-gallery":
    case "product-gallery":
      content = <GalleryFields block={block} update={update} />;
      break;
    case "headline":
      content = (
        <>
          {textField("Headline", "headline")}
          <Choice
            label="How big should it be?"
            value={block.headingLevel || "h2"}
            options={[
              { value: "h1", label: "Biggest" },
              { value: "h2", label: "Big" },
              { value: "h3", label: "Medium" },
              { value: "h4", label: "Small" },
              { value: "h5", label: "Smaller" },
              { value: "h6", label: "Smallest" },
            ]}
            onChange={(value) =>
              update("headingLevel", value as StudioBlock["headingLevel"])
            }
          />
        </>
      );
      break;
    case "preheader":
      content = (
        <>
          {textField("Visible preview text", "body", true)}
          <p className="nl-note">
            Place this above your header. The campaign Preview text setting
            remains the hidden inbox preheader.
          </p>
        </>
      );
      break;
    case "youtube":
      content = (
        <>
          {textField("Video headline", "headline")}
          {textField("YouTube URL", "videoUrl")}
          <StudioImageUpload
            label="Custom thumbnail (optional)"
            value={block.imageUrl || ""}
            onChange={(value) => update("imageUrl", value)}
          />
          {textField("Description", "body", true)}
          {textField("Button text", "buttonText")}
          <p className="nl-note">
            Email shows a linked thumbnail. Playback opens on YouTube.
          </p>
        </>
      );
      break;
    case "navigation":
    case "button-group":
      content = (
        <>
          {(block.type === "navigation" || block.headline || block.subheading) && (
            <>
              {textField("Heading", "headline")}
              {textField("Subheading", "subheading")}
            </>
          )}
          <LinksEditor
            block={block}
            update={update}
            max={block.type === "navigation" ? 5 : 3}
          />
          {block.type === "navigation" && (
            <ColorField
              label="Link colour"
              value={navigationLinkColor(block, block.appearance?.background ?? settings?.defaults?.background, settings?.contentBackgroundColor)}
              onChange={(color) => update("linkColor", color)}
            />
          )}
          <ButtonPaddingFields
            value={block.appearance}
            onChange={(appearance) => update("appearance", appearance)}
          />
        </>
      );
      break;
    case "survey":
      content = (
        <>
          {textField("Poll / survey question", "headline")}
          {textField("Introduction", "body", true)}
          <LinksEditor block={block} update={update} max={6} />
          <p className="nl-note">
            Each answer opens its survey URL. Record responses on your survey
            page; email clicks can include automated scanners.
          </p>
        </>
      );
      break;
    case "text-columns":
      content = (
        <>
          <Choice
            label="Columns"
            value={String(block.textColumns?.length || 2)}
            options={[1, 2, 3].map((n) => ({
              value: String(n),
              label: String(n),
            }))}
            onChange={(value) => {
              const count = Number(value);
              const current = block.textColumns || [];
              if (
                count < current.length &&
                current.slice(count).some((item) => item.trim()) &&
                !window.confirm(
                  "Changing columns will remove text from the extra columns. Continue?",
                )
              )
                return;
              update(
                "textColumns",
                Array.from({ length: count }, (_, i) => current[i] || ""),
              );
            }}
          />
          {(block.textColumns || ["", ""]).map((value, index) => (
            <StudioRichTextField
              key={index}
              label={`Column ${index + 1}`}
              value={value}
              onChange={(next) =>
                update(
                  "textColumns",
                  (block.textColumns || ["", ""]).map((old, i) =>
                    i === index ? next : old,
                  ),
                )
              }
            />
          ))}
        </>
      );
      break;
    case "data-table":
      content = (
        <>
          {textField("Table caption", "tableCaption")}
          <Field
            label="Column titles (press Tab to start the next column)"
            multiline
            captureTab
            value={tableCellsToText([block.tableHeaders || []])}
            onChange={(value) =>
              update("tableHeaders", value.split("\t").slice(0, 12))
            }
          />
          <Field
            label="Rows (paste from a spreadsheet, or press Tab between columns)"
            multiline
            captureTab
            value={tableCellsToText(block.tableRows || [])}
            onChange={(value) =>
              update(
                "tableRows",
                value
                  .split("\n")
                  .slice(0, 100)
                  .map((row) => row.split("\t").slice(0, 12)),
              )
            }
          />
          <p className="nl-note">
            One row per line. Press Tab to move to the next column. Up to 12
            columns and 100 rows.
          </p>
        </>
      );
      break;
    case "chart":
      content = (
        <>
          {textField("Chart title", "headline")}
          {textField("Value suffix", "chartUnit")}
          <Field
            label="Chart data: label, value (one per line)"
            multiline
            // Keep the text exactly as typed; only the chart reads the
            // parsed points. Re-formatting here mangled input mid-typing.
            value={chartDataTextFor(block)}
            onChange={(value) => {
              update("chartDataText", value);
              update("chartData", parseChartDataText(value));
            }}
          />
          <p className="nl-note">
            For example "Pruning, 24". You can paste two columns from a
            spreadsheet. Up to 20 rows.
          </p>
          <ColorField
            label="Bar colour"
            value={block.accentColor}
            onChange={(value) => update("accentColor", value)}
          />
        </>
      );
      break;
    default:
      content = (
        <>
          <p className="nl-section-title">Words</p>
          {textField("Small label above the headline", "tagLabel")}
          {textField("Headline", "headline")}
          {textField("Subheading", "subheading")}
          <StudioRichTextField
            label="Description"
            value={block.body || ""}
            onChange={(value) => update("body", value)}
          />
          {block.type === "event" && (
            <>
              <p className="nl-section-title">Date and place</p>
              <Field label="Event date" type="date" value={block.eventStartDate}
                onChange={(value) => update("eventStartDate", value)} />
              <Field label="Start time" type="time" value={block.eventStartTime}
                onChange={(value) => update("eventStartTime", value)} />
              {!block.eventStartDate && block.eventDate && textField("Existing date label", "eventDate")}
              <Choice label="Fee / admission" value={block.eventFeeType || "unspecified"}
                options={[
                  { value: "unspecified", label: "Not specified" },
                  { value: "free", label: "Free" },
                  { value: "donation", label: "By donation" },
                  { value: "paid", label: "Price" },
                ]}
                onChange={(value) => update("eventFeeType", value as StudioBlock["eventFeeType"])} />
              {block.eventFeeType === "paid" && <Field label="Fee / price" placeholder="$25.00"
                value={block.eventFeeAmount} onChange={(value) => update("eventFeeAmount", value)} />}
              {textField("Location", "eventLocation")}
            </>
          )}
          <p className="nl-section-title">Photo</p>
          <StudioImageUpload
            label="Photo"
            value={block.imageUrl || ""}
            onChange={(value) => update("imageUrl", value)}
          />
          <Choice
            label="Where the photo goes"
            value={block.imagePosition || "top"}
            options={["top", "left", "right"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value) =>
              update("imagePosition", value as StudioBlock["imagePosition"])
            }
          />
          <ImageSpacingFields value={block.appearance} onChange={(appearance) => update("appearance", appearance)} />
          <ButtonFields block={block} update={update} />
        </>
      );
  }
  return (
    <div className="nl-controls" style={{ padding: "8px 20px" }}>
      {content}
    </div>
  );
}
export function AdditionalBlockFields({ block, update }: { block: StudioBlock; update: Update }) {
  // All Product Card controls live in the main panel; no second badge editor.
  void block;
  void update;
  return null;
}
