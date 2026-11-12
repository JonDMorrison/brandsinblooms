import { assertEquals } from '@std/assert';
import { verifyICalendar } from './calendar-verification.ts';

const wrap = (summary: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nSUMMARY:${summary}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
Deno.test('ICS verification requires the exact expected event and valid physical UTF-8 lines', () => {
  assertEquals(verifyICalendar(wrap('Garden 🌱'), ['Garden 🌱']), true);
  assertEquals(verifyICalendar(wrap('Garden\r\n  🌱'), ['Garden 🌱']), true);
  assertEquals(verifyICalendar(wrap('Garden'), ['Garden 🌱']), false);
  assertEquals(verifyICalendar(wrap('é'.repeat(50)), ['é'.repeat(50)]), false);
  assertEquals(verifyICalendar(wrap('��'), ['🌱']), false);
  assertEquals(verifyICalendar(wrap('Garden').replaceAll('\r\n', '\n'), ['Garden']), false);
  assertEquals(verifyICalendar(wrap('Garden'), []), false);
  assertEquals(verifyICalendar(wrap('Garden').replace('BEGIN:VCALENDAR\r\n', 'BEGIN:VCALENDAR\r\n broken\r\n'), ['Garden']), false);
  assertEquals(verifyICalendar(wrap('Garden').replace('VERSION:2.0\r\nBEGIN:VEVENT', 'BEGIN:VEVENT\r\nVERSION:2.0'), ['Garden']), false);
  assertEquals(verifyICalendar('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', ['Garden']), false);
  assertEquals(verifyICalendar(wrap('A\\,B\\;C\\nD'), ['A,B;C\nD']), true);
  assertEquals(verifyICalendar(wrap('Garden').replace('END:VEVENT\r\n', ''), ['Garden']), false);
});
