/** Reject invalid Unicode and controls, while allowing RFC text line delimiters. */
export function invalidCalendarText(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0)!;
    if ((code < 32 && ![9, 10, 13].includes(code)) || code === 0xfffd ||
      (code >= 0xd800 && code <= 0xdfff)) return true;
  }
  return false;
}

/** Deterministic assertions selected only by release-owned verification policy. */
export function verifyICalendar(text: string, expectedSummaries: readonly string[]): boolean {
  if (!text.endsWith('\r\n') || /(?<!\r)\n|\r(?!\n)/.test(text) || invalidCalendarText(text)) return false;
  const physical = text.slice(0, -2).split('\r\n');
  const encoder = new TextEncoder();
  if (physical.some(line => !line || encoder.encode(line).length > 75)) return false;
  if (physical[0] !== 'BEGIN:VCALENDAR' || physical.at(-1) !== 'END:VCALENDAR') return false;
  const logical: string[] = [];
  for (const line of physical) {
    if (/^[ \t]/.test(line)) {
      if (!logical.length) return false;
      logical[logical.length - 1] += line.slice(1);
    } else logical.push(line);
  }
  if (logical[0] !== 'BEGIN:VCALENDAR' || logical.at(-1) !== 'END:VCALENDAR' ||
    logical.filter(line => line === 'VERSION:2.0').length !== 1) return false;
  const summaries: string[] = [];
  let inEvent = false;
  let eventHasSummary = false;
  for (const line of logical.slice(1, -1)) {
    if (line === 'BEGIN:VEVENT') {
      if (inEvent) return false;
      inEvent = true; eventHasSummary = false;
    } else if (line === 'END:VEVENT') {
      if (!inEvent || !eventHasSummary) return false;
      inEvent = false;
    } else if (line.startsWith('VERSION:')) {
      if (inEvent || line !== 'VERSION:2.0') return false;
    } else if (line.startsWith('SUMMARY:')) {
      if (!inEvent || eventHasSummary) return false;
      eventHasSummary = true;
      summaries.push(line.slice(8));
    } else if (line.startsWith('BEGIN:') || line.startsWith('END:')) return false;
  }
  const escape = (value: string) => value.replace(/\r\n?/g, '\n').replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  return !inEvent && expectedSummaries.length > 0 && expectedSummaries.every(value => summaries.includes(escape(value)));
}
