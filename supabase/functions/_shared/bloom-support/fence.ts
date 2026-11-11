// Pure: no I/O and no Deno globals.

/** Untrusted text is fenced and labelled so the model treats it as data. */
export function fence(label: string, text: string): string {
  return `<${label} untrusted="true">\n${text.replace(/<\/?[a-z_]+ untrusted="true">/gi, "").slice(0, 12000)}\n</${label}>`;
}
