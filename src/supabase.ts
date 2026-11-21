import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../utils/supabase/info";

import {
  CAMPAIGNS,
  DEFAULT_CAMPAIGN_ID,
  DEFAULT_CAMPAIGN,
  FACEBOOK_OFFICIAL_POST_URL,
  parseMadagascarDateTimeInput,
  type CampaignConfig,
  type CampaignId,
} from "./campaign";

export {
  CAMPAIGNS,
  DEFAULT_CAMPAIGN_ID,
  DEFAULT_CAMPAIGN,
  FACEBOOK_OFFICIAL_POST_URL,
  type CampaignConfig,
  type CampaignId,
};

const requestedCampaign = new URL(window.location.href).searchParams.get("campaign");
export const campaignId: CampaignId =
  requestedCampaign === "november-2026-beta" || requestedCampaign === "december-2026"
    ? requestedCampaign
    : (import.meta.env.VITE_CAMPAIGN_ID as CampaignId) || DEFAULT_CAMPAIGN_ID;

export const currentCampaign: CampaignConfig = CAMPAIGNS[campaignId] || DEFAULT_CAMPAIGN;

export const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: false,
    persistSession: true,
  },
});

const serverUrl = `https://${projectId}.supabase.co/functions/v1/make-server-acdaa784`;
const sessionKey = `found-aura:participant-session:${campaignId}`;

export type CampaignStatus = {
  campaign: {
    id: CampaignId;
    name: string;
    days: string[];
    totalDays: number;
  };
  participant: {
    fullName: string;
    participationCode: string;
  };
  collectedDays: string[];
  missedDays: string[];
  eligible: boolean;
  eligibilityStatus?: "PENDING_CONFIRMATION" | "ELIGIBLE" | "NOT_ELIGIBLE";
  eligibilityMessage?: string;
  madagascarDate: string;
  summary: {
    collectedCount: number;
    missedCount: number;
    campaignEnded: boolean;
    score: string;
  };
};

export type ParticipantSessionResponse = {
  participantSession: string;
  sessionExpiresAt: string;
  recoveryToken?: string;
  status: CampaignStatus;
};

export type RegisterParticipantResult =
  | {
      recoveryRequired: false;
      participantSession: string;
      sessionExpiresAt: string;
      recoveryToken: string;
      status: CampaignStatus;
    }
  | {
      recoveryRequired: true;
      message: string;
    };

export type RecoveryRequestRecord = {
  id: string;
  campaign: CampaignId;
  fullName: string;
  contact: string;
  normalizedContact: string;
  explanation: string | null;
  status: "pending" | "approved" | "rejected";
  matchedParticipantId: string | null;
  matchedParticipant?: {
    id: string;
    fullName: string;
    publicCode: string;
    contact: string | null;
    registeredAt: string;
    collectionCount: number;
    score: string;
  } | null;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type SuspectedDuplicateParticipant = {
  id: string;
  campaign: CampaignId;
  fullName: string;
  contact: string | null;
  publicCode: string;
  registeredAt: string;
  status: string;
  collectedDays: string[];
  score: string;
  eligible: boolean;
};

export type SuspectedDuplicateGroup = {
  key: string;
  normalizedContact: string;
  participants: SuspectedDuplicateParticipant[];
  overlappingDays: string[];
  combinedUniqueDays: string[];
  eligibilityImpact: {
    beforeEligible: boolean;
    afterEligible: boolean;
    increasedScore: boolean;
  };
};

export type MergeBackupRecord = {
  id: string;
  campaign: CampaignId;
  targetParticipantId: string;
  sourceParticipantId: string;
  retainedPublicCode: string;
  retiredPublicCode: string;
  overlappingDays: string[];
  mergedDays: string[];
  adminNotes: string;
  mergedAt: string;
};

export type AdminParticipant = {
  participantId: string;
  campaign: CampaignId;
  fullName: string;
  contact?: string | null;
  participationCode: string;
  registeredAt: string;
  collectedDays: string[];
  missedDays: string[];
  score: string;
  eligible: boolean;
  eligibilityStatus?: string;
};

export type CampaignEligibilitySummary = {
  campaignEnded: boolean;
  currentDate: string;
  totalParticipants: number;
  highestScore: number;
  minimumScore: number | null;
  facebookSubmissionDeadline: string | null;
  threshold: number | null;
  eligibleCount: number;
  status: "PENDING_CONFIRMATION" | "CONFIG_REQUIRED" | "NO_ELIGIBLE_PARTICIPANTS" | "FINALIZED";
  eligibleParticipants: Array<{
    id: string;
    fullName: string;
    publicCode: string;
    score: string;
  }>;
  statusText: string;
  latestSnapshot: unknown | null;
  facebookVerifiedCount: number;
  finalVerifiedDrawPool: string[];
};

async function responseBody(response: Response) {
  const raw = await response.text();
  let body: Record<string, unknown> = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = {};
  }
  if (!response.ok) {
    if (response.status === 429) {
      const rateMsg =
        typeof body.error === "string"
          ? body.error
          : "Trop de tentatives. Veuillez patienter un instant avant de réessayer.";
      throw new Error(rateMsg);
    }
    const detail =
      typeof body.error === "string"
        ? body.error
        : raw.trim()
          ? raw.trim().slice(0, 180)
          : "Réponse vide du serveur";
    throw new Error(`Requête refusée par le service (HTTP ${response.status}) : ${detail}`);
  }
  return body;
}

async function participantRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredParticipantSession();
  const response = await fetch(`${serverUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Participant-Session": token } : {}),
      ...init?.headers,
    },
  });
  return (await responseBody(response)) as T;
}

export function getStoredParticipantSession(
  targetCampaign: CampaignId = campaignId,
): string | null {
  try {
    return (
      window.localStorage.getItem(`found-aura:participant-session:${targetCampaign}`) ||
      (targetCampaign === "december-2026"
        ? window.localStorage.getItem("found-aura:participant-session")
        : null)
    );
  } catch {
    return null;
  }
}

export function saveParticipantSession(token: string, targetCampaign: CampaignId = campaignId) {
  try {
    window.localStorage.setItem(`found-aura:participant-session:${targetCampaign}`, token);
  } catch {
    // storage unavailable
  }
}

export function clearParticipantSession(targetCampaign: CampaignId = campaignId) {
  try {
    window.localStorage.removeItem(`found-aura:participant-session:${targetCampaign}`);
    if (targetCampaign === "december-2026") {
      window.localStorage.removeItem("found-aura:participant-session");
    }
  } catch {
    // storage unavailable
  }
}

export async function registerParticipant(input: {
  fullName: string;
  contact?: string;
  accepted: boolean;
  marketingConsent: boolean;
}): Promise<RegisterParticipantResult> {
  const response = await fetch(`${serverUrl}/participants/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, campaign: campaignId }),
  });
  const data = (await responseBody(response)) as any;
  if (data.recoveryRequired) {
    return {
      recoveryRequired: true,
      message:
        typeof data.message === "string"
          ? data.message
          : "Si ces coordonnées sont déjà associées à une participation, aucun nouveau compte n’a été créé afin de protéger votre historique. Utilisez votre lien privé de récupération ou l’assistance Found Aura.",
    };
  }
  const sessionData = data as ParticipantSessionResponse;
  saveParticipantSession(sessionData.participantSession);
  return {
    recoveryRequired: false,
    participantSession: sessionData.participantSession,
    sessionExpiresAt: sessionData.sessionExpiresAt,
    recoveryToken: sessionData.recoveryToken || "",
    status: sessionData.status,
  };
}

export async function requestAssistedRecovery(input: {
  fullName: string;
  contact: string;
  explanation?: string;
}): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${serverUrl}/participants/recovery-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, campaign: campaignId }),
  });
  return (await responseBody(response)) as { success: boolean; message: string };
}

export async function recoverParticipant(
  recoveryToken: string,
  targetCampaign: CampaignId = campaignId,
) {
  const response = await fetch(`${serverUrl}/participants/recover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaign: targetCampaign, recoveryToken }),
  });
  const data = (await responseBody(response)) as ParticipantSessionResponse;
  // Clear prior session to prevent session mixing
  clearParticipantSession(targetCampaign);
  saveParticipantSession(data.participantSession, targetCampaign);
  return data;
}

export async function migrateLegacyParticipant(accessToken: string) {
  const response = await fetch(`${serverUrl}/participants/legacy-migrate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ campaign: campaignId }),
  });
  const data = (await responseBody(response)) as ParticipantSessionResponse;
  saveParticipantSession(data.participantSession);
  return data;
}

export const getCampaignStatus = () =>
  participantRequest<CampaignStatus>(`/participants/status?campaign=${campaignId}`);

export const collectCampaignDay = () =>
  participantRequest<CampaignStatus>("/participants/collect", {
    method: "POST",
    body: JSON.stringify({ campaign: campaignId }),
  });

export async function rotateRecoveryToken() {
  return participantRequest<{ recoveryToken: string }>("/participants/recovery/rotate", {
    method: "POST",
    body: JSON.stringify({ campaign: campaignId }),
  });
}

export async function revokeParticipantSession() {
  try {
    await participantRequest("/participants/logout", {
      method: "POST",
      body: JSON.stringify({ campaign: campaignId }),
    });
  } finally {
    clearParticipantSession();
  }
}

export function recoveryTokenFromUrl() {
  return new URL(window.location.href).searchParams.get("recovery");
}

export function recoveryLink(token: string) {
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set("campaign", campaignId);
  url.searchParams.set("recovery", token);
  return url.toString();
}

export function cleanRecoveryUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("recovery");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    // ignore if url manipulation fails
  }
}

export async function getAdminParticipants(
  accessToken: string,
  targetCampaign: CampaignId = campaignId,
) {
  const response = await fetch(`${serverUrl}/admin/participants?campaign=${targetCampaign}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await responseBody(response)) as { participants: AdminParticipant[] };
}

export async function getAdminRecoveryRequests(
  accessToken: string,
  status?: string,
  targetCampaign: CampaignId = campaignId,
) {
  const query = new URLSearchParams({ campaign: targetCampaign });
  if (status) query.set("status", status);
  const response = await fetch(`${serverUrl}/admin/recovery-requests?${query.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await responseBody(response)) as { requests: RecoveryRequestRecord[] };
}

export async function reviewAdminRecoveryRequest(
  accessToken: string,
  requestId: string,
  input: {
    action: "approve" | "reject";
    participantId?: string;
    adminNotes: string;
  },
) {
  const response = await fetch(`${serverUrl}/admin/recovery-requests/${requestId}/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
  return (await responseBody(response)) as {
    success: boolean;
    status: "approved" | "rejected";
    recoveryToken?: string;
    recoveryLink?: string;
    participant?: { id: string; fullName: string; publicCode: string };
  };
}

export async function getAdminDuplicates(
  accessToken: string,
  targetCampaign: CampaignId = campaignId,
) {
  const response = await fetch(`${serverUrl}/admin/duplicates?campaign=${targetCampaign}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return (await responseBody(response)) as {
    duplicateGroups: SuspectedDuplicateGroup[];
    mergeHistory: MergeBackupRecord[];
  };
}

export async function mergeAdminParticipants(
  accessToken: string,
  input: {
    primaryParticipantId: string;
    duplicateParticipantId: string;
    adminNotes: string;
  },
) {
  const response = await fetch(`${serverUrl}/admin/merge-participants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(input),
  });
  return (await responseBody(response)) as {
    success: boolean;
    backupId: string;
    retainedPublicCode: string;
    retiredPublicCode: string;
    overlappingDays: string[];
    mergedDays: string[];
  };
}

export async function getAdminCampaignEligibility(
  accessToken: string,
  targetCampaign: CampaignId = campaignId,
): Promise<CampaignEligibilitySummary> {
  const response = await fetch(
    `${serverUrl}/admin/campaign-eligibility?campaign=${targetCampaign}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return (await responseBody(response)) as CampaignEligibilitySummary;
}

export async function updateAdminDrawSettings(
  accessToken: string,
  input: { campaign: CampaignId; minimumScore: number; facebookSubmissionDeadline?: string | null },
) {
  const facebookSubmissionDeadline = parseMadagascarDateTimeInput(input.facebookSubmissionDeadline);
  if (input.facebookSubmissionDeadline && !facebookSubmissionDeadline) {
    throw new Error("La date limite Facebook est invalide.");
  }
  const response = await fetch(`${serverUrl}/admin/draw-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ ...input, facebookSubmissionDeadline }),
  });
  return (await responseBody(response)) as { settings: unknown };
}

export async function downloadAdminCsv(
  accessToken: string,
  targetCampaign: CampaignId = campaignId,
) {
  const response = await fetch(`${serverUrl}/admin/participants.csv?campaign=${targetCampaign}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) await responseBody(response);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `found-aura-${targetCampaign}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
