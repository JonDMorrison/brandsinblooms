# Newsletter Builder 2.0: design and rendering audits

Date: 2026-11-26. Scope: the email editor panels and the one email renderer
(`src/lib/studio/emailHtmlGenerator.ts`, `src/lib/studio/newsletter/renderExtensions.ts`).

## 1. Email client rendering audit

Method: every block type was rendered through the real renderer and the HTML
was scanned for features that email clients drop. No inbox tests were run.
Real-client screenshots need a paid testing service or real sends, and both
are outside the brief. Treat this as a code audit, not proof in Outlook.

### Passed

- Doctype, `lang`, viewport, hidden preheader and mobile media queries are present.
- Every layout table has `role="presentation"`.
- No flex, grid, positioning, CSS variables, `calc`, web fonts, SVG, iframes, scripts or forms in any block.
- Buttons use `border-radius`. Outlook draws them square. Acceptable.

### Found and fixed in this release

| Finding | Blocks | Fix |
| --- | --- | --- |
| Desktop Outlook ignores `object-fit`. A photo cropped by CSS in a fixed-height box is squashed. | Event (cropped by default), Product Card, Blog Post, Announcement and Plant Care when set to "Fill the space" | Outlook now gets the whole photo at its own proportions. Every other client still gets the cropped photo. `withOutlookWholePhoto` in `emailImageCrop.ts`. |

### Found, not fixed

| Finding | Blocks | Risk | Suggested fix |
| --- | --- | --- | --- |
| Same `object-fit` squash | Photo Banner (graphic hero) in crop mode, quote avatar, circle logo, legacy product block | Medium for Photo Banner, low for the rest | Extend the real-crop upload (`getEmailImageCropFrame`) to Photo Banner. Square avatars and logos are not affected. |
| Photo and Photo + Text rely on a real cropped file | full-width image, image-text | Low. If the crop upload has not finished, Outlook shows a squashed photo. | Apply the same Outlook fallback when no cropped file exists. |
| No `color-scheme` declaration | Whole email | Fixed 2026-11-27. The email now declares light-only. Apple Mail honours it. Gmail and Outlook apps ignore the declaration and may still recolour. Not checked in a real inbox. | To undo, remove the two meta tags and the `:root` rule in `generateEmailHtml`. |
| Rounded corners and card shadows | All cards | Cosmetic in Outlook | None needed. |

## 2. Editor design audit

Method: every control label in `src/components/crm/studio` was extracted and
compared. 295 distinct labels, 426 uses.

### Found and fixed in this release

- 20 labels existed in two casings ("Button Colour" and "Button colour", "Show Prices" and "Show prices"). All 42 uses now use sentence case, which matches the newer plain-language labels.
- "Color Mode" was the only US spelling. Now "Colour mode".
- "Show CTA Buttons" used jargon. Now "Show buttons".

### Found, not fixed

| Finding | Examples | Suggested fix |
| --- | --- | --- |
| Label naming (case, Photo vs Image, spacing, button text, corners) | 88 labels | Fixed 2026-11-27. "Image link URL" kept because Arts Nursery asked for it. |
| Units shown on some labels only | "Image height (px)" and "Image height" | Drop "(px)" and show the unit beside the slider value. |
| Locked designs still show design controls | Studio panels for a locked email | Hide or disable them. The server already refuses the save. |
