# IdealPOS Customer Types: reviewed outbound export (West Coast Gardens)

Bryan's October 14 brief proposes using **BloomSuite audience selection** and **IdealPOS Customer Types** for local checkout promotions. This is an outbound file bridge—not the Ideal API, and not direct POS/loyalty write-back.

## First release: safe review-only file

Open **Customer Intelligence → IdealPOS Customer Type bridge** (company-level CRM marketing/admin permission required).

1. Save or select a reviewed CRM segment, dynamic or static. At export time, actual segment member IDs are frozen for the preview. This **does not overwrite** the client's five historical classifications or separate lifecycle stages.
2. Import an original **Ideal Customer Details CSV** with the exact nine fields in this order:
   `CODE,LASTNAME,FIRSTNAME,MOBILE,EMAIL,TYPE,MAILOUT,ACCOUNT,PRICELEVEL`.
3. Choose a `TYPE` **already present** in the verified source file. Brand-new or unused types require Ideal's authoritative configured-types list, and are deliberately unavailable in this preview.
4. Reconcile the audience against the `crm_customer_identity_links` ledger, provider `ideal`, using **exact source CODE**. CODE is a string, so `023069` stays `023069`. No names/email/phones are guessed as identifiers.
5. Preview selected count, exact matches, missing links/codes, duplicates, already-assigned types, the original TYPE mix, and changed customers. All nine fields remain strings; only the selected customers' TYPE may change.
6. Explicitly acknowledge the review before downloading a **REVIEW-ONLY** full customer file. The complete original source file (including nonselected customers) is included unchanged, aside from approved TYPE changes. No automatic weekly reassignment, import, coupon creation or campaign sending occurs.

## Required Ideal support confirmation BEFORE live imports

- Exact `TYPE` code/value catalogue (up to 20 configured types), including unused codes.
- Whether customer updates are matched by CODE and preserve leading zeros.
- Whether the nine-column update should contain all customers or only changed customers.
- Whether omission/blank fields, unchanged `MAILOUT`, `ACCOUNT`, and `PRICELEVEL` truly preserve all existing values.
- Supported CSV encoding, quoting, separator, CRLF, date rules, import action, preview/error report, and backups/rollback.
- Whether a customer can belong to only one `TYPE` and how overlapping campaigns should be prioritized; 20 types is a scarce resource.
- Example before/after row and two synthetic customer records in an Ideal **test database**, including a no-change customer.
- Confirm which sales/coupon reports show promotion adoption so BloomSuite can reconcile ROI without claiming it caused purchases.

Until these points are confirmed and tested, the UI intentionally labels its output a review file and does not claim Ideal will import it safely.

## Data import remains a separate prerequisite

The current six Ideal import adapters are implemented but require source-specific validation on Bryan's **Crystal Reports `.xls`** files. The existing normalization helper can silently coerce missing/invalid quantities and amounts to zero, and grouped sales summary rows may lack transaction timestamps. Those issues must be fixed and reconciled **before** claiming reliable visit counts, CGI trends or redemption-triggered automations.

If a customer has an annual category spend summary but no dated distinct sale/receipt identifiers, BloomSuite may use that summary for a clearly labeled category statistic; it **cannot** call it a visit or fabricate transactions. Do not alter original Ideal reports or marketing consent during this process.

Manufacturer documentation describes `CODE,LASTNAME` as the minimum for some customer imports, and `cust.txt` as the default filename. Those are **not automatically the confirmed requirements of Bryan's installation**. See `docs/integrations/ideal-customer-intelligence.md` and obtain Ideal support confirmation before a live import.
