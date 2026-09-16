export type ShiftEvent = {
  date: string;       // YYYY-MM-DD
  start: string;      // HH:mm
  end: string;        // HH:mm
  title: string;
  location?: string;
  kind?: "day" | "night" | "notice";
};

const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function esc(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function nextDate(date: string) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function stamp(date: string, time: string) {
  return date.replaceAll("-", "") + "T" + time.replace(":", "") + "00";
}

export function toICS(events: ShiftEvent[], calendarName = "Work Calendar") {
  const months = [...new Set(events.map(event => event.date.slice(0, 7)))].sort();
  const monthHeaders = months.map(month => {
    const [year, monthNumber] = month.split("-").map(Number);
    const date = `${month}-01`;
    const nextMonth = monthNumber === 12 ? `${year + 1}-01-01` : `${year}-${String(monthNumber + 1).padStart(2, "0")}-01`;
    return [
      "BEGIN:VEVENT",
      `UID:work-calendar-month-${month}@work-calendar`,
      `DTSTAMP:${stamp(date, "00:00")}`,
      `DTSTART;VALUE=DATE:${date.replaceAll("-", "")}`,
      `DTEND;VALUE=DATE:${nextMonth.replaceAll("-", "")}`,
      `SUMMARY:${esc(`${monthNames[monthNumber - 1]} ${year}`)}`,
      "TRANSP:TRANSPARENT",
      "X-MICROSOFT-CDO-BUSYSTATUS:FREE",
      "END:VEVENT"
    ].join("\r\n");
  });

  const eventBody = events.map((event, i) => {
    const endDate = event.end < event.start ? nextDate(event.date) : event.date;
    const lines = [
      "BEGIN:VEVENT",
      `UID:work-calendar-${event.date}-${event.start.replace(":", "")}-${i}@work-calendar`,
      `DTSTAMP:${stamp(event.date, "12:00")}`,
      `DTSTART;TZID=Europe/Warsaw:${stamp(event.date, event.start)}`,
      `DTEND;TZID=Europe/Warsaw:${stamp(endDate, event.end)}`,
      `SUMMARY:${esc(event.title)}`,
      event.location ? `LOCATION:${esc(event.location)}` : "",
      event.kind === "notice" ? `DESCRIPTION:${esc(event.title)}` : event.kind ? `DESCRIPTION:${esc(event.kind === "night" ? "Night shift" : "Day shift")}` : "",
      event.kind === "notice" ? "BEGIN:VALARM\nACTION:DISPLAY\nDESCRIPTION:Изменение графика\nTRIGGER:PT0M\nEND:VALARM" : "",
      "END:VEVENT"
    ];
    return lines.filter(Boolean).join("\r\n");
  }).join("\r\n");
  const body = [...monthHeaders, eventBody].filter(Boolean).join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Work Calendar//Apple Calendar Export//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calendarName)}`,
    "X-WR-TIMEZONE:Europe/Warsaw",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Warsaw",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:20261025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:20260329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    body,
    "END:VCALENDAR"
  ].join("\r\n") + "\r\n";
}