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
import { Field, NumericField, Choice, ColorField } from "./AppearanceControls";
import { upcAImage } from "@/lib/studio/newsletter/barcode";
import { validUpcA } from "@/lib/studio/newsletter/renderExtensions";

type Update = (
  field: keyof StudioBlock,
  value: StudioBlock[keyof StudioBlock],
) => void;
const offers: Array<{ value: CouponOffer; label: string }> = [
  { value: "price", label: "Just a price" },
  { value: "percent", label: "Percentage off" },
  { value: "amount", label: "Dollar amount off" },
  { value: "bogo", label: "Buy one, get one free" },
  { value: "buy-x-get-one", label: "Buy X, get one free" },
  { value: "multi-buy", label: "X for a bundle price" },
  { value: "tiered", label: "Quantity price / regular price" },
  { value: "25", label: "25% off" },
  { value: "50", label: "50% off" },
];
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
            label="Destination URL"
            value={link.url}
            onChange={(url) => change(link.id, { url })}
          />
          {block.type === "button-group" && (
            <>
              <ColorField
                label="Button colour"
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
      <summary>Image badges (up to three)</summary>
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
      <legend>Website link / button</legend>
      <Field
        label="Link text"
        value={block.buttonText}
        onChange={(value) => update("buttonText", value)}
      />
      <Field
        label="Website URL"
        value={block.buttonUrl}
        onChange={(value) => update("buttonUrl", value)}
      />
      <Choice
        label="Link appearance"
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
        placeholder="Summer savings"
      />
      <Field
        label="Title"
        value={block.headline}
        onChange={(value) => update("headline", value)}
        placeholder="Japanese Skimmia"
      />
      <Field
        label="Subtitle / botanical name"
        value={block.subheading}
        onChange={(value) => update("subheading", value)}
        placeholder="Skimmia japonica"
      />
      <StudioRichTextField
        label="Description"
        value={block.body || ""}
        onChange={(value) => update("body", value)}
      />
      <Choice
        label="Offer preset"
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
      <Field
        label={
          block.couponOffer === "tiered"
            ? "Price per item at minimum quantity"
            : "Price (optional, include currency)"
        }
        value={block.couponPrice}
        onChange={(value) => update("couponPrice", value)}
        placeholder="$19.99"
      />
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
      <Field
        label="Original price (strikethrough)"
        value={block.originalPrice}
        onChange={(value) => update("originalPrice", value)}
      />
      <Field
        label="Sizing / variant"
        value={block.couponSizing}
        onChange={(value) => update("couponSizing", value)}
        placeholder="#2 pot size only"
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
        placeholder="October 31, 2026"
      />
      <p className="nl-note">
        Conditions and expiry appear after the link. Set their colour and size
        under Typography → Conditions / small print.
      </p>
      <StudioImageUpload
        label="Coupon image"
        value={block.imageUrl || ""}
        onChange={(value) => update("imageUrl", value)}
      />
      <Field
        label="Image alt text"
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
      <StudioSwitchField
        label="Coupon border"
        checked={block.couponBorder !== false}
        onChange={(value) => update("couponBorder", value)}
      />
      <StudioSwitchField
        label="Scissors / cut line"
        checked={block.couponScissors !== false}
        onChange={(value) => update("couponScissors", value)}
      />
      <BadgeFields block={block} update={update} />
      <ButtonFields block={block} update={update} />
      <details>
        <summary>Printable UPC barcode</summary>
        <Field
          label="Existing 12-digit UPC-A coupon code"
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
  };
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
                  label="Image destination URL"
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
                  label="Badge"
                  value={products[index]?.badgeText}
                  onChange={(badgeText) => patchProduct(index, { badgeText })}
                />
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
                  label="Image destination URL"
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
          <p className="nl-note">
            The line style is configured once. Use the shared Spacing and Border
            controls below for the surrounding block.
          </p>
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
            label="Heading level"
            value={block.headingLevel || "h2"}
            options={["h1", "h2", "h3", "h4", "h5", "h6"].map((value) => ({
              value,
              label: value.toUpperCase(),
            }))}
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
          {textField("Heading (optional)", "headline")}
          {textField("Subheading (optional)", "subheading")}
          <LinksEditor
            block={block}
            update={update}
            max={block.type === "navigation" ? 5 : 3}
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
            label="Column headings (separate with tabs)"
            value={(block.tableHeaders || []).join("\t")}
            onChange={(value) =>
              update("tableHeaders", value.split("\t").slice(0, 12))
            }
          />
          <Field
            label="Rows (paste from a spreadsheet)"
            multiline
            value={(block.tableRows || [])
              .map((row) => row.join("\t"))
              .join("\n")}
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
            Tab-separated columns, one row per line. Up to 12 columns and 100
            rows.
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
            value={(block.chartData || [])
              .map((point) => `${point.label}, ${point.value}`)
              .join("\n")}
            onChange={(value) =>
              update(
                "chartData",
                value
                  .split("\n")
                  .filter(Boolean)
                  .slice(0, 20)
                  .map((line) => {
                    const index = line.lastIndexOf(",");
                    return {
                      label: index < 0 ? line : line.slice(0, index).trim(),
                      value:
                        index < 0
                          ? 0
                          : Math.max(0, Number(line.slice(index + 1)) || 0),
                    };
                  }),
              )
            }
          />
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
          {textField("Introduction", "tagLabel")}
          {textField("Headline", "headline")}
          {textField("Subheading", "subheading")}
          <StudioRichTextField
            label="Description"
            value={block.body || ""}
            onChange={(value) => update("body", value)}
          />
          {block.type === "event" && (
            <>
              {textField("Date and time", "eventDate")}
              {textField("Location", "eventLocation")}
            </>
          )}
          <StudioImageUpload
            label="Feature image"
            value={block.imageUrl || ""}
            onChange={(value) => update("imageUrl", value)}
          />
          <Choice
            label="Image placement"
            value={block.imagePosition || "top"}
            options={["top", "left", "right"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value) =>
              update("imagePosition", value as StudioBlock["imagePosition"])
            }
          />
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
export function AdditionalBlockFields({
  block,
  update,
}: {
  block: StudioBlock;
  update: Update;
}) {
  return (
    <div className="nl-controls" style={{ padding: "0 20px" }}>
      {block.type === "newsletter-header" && (
        <>
          <Field
            label="Subtitle"
            value={block.subheading}
            onChange={(value) => update("subheading", value)}
          />
          <NumericField
            label="Logo size (px)"
            min={24}
            max={320}
            value={block.logoSize}
            onChange={(value) => {
              update("logoSize", value);
              update("logoSizeExplicit", true);
            }}
          />
          <StudioImageUpload
            label="Full-width header banner"
            value={block.headerBannerUrl || ""}
            onChange={(value) => update("headerBannerUrl", value)}
          />
        </>
      )}
      {block.type === "product-card" && (
        <>
          <Field
            label="Subtitle / botanical name"
            value={block.productSubtitle}
            onChange={(value) => update("productSubtitle", value)}
          />
          <Choice
            label="Image placement"
            value={block.imagePosition || "left"}
            options={["left", "right", "top"].map((value) => ({
              value,
              label: value,
            }))}
            onChange={(value) =>
              update("imagePosition", value as StudioBlock["imagePosition"])
            }
          />
          <BadgeFields block={block} update={update} />
        </>
      )}
      {block.type === "image-text" && (
        <>
          <Choice
            label="Image / text column split"
            value={block.columnSplit || "50/50"}
            options={["30/70", "40/60", "50/50", "60/40", "70/30"].map(
              (value) => ({ value, label: value }),
            )}
            onChange={(value) =>
              update("columnSplit", value as StudioBlock["columnSplit"])
            }
          />
          <Field
            label="Image destination URL"
            value={block.linkUrl}
            onChange={(value) => update("linkUrl", value)}
          />
        </>
      )}
      {block.type === "call-to-action" && (
        <>
          <Field
            label="Subheading"
            value={block.subheading}
            onChange={(value) => update("subheading", value)}
          />
          <StudioSwitchField
            label="Full-width button"
            checked={Boolean(block.fullWidthButton)}
            onChange={(value) => update("fullWidthButton", value)}
          />
        </>
      )}
      {block.type === "graphic-hero" && (
        <Choice
          label="Overlay direction"
          value={block.overlayGradientDirection || "uniform"}
          options={[
            { value: "uniform", label: "Uniform" },
            { value: "top-to-bottom", label: "Top to bottom" },
            { value: "bottom-to-top", label: "Bottom to top" },
            { value: "left-to-right", label: "Left to right" },
            { value: "right-to-left", label: "Right to left" },
          ]}
          onChange={(value) =>
            update(
              "overlayGradientDirection",
              value as StudioBlock["overlayGradientDirection"],
            )
          }
        />
      )}
    </div>
  );
}
