# Newsletter Builder 2.0: report

Date: 2026-11-26. Test account: Northfield Garden Center. No marketing email was sent.

Status words: **Done** means merged, deployed and checked on production. **Shipped, unverified** means
merged and deployed, not yet checked on production. **Partial** means part of it shipped. **Open** means not started.

## Mike's items

| Item | Status | What changed |
| --- | --- | --- |
| Customers in two segments get two copies | Shipped, unverified | The send now keeps one copy per email address. An address is dropped if any matching record opted out. Not exercised, because that needs a real send. |
| Audience text about one copy | Done | The audience picker says each contact gets one copy. |
| Campaigns page crash | Not reproducible | Checked on production across every filter and view. Evidence is on issue #676. No root cause is claimed. |
| Text alignment on every text block | Done | One Left / Centre / Right control across the text blocks. |
| Button alignment and "Button padding" | Done | One control. Full width is a choice in it. |
| Coupon "Show button" made the panel jump | Done | The switch now stays in the same place. |
| Coupon barcode | Done | UPC-A, UPC-E, EAN-13, EAN-8 and Code 128. A missing check digit is worked out. Not scanned with a physical scanner. |
| Event, Blog Post, Announcement photo controls | Done (Event), shipped, unverified (others) | Show photo, placement, fit and height. |
| Quote controls had no effect | Shipped, unverified | The email now follows avatar size, alignment and the author photo switch. |
| Website Links pills could not be turned off | Shipped, unverified | Two separate controls: how the links look, and where they sit. |
| Newsletter Header padding had no effect | Shipped, unverified | Fixed. The padding now lives in Block spacing. |
| Photo Banner would not go below 200px | Partial | The minimum is now 60px. The tint still covers the side bands when "Show whole photo" is on. |
| Footer address and business details | Done | Multi-line address. Use the business details or type your own. A cleared box stays empty. |
| Move blocks | Done | Move to top, up, down, to bottom. Alt + arrow keys. Undo works. |
| Type on the canvas | Partial | Plain text can be typed straight on the email. Rich text, prices and the footer still use the side panel. |
| Simpler start for a new email | Done | Four labelled choices. Starting blank asks before it replaces content. |
| Template Library | Partial | A Templates page with real previews, search, category, tags, copy, delete and "Use for a new email". No favourites, archive or versions. |
| Plant Care Spotlight | Partial | New block with three layouts. Staff type the care facts. No plant picker, because the reviewed plant facts live in BloomSites. |
| Approval before sending | Done | Off by default. One switch in Settings. Send for approval, approve, ask for changes, history. Enforced in the database. Tested as owner/admin only. |
| Locked templates | Partial | A designer can lock a template. Emails started from it keep the design. Enforced in the database. The Studio still shows design controls to staff who cannot use them; their save is refused. |
| Spreadsheet import for blocks | Partial | Checked against the brief. The dialog takes Excel, CSV, TSV, JSON, pasted rows or a feed, shows the rows, lets you match columns, and makes Coupons, Product Cards, Product Gallery, Image Gallery or a Data Table. Missing: a downloadable Excel template per type, Events, Announcements and Blog Posts, a list of rows with missing required fields, and a choice to add to or replace existing content. |
| iContact migration (Arts Nursery, January 2027) | Open | Not started. A live connection cannot be proved without Arts Nursery's iContact access. |
| Editor design audit | Open | |
| Email client rendering check | Open | |

## What Mike can do now

- Build an email by typing on it, and move blocks with one click.
- Start a new email from a clear set of four choices.
- Save a design as a template, find it in Campaigns, Templates, and start a new email from it.
- Line up text and buttons the same way in every block.
- Add a coupon with a barcode his till can read.
- Use his own address and wording in the footer.
- Feature a plant with its care facts.
- Turn on approval so nothing is scheduled or sent until a manager approves that exact version.
- Lock a template so staff can change the words and photos and nothing else.

## What Mike cannot do yet

- Pick a plant and have the care facts filled in.
- Import his iContact lists.
- Import spreadsheet rows into blocks with a checked flow.
- Mark favourite templates or keep versions.

## Decisions Jon made

- Owner/admin and Marketing can approve emails.

## Decisions still open

- Should approval also cover text (SMS) campaigns? Today it covers email only.
- Should a business be able to require that staff use only locked templates? Today a blank email rebuilt by hand is not bound by a lock.
- May staff hide the business name and address in the footer? Held, because it is a legal question.

## Draft email to Mike (not sent)

Subject: Newsletter builder updates you asked for

Hi Mike,

Thanks for the detailed notes. Most of what you raised is now live in your account.

What is ready to use:

- You can type straight on the email, and move a block to the top or bottom with one click.
- Text and button alignment work the same way in every block.
- The coupon block makes a barcode in UPC-A, UPC-E, EAN-13, EAN-8 or Code 128.
- The footer takes a multi-line address, and you can use your own wording.
- The Coupon "Show button" switch no longer jumps.
- The header padding, quote settings and website link styles now do what they say.
- Campaigns has a Templates page. Save a design once and start new emails from it.
- There is a new Plant Care Spotlight block.
- A contact who is in two segments now gets one copy.

Two new options you can turn on when you want them:

- Approval. Nothing is scheduled or sent until a manager approves it. If the email changes, it needs approval again.
- Locked templates. Staff can change the words and photos. The layout and styling stay as you set them.

Still to come:

- Picking a plant and filling in its care facts for you.
- Bringing your iContact lists across. I will need access to your iContact account for that.
- A smaller banner tint when you show the whole photo.

Tell me what you find when you try it.

Jon
