import type { IdealCustomerRow } from "./idealCustomerTypeExport";

export type NewsletterRecord = {
  email: string;
  code: string;
  firstName: string;
  lastName: string;
  phone: string;
  subscription: string;
};
export type MatchDecision = "exact_code" | "exact_email" | "manual_review" | "unmatched";
export type MatchRow = { row: number; decision: MatchDecision; idealCode?: string; reason: string };
export type NewsletterMatchReview = {
  total: number;
  exactCode: number;
  exactEmail: number;
  manualReview: number;
  unmatched: number;
  eligibleEmailCandidates: number;
  rows: MatchRow[];
};

function normalizedEmail(value: string): string {
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    !email.endsWith("@noemail.local") ? email : "";
}
function normalizedPhone(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(-10);
}
function normalizedName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
function header(value: string): string {
  return value.replace(/^\uFEFF/, "").trim().toUpperCase().replace(/[ _-]/g, "");
}

/** Parse an unmodified Mailchimp CSV locally. Never upload or persist these rows. */
export function parseNewsletterCsv(text: string): NewsletterRecord[] {
  if (text.length > 25_000_000) throw Error("Choose a CSV smaller than 25 MB.");
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === '"') {
      if (cell.length || closed) throw Error("Malformed quoted CSV field.");
      quoted = true;
    } else if (char === "," || char === "\r" || char === "\n") {
      row.push(cell); cell = ""; closed = false;
      if (char !== ",") {
        if (char === "\r" && text[i + 1] === "\n") i++;
        rows.push(row); row = [];
        if (rows.length > 100_001) throw Error("CSV exceeds 100,000 contacts.");
      }
    } else {
      if (closed) throw Error("Unexpected content after a quoted CSV field.");
      cell += char;
    }
  }
  if (quoted) throw Error("Unterminated quoted CSV field.");
  if (row.length || cell || closed) rows.push([...row, cell]);
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") rows.pop();
  if (rows.length < 2) throw Error("Newsletter CSV has no contacts.");
  const columns = rows[0].map(header);
  if (columns.length !== new Set(columns).size) throw Error("Duplicate CSV column headers need review.");
  const column = (...names: string[]) => columns.findIndex((c) => names.includes(c));
  const email = column("EMAIL", "EMAILADDRESS");
  const code = column("CODE", "CUSTOMERCODE", "IDEALCODE", "IDEALPOSCODE");
  const first = column("FNAME", "FIRSTNAME");
  const last = column("LNAME", "LASTNAME");
  const phone = column("PHONE", "MOBILE", "PHONENUMBER");
  const subscription = column("EMAILMARKETING", "STATUS", "SUBSCRIPTIONSTATUS");
  if (email === -1) throw Error("Newsletter CSV must contain an EMAIL or Email Address column.");
  return rows.slice(1).map((values, i) => {
    if (values.length !== columns.length) throw Error(`Newsletter row ${i + 2} has the wrong number of columns.`);
    const get = (index: number) => index < 0 ? "" : values[index];
    return { email: get(email), code: get(code), firstName: get(first),
      lastName: get(last), phone: get(phone), subscription: get(subscription) };
  });
}

/** Conservative matching: CODE then unique email. Name/phone only flag a possible match. */
export function previewNewsletterMatches(
  master: IdealCustomerRow[],
  newsletter: NewsletterRecord[],
): NewsletterMatchReview {
  if (master.length > 100_000 || newsletter.length > 100_000) throw Error("Review limit is 100,000 rows per file.");
  const codes = new Map<string, IdealCustomerRow[]>();
  const emails = new Map<string, IdealCustomerRow[]>();
  const possible = new Map<string, IdealCustomerRow[]>();
  for (const item of master) {
    const byCode = codes.get(item.CODE) ?? []; byCode.push(item); codes.set(item.CODE, byCode);
    const email = normalizedEmail(item.EMAIL);
    if (email) { const group = emails.get(email) ?? []; group.push(item); emails.set(email, group); }
    const phone = normalizedPhone(item.MOBILE);
    if (phone.length === 10 && item.FIRSTNAME && item.LASTNAME) {
      const key = `${normalizedName(item.FIRSTNAME)}|${normalizedName(item.LASTNAME)}|${phone}`;
      const group = possible.get(key) ?? []; group.push(item); possible.set(key, group);
    }
  }
  const duplicateNewsletterEmails = new Map<string, number>();
  for (const item of newsletter) {
    const email = normalizedEmail(item.email);
    if (email) duplicateNewsletterEmails.set(email, (duplicateNewsletterEmails.get(email) ?? 0) + 1);
  }
  const result: NewsletterMatchReview = {
    total: newsletter.length, exactCode: 0, exactEmail: 0, manualReview: 0,
    unmatched: 0, eligibleEmailCandidates: 0, rows: [],
  };
  for (const [index, item] of newsletter.entries()) {
    const email = normalizedEmail(item.email);
    const code = item.code.trim();
    let decision: MatchDecision = "unmatched", reason = "No verified match", idealCode: string | undefined;
    const codeMatches = code ? codes.get(code) ?? [] : [];
    const emailMatches = email ? emails.get(email) ?? [] : [];
    if (!email) {
      decision = "manual_review"; reason = "Newsletter email is missing or invalid";
    } else if ((duplicateNewsletterEmails.get(email) ?? 0) > 1) {
      decision = "manual_review"; reason = "Email repeats in the newsletter file";
    } else if (code && codeMatches.length !== 1) {
      decision = "manual_review"; reason = codeMatches.length ? "Duplicate IdealPOS CODE" : "Supplied CODE not in master";
    } else if (codeMatches.length === 1) {
      const match = codeMatches[0];
      if ((normalizedEmail(match.EMAIL) && normalizedEmail(match.EMAIL) !== email) ||
          (emailMatches.length > 0 && emailMatches.some((r) => r.CODE !== match.CODE))) {
        decision = "manual_review"; reason = "CODE and email point to conflicting records";
      } else {
        decision = "exact_code"; reason = "Exact original IdealPOS CODE"; idealCode = match.CODE;
        if (!normalizedEmail(match.EMAIL)) result.eligibleEmailCandidates++;
      }
    } else if (emailMatches.length === 1) {
      decision = "exact_email"; reason = "Unique matching email"; idealCode = emailMatches[0].CODE;
    } else if (emailMatches.length > 1) {
      decision = "manual_review"; reason = "Several IdealPOS records share this email";
    } else {
      const phone = normalizedPhone(item.phone);
      const key = `${normalizedName(item.firstName)}|${normalizedName(item.lastName)}|${phone}`;
      if (phone.length === 10 && item.firstName && item.lastName && (possible.get(key)?.length ?? 0) > 0) {
        decision = "manual_review"; reason = "Possible name and phone match; requires human review";
      }
    }
    if (decision === "exact_code") result.exactCode++;
    else if (decision === "exact_email") result.exactEmail++;
    else if (decision === "manual_review") result.manualReview++;
    else result.unmatched++;
    result.rows.push({ row: index + 2, decision, reason, ...(idealCode ? { idealCode } : {}) });
  }
  return result;
}
