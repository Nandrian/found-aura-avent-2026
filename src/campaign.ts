export type CampaignId = "december-2026" | "november-2026-beta";

export interface CampaignConfig {
  id: CampaignId;
  name: string;
  brand: string;
  startDate: string;
  endDate: string;
  timeZone: string;
  totalDays: number;
  days: string[];
  tagline: string;
  heroCopy: string;
  dateBadge: string;
  isBeta: boolean;
}

export const CAMPAIGNS: Record<CampaignId, CampaignConfig> = {
  "december-2026": {
    id: "december-2026",
    name: "The Secret Wardrobe",
    brand: "Found Aura",
    startDate: "2026-12-01",
    endDate: "2026-12-24",
    timeZone: "Indian/Antananarivo",
    totalDays: 24,
    days: Array.from({ length: 24 }, (_, i) => `2026-12-${String(i + 1).padStart(2, "0")}`),
    tagline: "24 Days. 24 Discoveries. One Aura.",
    heroCopy:
      "« Chaque jour, une porte s’ouvre sur votre style. Découvrez 24 surprises imaginées pour vous. »",
    dateBadge: "01—24 · 12 · 26",
    isBeta: false,
  },
  "november-2026-beta": {
    id: "november-2026-beta",
    name: "Found Aura Beta 2026",
    brand: "Found Aura",
    startDate: "2026-11-13",
    endDate: "2026-11-14",
    timeZone: "Indian/Antananarivo",
    totalDays: 2,
    days: ["2026-11-13", "2026-11-14"],
    tagline: "2 Days. 2 Discoveries. One Aura.",
    heroCopy:
      "« Deux jours, deux portes ouvertes sur votre style. Découvrez la bêta imaginée pour vous. »",
    dateBadge: "13—14 · 11 · 26",
    isBeta: true,
  },
};

export const DEFAULT_CAMPAIGN_ID: CampaignId = "december-2026";
export const DEFAULT_CAMPAIGN = CAMPAIGNS[DEFAULT_CAMPAIGN_ID];

const envFacebookUrl =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env.VITE_FACEBOOK_POST_URL
    : undefined;

export const FACEBOOK_OFFICIAL_POST_URL =
  envFacebookUrl || "https://www.facebook.com/foundaura/posts/the-secret-wardrobe-2026";

export const MADAGASCAR_TIME_ZONE = "Indian/Antananarivo";
export const MADAGASCAR_UTC_OFFSET = "+03:00";

function madagascarDateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MADAGASCAR_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((item) => item.type === type)?.value || "00";
  const rawHour = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: rawHour === "24" ? "00" : rawHour,
    minute: get("minute"),
    second: get("second"),
  };
}

/**
 * Interprets a datetime-local wall-clock value in Indian/Antananarivo (+03:00)
 * and returns an explicit ISO-8601 timestamp ("YYYY-MM-DDTHH:mm:ss+03:00").
 * If the input already carries an explicit timezone offset (Z or ±HH:MM),
 * preserves the exact instant without applying a second offset.
 */
export function parseMadagascarDateTimeInput(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const localMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (localMatch) {
    const [, year, month, day, hour, minute, second = "00"] = localMatch;
    const candidate = `${year}-${month}-${day}T${hour}:${minute}:${second}${MADAGASCAR_UTC_OFFSET}`;
    const parsed = new Date(candidate);
    if (Number.isNaN(parsed.getTime())) return null;
    const actual = madagascarDateTimeParts(parsed);
    if (
      actual.year !== year ||
      actual.month !== month ||
      actual.day !== day ||
      actual.hour !== hour ||
      actual.minute !== minute ||
      actual.second !== second
    ) {
      return null;
    }
    return candidate;
  }

  const normalizedPg = trimmed
    .replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T")
    .replace(/([+-]\d{2})$/, "$1:00");
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalizedPg)) return null;

  const parsed = new Date(normalizedPg);
  if (Number.isNaN(parsed.getTime())) return null;
  const p = madagascarDateTimeParts(parsed);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${MADAGASCAR_UTC_OFFSET}`;
}

/**
 * Formats a stored timestamp for an HTML <input type="datetime-local">
 * in Madagascar local time (Indian/Antananarivo, UTC+03:00), regardless of
 * the administrator browser's local timezone.
 */
export function formatMadagascarDateTimeInput(value: string | null | undefined): string {
  const canonical = parseMadagascarDateTimeInput(value);
  if (!canonical) return "";
  const p = madagascarDateTimeParts(new Date(canonical));
  return p.second !== "00"
    ? `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`
    : `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * Formats a stored timestamp for display in French ("DD/MM/YYYY HH:mm:ss")
 * strictly in Madagascar local time (Indian/Antananarivo, UTC+03:00).
 */
export function formatMadagascarDateTimeDisplay(value: string | null | undefined): string {
  const canonical = parseMadagascarDateTimeInput(value);
  if (!canonical) return "";
  const p = madagascarDateTimeParts(new Date(canonical));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
}

export type ResolvedEligibilityState =
  | "PENDING"
  | "ELIGIBLE"
  | "NOT_ELIGIBLE"
  | "NO_ELIGIBLE_PARTICIPANTS";

export function resolveEligibilityDisplay(input: {
  campaignId: CampaignId;
  madagascarDate: string;
  campaignEnded?: boolean;
  eligible?: boolean;
  eligibilityStatus?: string;
  drawStatus?: string;
  eligibilityMessage?: string;
}): {
  state: ResolvedEligibilityState;
  isEligible: boolean;
  label: string;
  ticketLabel: string;
} {
  const cfg = CAMPAIGNS[input.campaignId] || DEFAULT_CAMPAIGN;
  const ended =
    typeof input.campaignEnded === "boolean"
      ? input.campaignEnded
      : input.madagascarDate > cfg.endDate;

  if (
    !ended ||
    input.eligibilityStatus === "PENDING_CONFIRMATION" ||
    input.drawStatus === "PENDING_CONFIRMATION" ||
    input.drawStatus === "CONFIG_REQUIRED"
  ) {
    return {
      state: "PENDING",
      isEligible: false,
      label: "Éligibilité en attente",
      ticketLabel: "ÉLIGIBILITÉ EN ATTENTE",
    };
  }

  if (
    input.drawStatus === "NO_ELIGIBLE_PARTICIPANTS" ||
    input.eligibilityMessage === "Aucun participant éligible selon le seuil officiel."
  ) {
    return {
      state: "NO_ELIGIBLE_PARTICIPANTS",
      isEligible: false,
      label: "Aucun participant éligible selon le seuil officiel",
      ticketLabel: "AUCUN PARTICIPANT ÉLIGIBLE SELON LE SEUIL OFFICIEL",
    };
  }

  if (input.eligibilityStatus === "ELIGIBLE" || Boolean(input.eligible)) {
    return {
      state: "ELIGIBLE",
      isEligible: true,
      label: "Éligible au grand tirage",
      ticketLabel: "ÉLIGIBLE AU GRAND TIRAGE",
    };
  }

  return {
    state: "NOT_ELIGIBLE",
    isEligible: false,
    label: "Non éligible",
    ticketLabel: "NON ÉLIGIBLE AU GRAND TIRAGE",
  };
}
