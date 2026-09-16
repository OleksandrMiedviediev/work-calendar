import type { ShiftEvent } from "./calendar";

const TIME_RE = /(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/;

export type ParseResult = {
  events: ShiftEvent[];
  rawText: string;
  warnings: string[];
};

export type ScheduleSummary = {
  day: number;
  night: number;
  total: number;
};

const monthMap: Record<string, number> = {
  styczeń: 1, stycznia: 1, january: 1,
  luty: 2, lutego: 2, february: 2,
  marzec: 3, marca: 3, march: 3,
  kwiecień: 4, kwietnia: 4, april: 4,
  maj: 5, maja: 5, may: 5,
  czerwiec: 6, czerwca: 6, june: 6,
  lipiec: 7, lipca: 7, july: 7,
  sierpień: 8, sierpnia: 8, august: 8,
  wrzesień: 9, września: 9, september: 9,
  październik: 10, października: 10, october: 10,
  listopad: 11, listopada: 11, november: 11,
  grudzień: 12, grudnia: 12, december: 12
};

function detectMonthYear(text: string) {
  const lower = text.toLowerCase();
  const year = Number((lower.match(/\b20\d{2}\b/) ?? [""])[0]) || new Date().getFullYear();

  for (const [name, month] of Object.entries(monthMap)) {
    if (lower.includes(name)) return { month, year };
  }

  return null;
}

function normalizeTime(value: string) {
  return value.padStart(5, "0");
}

function dateIso(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function extractScheduleCode(text: string) {
  const excluded = new Set(["POZ2", "LEADERS", "ASSOCIATES", "OB", "ATOZ"]);
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim().toUpperCase())
    .filter(Boolean);

  const candidates = lines.filter(line =>
    /^[A-Z0-9]+(?:-[A-Z0-9]+)?$/.test(line)
    && line.length >= 5
    && line.length <= 14
    && /[A-Z]/.test(line)
    && /\d/.test(line)
    && !excluded.has(line)
    && !/^20\d{2}$/.test(line)
  );

  return candidates[0] || "График";
}

export function extractSchedulePeriod(text: string) {
  const detected = detectMonthYear(text);
  return detected ? { month: detected.month, year: detected.year } : null;
}

export function extractScheduleSummary(text: string): ScheduleSummary | null {
  const matches = [...text.matchAll(/(\d+)\s+(\d+)\s+(\d+)\s*$/gm)];
  const match = matches.reverse().find(item => {
    const day = Number(item[1]);
    const night = Number(item[2]);
    const total = Number(item[3]);
    return day + night === total && total > 0 && total <= 31;
  });

  if (!match) return null;
  return { day: Number(match[1]), night: Number(match[2]), total: Number(match[3]) };
}

export function parseScheduleText(rawText: string): ParseResult {
  const warnings: string[] = [];
  const detected = detectMonthYear(rawText);

  if (!detected) {
    warnings.push("Не удалось уверенно определить месяц и год. Проверь их перед экспортом.");
  }

  const month = detected?.month ?? new Date().getMonth() + 1;
  const year = detected?.year ?? new Date().getFullYear();

  const lines = rawText
    .replace(/\u00A0/g, " ")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const events: ShiftEvent[] = [];

  // Works with PDF text where a day and time are on the same line
  // or on neighbouring lines.
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const next = lines[i + 1] ?? "";

    const candidates = [current, `${current} ${next}`];

    for (const candidate of candidates) {
      const tm = candidate.match(TIME_RE);
      if (!tm) continue;

      const dayMatch = candidate.match(/(?:^|\s)([1-9]|[12]\d|3[01])(?:\s|$)/);
      if (!dayMatch) continue;

      const day = Number(dayMatch[1]);
      const start = normalizeTime(tm[1]);
      const end = normalizeTime(tm[2]);

      events.push({
        date: dateIso(year, month, day),
        start,
        end,
        title: `PRACA ${start}–${end}`,
        location: "POZ2",
        kind: end < start ? "night" : "day"
      });
      break;
    }
  }

  const unique = [...new Map(
    events.map(event => [`${event.date}|${event.start}|${event.end}`, event])
  ).values()].sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));

  if (!unique.length) {
    warnings.push("Смены не найдены автоматически. OCR прочитал текст, но таблицу нужно будет улучшить parser-ом.");
  }

  return { events: unique, rawText, warnings };
}
