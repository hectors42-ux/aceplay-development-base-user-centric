// Helper para generar archivos .ics (iCalendar) sin APIs externas.
// Compatible con Google Calendar, Apple/iOS Calendar y Outlook.
// Incluye VTIMEZONE (America/Santiago por defecto) y VALARM (recordatorios).

interface IcsEvent {
  title: string;
  description?: string;
  location?: string;
  startsAt: Date | string;
  endsAt: Date | string;
  uid?: string;
  url?: string;
  /** IANA timezone, p. ej. "America/Santiago". Default: America/Santiago */
  timezone?: string;
  /** Recordatorios en minutos antes del inicio. Default: [60, 15]. Vacío = ninguno. */
  reminderMinutes?: number[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha UTC en formato YYYYMMDDTHHMMSSZ (para DTSTAMP) */
const toIcsUtc = (input: Date | string): string => {
  const d = typeof input === "string" ? new Date(input) : input;
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
};

/** Fecha local en una zona IANA, formato YYYYMMDDTHHMMSS (sin Z, con TZID separado) */
const toIcsLocal = (input: Date | string, timezone: string): string => {
  const d = typeof input === "string" ? new Date(input) : input;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  // hour12:false puede devolver "24" — normalizar
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}${parts.month}${parts.day}T${hour}${parts.minute}${parts.second}`;
};

const escapeIcs = (text: string): string =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");

/** Bloque VTIMEZONE para America/Santiago (incluye reglas DST CL). */
const SANTIAGO_VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:America/Santiago",
  "X-LIC-LOCATION:America/Santiago",
  "BEGIN:STANDARD",
  "DTSTART:20190407T000000",
  "TZOFFSETFROM:-0300",
  "TZOFFSETTO:-0400",
  "TZNAME:-04",
  "RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SA",
  "END:STANDARD",
  "BEGIN:DAYLIGHT",
  "DTSTART:20190908T000000",
  "TZOFFSETFROM:-0400",
  "TZOFFSETTO:-0300",
  "TZNAME:-03",
  "RRULE:FREQ=YEARLY;BYMONTH=9;BYDAY=1SA",
  "END:DAYLIGHT",
  "END:VTIMEZONE",
];

export const generateIcsContent = (event: IcsEvent): string => {
  const tz = event.timezone ?? "America/Santiago";
  const reminders = event.reminderMinutes ?? [60, 15];
  const uid = event.uid ?? `${Date.now()}-${Math.random().toString(36).slice(2)}@aceplay.cl`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AcePlay//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  // Solo incluimos el VTIMEZONE que conocemos. Para otras zonas, fallback a UTC.
  const useLocalTz = tz === "America/Santiago";
  if (useLocalTz) lines.push(...SANTIAGO_VTIMEZONE);

  lines.push(
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    useLocalTz
      ? `DTSTART;TZID=${tz}:${toIcsLocal(event.startsAt, tz)}`
      : `DTSTART:${toIcsUtc(event.startsAt)}`,
    useLocalTz
      ? `DTEND;TZID=${tz}:${toIcsLocal(event.endsAt, tz)}`
      : `DTEND:${toIcsUtc(event.endsAt)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
  );

  if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);

  // Recordatorios (VALARM) — uno por cada offset
  for (const minutes of reminders) {
    if (minutes <= 0) continue;
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(`Recordatorio: ${event.title}`)}`,
      `TRIGGER:-PT${minutes}M`,
      "END:VALARM",
    );
  }

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
};

export const downloadIcs = (event: IcsEvent, filename = "evento.ics"): void => {
  const content = generateIcsContent(event);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ---------------------------------------------------------------------------
// PRD 10 · Sesiones de torneo como un único VCALENDAR (varios VEVENTs)
// ---------------------------------------------------------------------------

export interface TournamentIcsSession {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
}

export interface BuildTournamentSessionsIcsArgs {
  tournament_id: string;
  tournament_name: string;
  cobrand_name?: string | null;
  club_address?: string | null;
  sessions: TournamentIcsSession[];
  /** Default: [1440, 60] (24h y 1h antes). */
  reminderMinutes?: number[];
  /** Default: "America/Santiago". */
  timezone?: string;
}

/** Construye un VEVENT (sin VCALENDAR wrapper). */
const buildVEvent = (args: {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  startsAt: Date | string;
  endsAt: Date | string;
  reminders: number[];
  timezone: string;
}): string[] => {
  const useLocalTz = args.timezone === "America/Santiago";
  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${args.uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    useLocalTz
      ? `DTSTART;TZID=${args.timezone}:${toIcsLocal(args.startsAt, args.timezone)}`
      : `DTSTART:${toIcsUtc(args.startsAt)}`,
    useLocalTz
      ? `DTEND;TZID=${args.timezone}:${toIcsLocal(args.endsAt, args.timezone)}`
      : `DTEND:${toIcsUtc(args.endsAt)}`,
    `SUMMARY:${escapeIcs(args.summary)}`,
  ];
  if (args.description) lines.push(`DESCRIPTION:${escapeIcs(args.description)}`);
  if (args.location) lines.push(`LOCATION:${escapeIcs(args.location)}`);
  for (const minutes of args.reminders) {
    if (minutes <= 0) continue;
    lines.push(
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(`Recordatorio: ${args.summary}`)}`,
      `TRIGGER:-PT${minutes}M`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT");
  return lines;
};

export const buildTournamentSessionsIcs = (args: BuildTournamentSessionsIcsArgs): Blob => {
  const tz = args.timezone ?? "America/Santiago";
  const reminders = args.reminderMinutes ?? [1440, 60];
  const description = [
    args.cobrand_name ? `Co-marca: ${args.cobrand_name}` : null,
    "Llega 15 min antes para confirmar tu cancha.",
    "Las parejas se sortean al iniciar la ronda.",
  ]
    .filter(Boolean)
    .join("\n");

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AcePlay//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(args.tournament_name)}`,
  ];

  if (tz === "America/Santiago") lines.push(...SANTIAGO_VTIMEZONE);

  for (const s of args.sessions) {
    lines.push(
      ...buildVEvent({
        uid: `aceplay-${args.tournament_id}-${s.id}@aceplay.cl`,
        summary: `${args.tournament_name} · ${s.name}`,
        description,
        location: args.club_address ?? "AcePlay Club",
        startsAt: s.starts_at,
        endsAt: s.ends_at,
        reminders,
        timezone: tz,
      }),
    );
  }

  lines.push("END:VCALENDAR");
  return new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
};

export const downloadTournamentSessionsIcs = (
  args: BuildTournamentSessionsIcsArgs,
  filename?: string,
): void => {
  const blob = buildTournamentSessionsIcs(args);
  const safe = (filename ?? args.tournament_name).replace(/[^a-z0-9\-_]+/gi, "_");
  const fname = safe.endsWith(".ics") ? safe : `${safe}.ics`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
