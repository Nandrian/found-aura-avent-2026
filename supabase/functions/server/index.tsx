import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { createClient, type User } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();
const PUBLIC_ORIGIN = "https://found-aura-avent-calendar-2026.figma.site";
const SESSION_DAYS = 120;
const CAMPAIGNS = {
  "december-2026": {
    id: "december-2026",
    name: "The Secret Wardrobe",
    brand: "Found Aura",
    days: Array.from({ length: 24 }, (_, index) => `2026-12-${String(index + 1).padStart(2, "0")}`),
  },
  "november-2026-beta": {
    id: "november-2026-beta",
    name: "Found Aura Beta 2026",
    brand: "Found Aura",
    days: ["2026-11-13", "2026-11-14"],
  },
} as const;

type CampaignId = keyof typeof CAMPAIGNS;

function allowedOrigin(origin: string) {
  if (!origin) return PUBLIC_ORIGIN;
  if (
    origin === PUBLIC_ORIGIN ||
    origin.startsWith("http://localhost:") ||
    origin.endsWith(".figma.site") ||
    origin.endsWith(".makeproxy-c.figma.site") ||
    origin.endsWith(".figma.com")
  )
    return origin;
  return origin;
}

app.use(
  "/*",
  cors({
    origin: allowedOrigin,
    allowHeaders: ["Content-Type", "Authorization", "X-Participant-Session"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.use("/make-server-acdaa784/participants/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

app.get("/make-server-acdaa784/health", (c) => c.json({ status: "ok" }));

const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

function madagascarDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Indian/Antananarivo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function parseMadagascarDateTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error("INVALID_FACEBOOK_DEADLINE");
  const trimmed = value.trim();
  const localMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  const timestamp = localMatch
    ? `${localMatch[1]}-${localMatch[2]}-${localMatch[3]}T${localMatch[4]}:${localMatch[5]}:${localMatch[6] || "00"}+03:00`
    : trimmed;
  if (
    !localMatch &&
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)
  ) {
    throw new Error("INVALID_FACEBOOK_DEADLINE");
  }
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) throw new Error("INVALID_FACEBOOK_DEADLINE");
  return parsed.toISOString();
}

function campaignFor(value: unknown) {
  if (!value || typeof value !== "string") return CAMPAIGNS["december-2026"];
  if (!(value in CAMPAIGNS)) throw new Error("INVALID_CAMPAIGN");
  return CAMPAIGNS[value as CampaignId];
}

function normalizeContact(contact: unknown): string | null {
  if (typeof contact !== "string") return null;
  const trimmed = contact.trim();
  if (!trimmed) return null;
  if (trimmed.includes("@")) {
    const parts = trimmed.split("@");
    if (parts.length === 2) {
      const cleanLocal = parts[0].trim().toLowerCase();
      const cleanDomain = parts[1].trim().toLowerCase();
      return `${cleanLocal}@${cleanDomain}`;
    }
    return trimmed.toLowerCase();
  }
  const cleaned = trimmed.replace(/[\s.\-()]/g, "");
  return cleaned.length >= 3 ? cleaned : trimmed.toLowerCase();
}

function randomToken(bytes = 32) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = "";
  value.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function rateKey(c: any) {
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || c.req.header("cf-connecting-ip") || "unknown";
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return tokenHash(`${address}:${secret.slice(-32)}`);
}

async function enforceRateLimit(c: any, action: string, limit: number, seconds: number) {
  const key = await rateKey(c);
  const { data, error } = await adminClient().rpc("consume_found_aura_rate_limit", {
    p_rate_key: key,
    p_action: action,
    p_limit: limit,
    p_window_seconds: seconds,
  });
  if (error) throw error;
  if (!data) throw new Error("RATE_LIMITED");
}

async function createSession(participantId: string) {
  const token = randomToken();
  const hash = await tokenHash(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  const { error } = await adminClient().from("found_aura_participant_sessions").insert({
    participant_id: participantId,
    token_hash: hash,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return { token, expiresAt };
}

async function participantSession(c: any, campaignId?: CampaignId) {
  const token = c.req.header("X-Participant-Session") || "";
  if (token.length < 40) throw new Error("PARTICIPANT_AUTH_REQUIRED");
  const hash = await tokenHash(token);
  const supabase = adminClient();
  const sessionResult = await supabase
    .from("found_aura_participant_sessions")
    .select("id,participant_id,expires_at,revoked_at")
    .eq("token_hash", hash)
    .maybeSingle();
  if (sessionResult.error) throw sessionResult.error;
  const session = sessionResult.data;
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now())
    throw new Error("PARTICIPANT_AUTH_REQUIRED");

  const participantResult = await supabase
    .from("found_aura_campaign_participants")
    .select("*")
    .eq("id", session.participant_id)
    .maybeSingle();
  if (participantResult.error) throw participantResult.error;
  if (!participantResult.data) throw new Error("PARTICIPANT_AUTH_REQUIRED");
  if (campaignId && participantResult.data.campaign !== campaignId)
    throw new Error("PARTICIPANT_AUTH_REQUIRED");

  await supabase
    .from("found_aura_participant_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id);
  return { session, participant: participantResult.data };
}

async function uniquePublicCode(campaignId: CampaignId) {
  const prefix = campaignId === "november-2026-beta" ? "FA-BETA" : "FA-DEC";
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 5; attempt++) {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    const code = `${prefix}-${suffix.slice(0, 4)}-${suffix.slice(4, 8)}-${suffix.slice(8)}`;
    const existing = await adminClient()
      .from("found_aura_campaign_participants")
      .select("id")
      .eq("public_code", code)
      .maybeSingle();
    if (existing.error) throw existing.error;
    if (!existing.data) return code;
  }
  throw new Error("CODE_GENERATION_FAILED");
}

async function validCollectionCounts(campaignId: CampaignId, participantIds?: string[]) {
  const campaign = CAMPAIGNS[campaignId];
  const supabase = adminClient();
  let query = supabase
    .from("found_aura_campaign_collections")
    .select("participant_id, collection_date")
    .eq("campaign", campaignId);
  if (participantIds) query = query.in("participant_id", participantIds);
  const { data: collections, error } = await query;
  if (error) throw error;

  const daysByParticipant: Record<string, Set<string>> = {};
  (collections || []).forEach((c: any) => {
    if (!campaign.days.includes(c.collection_date)) return;
    if (!daysByParticipant[c.participant_id]) daysByParticipant[c.participant_id] = new Set();
    daysByParticipant[c.participant_id].add(c.collection_date);
  });
  return daysByParticipant;
}

async function calculateDescendingEligibility(campaignId: CampaignId) {
  const campaign = CAMPAIGNS[campaignId];
  const currentDate = madagascarDate();
  const campaignEnded = currentDate > campaign.days[campaign.days.length - 1];
  const supabase = adminClient();
  const { data: participants, error: participantsError } = await supabase
    .from("found_aura_campaign_participants")
    .select("id, full_name, public_code")
    .eq("campaign", campaignId)
    .eq("status", "active");
  if (participantsError) throw participantsError;

  const participantIds = (participants || []).map((participant: any) => participant.id);
  const daysByParticipant = await validCollectionCounts(campaignId, participantIds);
  const scores = (participants || []).map((p: any) => daysByParticipant[p.id]?.size || 0);
  const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const { data: settings, error: settingsError } = await supabase
    .from("found_aura_campaign_draw_settings")
    .select("minimum_score,facebook_submission_deadline")
    .eq("campaign", campaignId)
    .maybeSingle();
  if (settingsError && !settingsError.message.includes("does not exist")) throw settingsError;
  const minimumScore = settings?.minimum_score ?? null;
  let threshold: number | null = null;
  let statusText = "Éligibilité au tirage en attente de confirmation.";
  let status:
    | "PENDING_CONFIRMATION"
    | "CONFIG_REQUIRED"
    | "NO_ELIGIBLE_PARTICIPANTS"
    | "FINALIZED" = "PENDING_CONFIRMATION";
  if (campaignEnded && minimumScore === null) {
    status = "CONFIG_REQUIRED";
    statusText = "Configuration requise : le score minimum officiel n’a pas été publié.";
  } else if (campaignEnded && minimumScore !== null) {
    if (highestScore >= minimumScore) {
      threshold = highestScore;
      status = "FINALIZED";
      statusText = `Seuil calculé : ${threshold}/${campaign.days.length} Auras.`;
    } else {
      status = "NO_ELIGIBLE_PARTICIPANTS";
      statusText = "Aucun participant éligible selon le seuil officiel.";
    }
  }
  const eligibleParticipants = (participants || []).filter(
    (p: any) =>
      status === "FINALIZED" &&
      threshold !== null &&
      (daysByParticipant[p.id]?.size || 0) === threshold,
  );
  return {
    campaignEnded,
    currentDate,
    totalParticipants: (participants || []).length,
    highestScore,
    minimumScore,
    facebookSubmissionDeadline: settings?.facebook_submission_deadline || null,
    threshold,
    eligibleCount: eligibleParticipants.length,
    status,
    eligibleParticipants: eligibleParticipants.map((p: any) => ({
      id: p.id,
      fullName: p.full_name,
      publicCode: p.public_code,
      score: `${daysByParticipant[p.id]?.size || 0}/${campaign.days.length}`,
    })),
    statusText,
  };
}

async function statusFor(participant: any) {
  const campaign = campaignFor(participant.campaign);
  const currentDate = madagascarDate();
  const validDays = await validCollectionCounts(campaign.id, [participant.id]);
  const collectedDays = Array.from(validDays[participant.id] || []).sort();
  const missedDays = campaign.days.filter(
    (day) => day < currentDate && !collectedDays.includes(day),
  );
  const campaignEnded = currentDate > campaign.days[campaign.days.length - 1];

  let eligible = false;
  let eligibilityStatus: "PENDING_CONFIRMATION" | "ELIGIBLE" | "NOT_ELIGIBLE" =
    "PENDING_CONFIRMATION";
  let eligibilityMessage = "Éligibilité au tirage en attente de confirmation.";

  if (campaignEnded) {
    const draw = await calculateDescendingEligibility(campaign.id);
    if (draw.status === "CONFIG_REQUIRED") {
      eligibilityMessage = "Éligibilité au tirage en attente de confirmation.";
    } else if (draw.status === "NO_ELIGIBLE_PARTICIPANTS") {
      eligibilityStatus = "NOT_ELIGIBLE";
      eligibilityMessage = "Aucun participant éligible selon le seuil officiel.";
    } else if (
      draw.status === "FINALIZED" &&
      draw.threshold !== null &&
      collectedDays.length === draw.threshold
    ) {
      eligible = true;
      eligibilityStatus = "ELIGIBLE";
      eligibilityMessage = `Félicitations ! Vous avez atteint le meilleur score de la campagne (${collectedDays.length}/${campaign.days.length}) et êtes éligible au grand tirage.`;
    } else {
      eligible = false;
      eligibilityStatus = "NOT_ELIGIBLE";
      eligibilityMessage = `Votre score final est de ${collectedDays.length}/${campaign.days.length}. Le seuil requis était de ${draw.threshold}/${campaign.days.length}.`;
    }
  } else {
    eligibilityStatus = "PENDING_CONFIRMATION";
    eligibilityMessage = "Éligibilité au tirage en attente de confirmation.";
    eligible = false;
  }

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      days: campaign.days,
      totalDays: campaign.days.length,
    },
    participant: {
      fullName: participant.full_name,
      participationCode: participant.public_code,
    },
    collectedDays,
    missedDays,
    eligible,
    eligibilityStatus,
    eligibilityMessage,
    madagascarDate: currentDate,
    summary: {
      collectedCount: collectedDays.length,
      missedCount: missedDays.length,
      campaignEnded,
      score: `${collectedDays.length}/${campaign.days.length}`,
    },
  };
}

function publicError(c: any, error: unknown) {
  const message = error instanceof Error ? error.message : "UNKNOWN";
  if (message === "PARTICIPANT_AUTH_REQUIRED")
    return c.json({ error: "Session participante invalide ou expirée." }, 401);
  if (message === "INVALID_CAMPAIGN") return c.json({ error: "Campagne invalide." }, 422);
  if (message === "RATE_LIMITED")
    return c.json({ error: "Trop de tentatives. Veuillez réessayer plus tard." }, 429);
  if (message === "INVALID_REGISTRATION")
    return c.json({ error: "Les informations d’inscription sont invalides." }, 422);
  console.error(error);
  return c.json({ error: "Le service est momentanément indisponible." }, 500);
}

app.post("/make-server-acdaa784/participants/register", async (c) => {
  try {
    await enforceRateLimit(c, "register", 10, 3600);
    const body = await c.req.json();
    const campaign = campaignFor(body.campaign);
    const fullName = String(body.fullName || "").trim();
    const rawContact = String(body.contact || "").trim() || null;
    const normalizedContact = normalizeContact(rawContact);
    if (
      fullName.length < 2 ||
      fullName.length > 120 ||
      (rawContact && (rawContact.length < 3 || rawContact.length > 254)) ||
      body.accepted !== true
    )
      throw new Error("INVALID_REGISTRATION");

    // If contact is provided, check for duplicate conflict without revealing private details
    if (normalizedContact) {
      const supabase = adminClient();
      const { data: existingMatches, error: searchError } = await supabase
        .from("found_aura_campaign_participants")
        .select("id, contact, status")
        .eq("campaign", campaign.id)
        .neq("status", "merged");

      if (!searchError && existingMatches && existingMatches.length > 0) {
        const hasConflict = existingMatches.some((row: any) => {
          const rowNorm = normalizeContact(row.contact);
          return rowNorm === normalizedContact;
        });

        if (hasConflict) {
          return c.json(
            {
              recoveryRequired: true,
              message:
                "Si ces coordonnées sont déjà associées à une participation, aucun nouveau compte n’a été créé afin de protéger votre historique. Utilisez votre lien privé de récupération ou l’assistance Found Aura.",
            },
            200,
          );
        }
      }
    }

    const recoveryToken = randomToken();
    const recoveryHash = await tokenHash(recoveryToken);
    const publicCode = await uniquePublicCode(campaign.id);
    const supabase = adminClient();

    const insertPayload: Record<string, any> = {
      campaign: campaign.id,
      full_name: fullName,
      contact: rawContact,
      normalized_contact: normalizedContact,
      status: "active",
      marketing_consent: body.marketingConsent === true,
      public_code: publicCode,
      recovery_token_hash: recoveryHash,
    };

    let inserted = await supabase
      .from("found_aura_campaign_participants")
      .insert(insertPayload)
      .select("*")
      .single();

    if (
      inserted.error &&
      (inserted.error.message.includes("normalized_contact") ||
        inserted.error.message.includes("status"))
    ) {
      delete insertPayload.normalized_contact;
      delete insertPayload.status;
      inserted = await supabase
        .from("found_aura_campaign_participants")
        .insert(insertPayload)
        .select("*")
        .single();
    }
    if (inserted.error) throw inserted.error;

    try {
      const session = await createSession(inserted.data.id);
      return c.json(
        {
          recoveryRequired: false,
          participantSession: session.token,
          sessionExpiresAt: session.expiresAt,
          recoveryToken,
          status: await statusFor(inserted.data),
        },
        201,
      );
    } catch (error) {
      await supabase.from("found_aura_campaign_participants").delete().eq("id", inserted.data.id);
      throw error;
    }
  } catch (error) {
    return publicError(c, error);
  }
});

app.post("/make-server-acdaa784/participants/recovery-request", async (c) => {
  try {
    await enforceRateLimit(c, "recovery-request", 5, 3600);
    const body = await c.req.json();
    const campaign = campaignFor(body.campaign);
    const fullName = String(body.fullName || "").trim();
    const rawContact = String(body.contact || "").trim();
    const explanation = String(body.explanation || "").trim() || null;
    const normalizedContact = normalizeContact(rawContact);

    if (
      fullName.length < 2 ||
      fullName.length > 120 ||
      rawContact.length < 3 ||
      rawContact.length > 254 ||
      !normalizedContact
    ) {
      return c.json({ error: "Veuillez fournir un nom et des coordonnées valides." }, 422);
    }

    const supabase = adminClient();
    const { data: candidates } = await supabase
      .from("found_aura_campaign_participants")
      .select("id, contact, status")
      .eq("campaign", campaign.id)
      .neq("status", "merged");

    let matchedId: string | null = null;
    if (candidates && candidates.length > 0) {
      const found = candidates.find(
        (row: any) => normalizeContact(row.contact) === normalizedContact,
      );
      if (found) matchedId = found.id;
    }

    await supabase.from("found_aura_recovery_requests").insert({
      campaign: campaign.id,
      full_name: fullName,
      contact: rawContact,
      normalized_contact: normalizedContact,
      explanation: explanation ? explanation.slice(0, 1000) : null,
      status: "pending",
      matched_participant_id: matchedId,
    });

    // Neutral response preventing account enumeration
    return c.json({
      success: true,
      message:
        "Votre demande de récupération a été transmise à l'équipe Found Aura. Si votre participation est confirmée après vérification manuelle, un administrateur vous transmettra un nouveau lien privé.",
    });
  } catch (error) {
    return publicError(c, error);
  }
});

app.post("/make-server-acdaa784/participants/recover", async (c) => {
  try {
    await enforceRateLimit(c, "recover", 20, 3600);
    const body = await c.req.json();
    const campaign = campaignFor(body.campaign);
    const token = String(body.recoveryToken || "");
    if (token.length < 40) throw new Error("PARTICIPANT_AUTH_REQUIRED");
    const hash = await tokenHash(token);
    const participant = await adminClient()
      .from("found_aura_campaign_participants")
      .select("*")
      .eq("campaign", campaign.id)
      .eq("recovery_token_hash", hash)
      .maybeSingle();
    if (participant.error) throw participant.error;
    if (!participant.data) throw new Error("PARTICIPANT_AUTH_REQUIRED");
    const session = await createSession(participant.data.id);
    return c.json({
      participantSession: session.token,
      sessionExpiresAt: session.expiresAt,
      status: await statusFor(participant.data),
    });
  } catch (error) {
    return publicError(c, error);
  }
});

app.post("/make-server-acdaa784/participants/legacy-migrate", async (c) => {
  try {
    const body = await c.req.json();
    const campaign = campaignFor(body.campaign);
    const bearer = (c.req.header("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!bearer) throw new Error("PARTICIPANT_AUTH_REQUIRED");
    const user = await adminClient().auth.getUser(bearer);
    if (user.error || !user.data.user) throw new Error("PARTICIPANT_AUTH_REQUIRED");
    const participant = await adminClient()
      .from("found_aura_campaign_participants")
      .select("*")
      .eq("campaign", campaign.id)
      .eq("legacy_auth_user_id", user.data.user.id)
      .maybeSingle();
    if (participant.error) throw participant.error;
    if (!participant.data) throw new Error("PARTICIPANT_AUTH_REQUIRED");

    const recoveryToken = randomToken();
    const update = await adminClient()
      .from("found_aura_campaign_participants")
      .update({
        recovery_token_hash: await tokenHash(recoveryToken),
        recovery_rotated_at: new Date().toISOString(),
      })
      .eq("id", participant.data.id);
    if (update.error) throw update.error;
    const session = await createSession(participant.data.id);
    return c.json({
      participantSession: session.token,
      sessionExpiresAt: session.expiresAt,
      recoveryToken,
      status: await statusFor(participant.data),
    });
  } catch (error) {
    return publicError(c, error);
  }
});

app.get("/make-server-acdaa784/participants/status", async (c) => {
  try {
    await enforceRateLimit(c, "participant-status", 300, 3600);
    const campaign = campaignFor(c.req.query("campaign"));
    const { participant } = await participantSession(c, campaign.id);
    return c.json(await statusFor(participant));
  } catch (error) {
    return publicError(c, error);
  }
});

app.post("/make-server-acdaa784/participants/collect", async (c) => {
  try {
    await enforceRateLimit(c, "participant-collect", 60, 3600);
    const body = await c.req.json();
    const campaign = campaignFor(body.campaign);
    const { participant } = await participantSession(c, campaign.id);
    const collectionDate = madagascarDate();
    if (!(campaign.days as readonly string[]).includes(collectionDate))
      return c.json({ error: "Aucune Aura n’est disponible aujourd’hui à Madagascar." }, 403);
    const result = await adminClient().from("found_aura_campaign_collections").upsert(
      {
        participant_id: participant.id,
        campaign: campaign.id,
        collection_date: collectionDate,
      },
      { onConflict: "participant_id,campaign,collection_date", ignoreDuplicates: true },
    );
    if (result.error) throw result.error;
    return c.json(await statusFor(participant));
  } catch (error) {
    return publicError(c, error);
  }
});

app.post("/make-server-acdaa784/participants/recovery/rotate", async (c) => {
  try {
    const body = await c.req.json();
    const campaign = campaignFor(body.campaign);
    const { participant, session } = await participantSession(c, campaign.id);
    const recoveryToken = randomToken();
    const result = await adminClient()
      .from("found_aura_campaign_participants")
      .update({
        recovery_token_hash: await tokenHash(recoveryToken),
        recovery_rotated_at: new Date().toISOString(),
      })
      .eq("id", participant.id);
    if (result.error) throw result.error;
    const revoke = await adminClient()
      .from("found_aura_participant_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("participant_id", participant.id)
      .neq("id", session.id)
      .is("revoked_at", null);
    if (revoke.error) throw revoke.error;
    return c.json({ recoveryToken });
  } catch (error) {
    return publicError(c, error);
  }
});

app.post("/make-server-acdaa784/participants/logout", async (c) => {
  try {
    const body = await c.req.json();
    const campaign = campaignFor(body.campaign);
    const { session } = await participantSession(c, campaign.id);
    const result = await adminClient()
      .from("found_aura_participant_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", session.id);
    if (result.error) throw result.error;
    return c.json({ ok: true });
  } catch (error) {
    return publicError(c, error);
  }
});

async function authenticatedAdmin(c: any): Promise<User> {
  const token = (c.req.header("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("ADMIN_AUTH_REQUIRED");
  const { data, error } = await adminClient().auth.getUser(token);
  if (error || !data.user || data.user.app_metadata?.role !== "admin")
    throw new Error("ADMIN_AUTH_REQUIRED");
  return data.user;
}

async function adminRows(campaignId?: CampaignId) {
  const supabase = adminClient();
  let query = supabase
    .from("found_aura_campaign_participants")
    .select("*")
    .neq("status", "merged")
    .order("registered_at");
  if (campaignId) query = query.eq("campaign", campaignId);
  const participants = await query;
  if (participants.error) throw participants.error;
  const collections = await supabase
    .from("found_aura_campaign_collections")
    .select("participant_id,campaign,collection_date");
  if (collections.error) throw collections.error;
  return Promise.all(
    (participants.data || []).map(async (participant) => {
      const status = await statusFor(participant);
      return {
        participantId: participant.id,
        campaign: participant.campaign,
        fullName: participant.full_name,
        contact: participant.contact,
        participationCode: participant.public_code,
        registeredAt: participant.registered_at,
        collectedDays: status.collectedDays,
        missedDays: status.missedDays,
        score: status.summary.score,
        eligible: status.eligible,
        eligibilityStatus: status.eligibilityStatus,
      };
    }),
  );
}

function adminError(c: any, error: unknown) {
  if (error instanceof Error && error.message === "ADMIN_AUTH_REQUIRED")
    return c.json({ error: "Accès administrateur requis." }, 403);
  return publicError(c, error);
}

app.get("/make-server-acdaa784/admin/campaign-eligibility", async (c) => {
  try {
    await authenticatedAdmin(c);
    const campaignValue = c.req.query("campaign");
    const campaign = campaignFor(campaignValue);
    const eligibility = await calculateDescendingEligibility(campaign.id);
    const supabase = adminClient();
    const [snapshotResult, entriesResult] = await Promise.all([
      supabase
        .from("found_aura_campaign_draw_snapshots")
        .select("*")
        .eq("campaign", campaign.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("found_aura_facebook_draw_entries")
        .select("public_code,participant_id,comment_reference,verified_at,verification_notes")
        .eq("campaign", campaign.id)
        .not("verified_at", "is", null),
    ]);
    if (snapshotResult.error && !snapshotResult.error.message.includes("does not exist"))
      throw snapshotResult.error;
    if (entriesResult.error && !entriesResult.error.message.includes("does not exist"))
      throw entriesResult.error;
    const verifiedEntries = (entriesResult.data || []).filter((entry: any) =>
      eligibility.eligibleParticipants.some((candidate) => candidate.id === entry.participant_id),
    );
    return c.json({
      ...eligibility,
      latestSnapshot: snapshotResult.data || null,
      facebookVerifiedCount: verifiedEntries.length,
      finalVerifiedDrawPool: verifiedEntries.map((entry: any) => entry.public_code),
    });
  } catch (error) {
    return adminError(c, error);
  }
});

app.post("/make-server-acdaa784/admin/draw-settings", async (c) => {
  try {
    const admin = await authenticatedAdmin(c);
    const body = await c.req.json();
    const campaign = campaignFor(body.campaign);
    const minimumScore = body.minimumScore;
    let deadline: string | null;
    try {
      deadline = parseMadagascarDateTime(body.facebookSubmissionDeadline);
    } catch {
      return c.json({ error: "La date limite Facebook est invalide." }, 422);
    }
    if (
      !Number.isInteger(minimumScore) ||
      minimumScore < 0 ||
      minimumScore > campaign.days.length
    ) {
      return c.json(
        { error: "Le score minimum doit être compris entre 0 et le total de la campagne." },
        422,
      );
    }
    const result = await adminClient()
      .from("found_aura_campaign_draw_settings")
      .upsert({
        campaign: campaign.id,
        minimum_score: minimumScore,
        facebook_submission_deadline: deadline,
        updated_by: admin.id,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (result.error) throw result.error;
    await adminClient()
      .from("found_aura_audit_logs")
      .insert({
        action: "draw_settings_updated",
        actor_user_id: admin.id,
        campaign: campaign.id,
        details: { minimumScore, facebookSubmissionDeadline: deadline },
      });
    return c.json({ settings: result.data });
  } catch (error) {
    return adminError(c, error);
  }
});

app.post("/make-server-acdaa784/admin/draw-snapshot", async (c) => {
  try {
    const admin = await authenticatedAdmin(c);
    const body = await c.req.json();
    const campaign = campaignFor(body.campaign);
    const reason = String(body.reason || "").trim();
    if (reason.length < 5) return c.json({ error: "Un motif de gel est obligatoire." }, 422);
    const draw = await calculateDescendingEligibility(campaign.id);
    if (!draw.campaignEnded)
      return c.json({ error: "La campagne n’est pas encore clôturée." }, 409);
    if (draw.minimumScore === null) {
      return c.json({ error: "Le score minimum officiel doit être configuré avant le gel." }, 422);
    }
    const previous = await adminClient()
      .from("found_aura_campaign_draw_snapshots")
      .select("id")
      .eq("campaign", campaign.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const snapshot = await adminClient()
      .from("found_aura_campaign_draw_snapshots")
      .insert({
        campaign: campaign.id,
        minimum_score: draw.minimumScore,
        threshold: draw.threshold,
        status: draw.status === "FINALIZED" ? "FINALIZED" : "NO_ELIGIBLE_PARTICIPANTS",
        eligible_participants: draw.eligibleParticipants,
        recalculation_of: previous.data?.id || null,
        reason,
        created_by: admin.id,
      })
      .select()
      .single();
    if (snapshot.error) throw snapshot.error;
    await adminClient()
      .from("found_aura_audit_logs")
      .insert({
        action: previous.data ? "draw_snapshot_recalculated" : "draw_snapshot_frozen",
        actor_user_id: admin.id,
        campaign: campaign.id,
        target_id: snapshot.data.id,
        details: { threshold: draw.threshold, eligibleCount: draw.eligibleCount, reason },
      });
    return c.json({ snapshot: snapshot.data, eligibility: draw });
  } catch (error) {
    return adminError(c, error);
  }
});

app.post("/make-server-acdaa784/admin/facebook-entry", async (c) => {
  try {
    const admin = await authenticatedAdmin(c);
    const body = await c.req.json();
    const campaign = campaignFor(body.campaign);
    const publicCode = String(body.publicCode || "").trim();
    const commentReference = String(body.commentReference || "").trim() || null;
    const notes = String(body.notes || "").trim() || null;
    const draw = await calculateDescendingEligibility(campaign.id);
    if (draw.status !== "FINALIZED") {
      return c.json(
        { error: "Le seuil officiel doit être finalisé avant toute vérification Facebook." },
        409,
      );
    }
    const candidate = draw.eligibleParticipants.find((p) => p.publicCode === publicCode);
    if (!candidate)
      return c.json({ error: "Ce code n’est pas qualifié selon le seuil officiel." }, 422);
    const result = await adminClient()
      .from("found_aura_facebook_draw_entries")
      .upsert(
        {
          campaign: campaign.id,
          participant_id: candidate.id,
          public_code: candidate.publicCode,
          comment_reference: commentReference,
          verified_at: new Date().toISOString(),
          verified_by: admin.id,
          verification_notes: notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "campaign,participant_id" },
      )
      .select()
      .single();
    if (result.error) throw result.error;
    await adminClient()
      .from("found_aura_audit_logs")
      .insert({
        action: "facebook_entry_verified",
        actor_user_id: admin.id,
        campaign: campaign.id,
        target_id: candidate.id,
        details: { publicCode: candidate.publicCode, commentReference },
      });
    return c.json({ entry: result.data });
  } catch (error) {
    return adminError(c, error);
  }
});

app.get("/make-server-acdaa784/admin/participants", async (c) => {
  try {
    await authenticatedAdmin(c);
    const campaignValue = c.req.query("campaign");
    const campaign = campaignValue ? campaignFor(campaignValue) : null;
    return c.json({ participants: await adminRows(campaign?.id) });
  } catch (error) {
    return adminError(c, error);
  }
});

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

app.get("/make-server-acdaa784/admin/participants.csv", async (c) => {
  try {
    await authenticatedAdmin(c);
    const campaignValue = c.req.query("campaign");
    const campaign = campaignValue ? campaignFor(campaignValue) : null;
    const rows = await adminRows(campaign?.id);
    const header = [
      "campaign",
      "full_name",
      "participation_code",
      "registered_at",
      "collected_days",
      "missed_days",
      "score",
      "eligible",
    ];
    const lines = [
      header.map(csvCell).join(","),
      ...rows.map((row) =>
        [
          row.campaign,
          row.fullName,
          row.participationCode,
          row.registeredAt,
          row.collectedDays.join("|"),
          row.missedDays.join("|"),
          row.score,
          row.eligible,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];
    return new Response(lines.join("\n"), {
      headers: {
        "Content-Disposition": 'attachment; filename="found-aura-participants.csv"',
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return adminError(c, error);
  }
});

app.get("/make-server-acdaa784/admin/recovery-requests", async (c) => {
  try {
    await authenticatedAdmin(c);
    const campaignValue = c.req.query("campaign");
    const campaign = campaignValue ? campaignFor(campaignValue) : null;
    const statusFilter = c.req.query("status");

    const supabase = adminClient();
    let query = supabase
      .from("found_aura_recovery_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (campaign) query = query.eq("campaign", campaign.id);
    if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
      query = query.eq("status", statusFilter);
    }

    const { data: requests, error } = await query;
    if (error) throw error;

    const enriched = await Promise.all(
      (requests || []).map(async (req: any) => {
        let matchedParticipant: any = null;
        if (req.matched_participant_id) {
          const { data: p } = await supabase
            .from("found_aura_campaign_participants")
            .select("*")
            .eq("id", req.matched_participant_id)
            .maybeSingle();
          if (p) {
            const status = await statusFor(p);
            matchedParticipant = {
              id: p.id,
              fullName: p.full_name,
              contact: p.contact,
              publicCode: p.public_code,
              registeredAt: p.registered_at,
              collectionCount: status.summary.collectedCount,
              score: status.summary.score,
            };
          }
        }
        return {
          id: req.id,
          campaign: req.campaign,
          fullName: req.full_name,
          contact: req.contact,
          normalizedContact: req.normalized_contact,
          explanation: req.explanation,
          status: req.status,
          matchedParticipantId: req.matched_participant_id,
          matchedParticipant,
          adminNotes: req.admin_notes,
          reviewedBy: req.reviewed_by,
          reviewedAt: req.reviewed_at,
          createdAt: req.created_at,
        };
      }),
    );

    return c.json({ requests: enriched });
  } catch (error) {
    return adminError(c, error);
  }
});

app.post("/make-server-acdaa784/admin/recovery-requests/:id/review", async (c) => {
  try {
    const adminUser = await authenticatedAdmin(c);
    const requestId = c.req.param("id");
    const body = await c.req.json();
    const action = body.action;
    const adminNotes = String(body.adminNotes || "").trim();

    if (action !== "approve" && action !== "reject") {
      return c.json({ error: "Action invalide (doit être 'approve' ou 'reject')." }, 422);
    }
    if (adminNotes.length < 3) {
      return c.json({ error: "Une justification administrateur est obligatoire." }, 422);
    }

    const supabase = adminClient();
    const { data: request, error: reqError } = await supabase
      .from("found_aura_recovery_requests")
      .select("*")
      .eq("id", requestId)
      .single();
    if (reqError || !request) return c.json({ error: "Demande introuvable." }, 404);

    if (action === "reject") {
      await supabase
        .from("found_aura_recovery_requests")
        .update({
          status: "rejected",
          admin_notes: adminNotes,
          reviewed_by: adminUser.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      await supabase.from("found_aura_audit_logs").insert({
        action: "recovery_rejected",
        actor_user_id: adminUser.id,
        target_id: requestId,
        campaign: request.campaign,
        details: { requestId, adminNotes },
      });

      return c.json({ success: true, status: "rejected" });
    }

    // Approve
    const targetParticipantId = body.participantId || request.matched_participant_id;
    if (!targetParticipantId) {
      return c.json(
        { error: "Aucun compte participant n’est associé à cette demande pour la validation." },
        422,
      );
    }

    const { data: participant, error: pError } = await supabase
      .from("found_aura_campaign_participants")
      .select("*")
      .eq("id", targetParticipantId)
      .single();
    if (pError || !participant) {
      return c.json({ error: "Participant cible introuvable." }, 404);
    }
    if (participant.campaign !== request.campaign) {
      return c.json({ error: "La campagne du participant ne correspond pas à la demande." }, 422);
    }

    // Generate new recovery token and hash
    const replacementToken = randomToken();
    const replacementHash = await tokenHash(replacementToken);

    // Update participant: preserve ID, public code, registration date, collections
    const { error: updateError } = await supabase
      .from("found_aura_campaign_participants")
      .update({
        recovery_token_hash: replacementHash,
        recovery_rotated_at: new Date().toISOString(),
      })
      .eq("id", participant.id);
    if (updateError) throw updateError;

    // Revoke all prior active sessions for this participant
    await supabase
      .from("found_aura_participant_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("participant_id", participant.id)
      .is("revoked_at", null);

    // Update recovery request record
    await supabase
      .from("found_aura_recovery_requests")
      .update({
        status: "approved",
        matched_participant_id: participant.id,
        replacement_token_hash: replacementHash,
        admin_notes: adminNotes,
        reviewed_by: adminUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    // Audit log entry
    await supabase.from("found_aura_audit_logs").insert({
      action: "recovery_approved",
      actor_user_id: adminUser.id,
      target_id: participant.id,
      campaign: participant.campaign,
      details: {
        requestId,
        participantId: participant.id,
        publicCode: participant.public_code,
        adminNotes,
      },
    });

    const recoveryLink = `${PUBLIC_ORIGIN}/?campaign=${participant.campaign}&recovery=${replacementToken}`;

    return c.json({
      success: true,
      status: "approved",
      recoveryToken: replacementToken,
      recoveryLink,
      participant: {
        id: participant.id,
        fullName: participant.full_name,
        publicCode: participant.public_code,
      },
    });
  } catch (error) {
    return adminError(c, error);
  }
});

app.get("/make-server-acdaa784/admin/duplicates", async (c) => {
  try {
    await authenticatedAdmin(c);
    const campaignValue = c.req.query("campaign");
    const campaign = campaignValue ? campaignFor(campaignValue) : null;

    const supabase = adminClient();
    let query = supabase
      .from("found_aura_campaign_participants")
      .select("*")
      .neq("status", "merged")
      .order("registered_at");
    if (campaign) query = query.eq("campaign", campaign.id);

    const { data: participants, error } = await query;
    if (error) throw error;

    let collectionsQuery = supabase
      .from("found_aura_campaign_collections")
      .select("participant_id, collection_date, campaign");
    if (campaign) collectionsQuery = collectionsQuery.eq("campaign", campaign.id);
    const { data: allCollections } = await collectionsQuery;

    const collectionsByParticipant: Record<string, string[]> = {};
    (allCollections || []).forEach((col: any) => {
      if (!collectionsByParticipant[col.participant_id]) {
        collectionsByParticipant[col.participant_id] = [];
      }
      collectionsByParticipant[col.participant_id].push(col.collection_date);
    });

    const groupsMap = new Map<string, any[]>();
    (participants || []).forEach((p: any) => {
      const norm =
        normalizeContact(p.contact) ||
        (p.normalized_contact ? normalizeContact(p.normalized_contact) : null);
      if (norm) {
        const key = `${p.campaign}:${norm}`;
        if (!groupsMap.has(key)) groupsMap.set(key, []);
        groupsMap.get(key)!.push(p);
      }
    });

    const duplicateGroups: any[] = [];
    for (const [key, members] of groupsMap.entries()) {
      if (members.length > 1) {
        const [campaignId, normContact] = key.split(":");
        const campaignObj = campaignFor(campaignId);

        const groupParticipants = members.map((p) => {
          const days = collectionsByParticipant[p.id] || [];
          return {
            id: p.id,
            campaign: p.campaign,
            fullName: p.full_name,
            contact: p.contact,
            publicCode: p.public_code,
            registeredAt: p.registered_at,
            status: p.status || "active",
            collectedDays: days,
            score: `${days.length}/${campaignObj.days.length}`,
            eligible: campaignObj.days.every((d) => days.includes(d)),
          };
        });

        const dateOccurrences: Record<string, number> = {};
        groupParticipants.forEach((p) => {
          p.collectedDays.forEach((d: string) => {
            dateOccurrences[d] = (dateOccurrences[d] || 0) + 1;
          });
        });

        const overlappingDays = Object.keys(dateOccurrences).filter((d) => dateOccurrences[d] > 1);
        const combinedUniqueDays = Object.keys(dateOccurrences);
        const beforeEligible = groupParticipants.some((p) => p.eligible);
        const afterEligible = campaignObj.days.every((d) => combinedUniqueDays.includes(d));

        duplicateGroups.push({
          key,
          normalizedContact: normContact,
          participants: groupParticipants,
          overlappingDays,
          combinedUniqueDays,
          eligibilityImpact: {
            beforeEligible,
            afterEligible,
            increasedScore:
              combinedUniqueDays.length >
              Math.max(...groupParticipants.map((p) => p.collectedDays.length)),
          },
        });
      }
    }

    let backupQuery = supabase
      .from("found_aura_participant_merge_backups")
      .select("*")
      .order("merged_at", { ascending: false })
      .limit(20);
    if (campaign) backupQuery = backupQuery.eq("campaign", campaign.id);
    const { data: mergeHistory } = await backupQuery;

    return c.json({
      duplicateGroups,
      mergeHistory: (mergeHistory || []).map((b: any) => ({
        id: b.id,
        campaign: b.campaign,
        targetParticipantId: b.target_participant_id,
        sourceParticipantId: b.source_participant_id,
        retainedPublicCode: b.retained_public_code,
        retiredPublicCode: b.retired_public_code,
        overlappingDays: b.overlapping_days || [],
        mergedDays: b.merged_days || [],
        adminNotes: b.admin_notes,
        mergedAt: b.merged_at,
      })),
    });
  } catch (error) {
    return adminError(c, error);
  }
});

app.post("/make-server-acdaa784/admin/merge-participants", async (c) => {
  try {
    const adminUser = await authenticatedAdmin(c);
    const body = await c.req.json();
    const primaryId = String(body.primaryParticipantId || "").trim();
    const duplicateId = String(body.duplicateParticipantId || "").trim();
    const adminNotes = String(body.adminNotes || "").trim();

    if (!primaryId || !duplicateId || primaryId === duplicateId) {
      return c.json({ error: "Deux identifiants de participants distincts sont requis." }, 422);
    }
    if (adminNotes.length < 5) {
      return c.json(
        {
          error:
            "Une justification administrative détaillée est obligatoire pour valider la fusion.",
        },
        422,
      );
    }

    const supabase = adminClient();
    const [targetRes, sourceRes] = await Promise.all([
      supabase.from("found_aura_campaign_participants").select("*").eq("id", primaryId).single(),
      supabase.from("found_aura_campaign_participants").select("*").eq("id", duplicateId).single(),
    ]);

    if (targetRes.error || !targetRes.data || sourceRes.error || !sourceRes.data) {
      return c.json({ error: "L'un des comptes participants spécifiés est introuvable." }, 404);
    }

    const target = targetRes.data;
    const source = sourceRes.data;

    // Strict requirement: Never merge beta and December records
    if (target.campaign !== source.campaign) {
      return c.json(
        {
          error:
            "Fusion interdite : les enregistrements de la bêta et de décembre ne peuvent pas être fusionnés.",
        },
        422,
      );
    }

    if (target.status === "merged" || source.status === "merged") {
      return c.json({ error: "L'un des comptes a déjà été fusionné." }, 422);
    }

    const [targetCols, sourceCols] = await Promise.all([
      supabase
        .from("found_aura_campaign_collections")
        .select("*")
        .eq("participant_id", target.id)
        .eq("campaign", target.campaign),
      supabase
        .from("found_aura_campaign_collections")
        .select("*")
        .eq("participant_id", source.id)
        .eq("campaign", source.campaign),
    ]);

    const targetDates = new Set((targetCols.data || []).map((col: any) => col.collection_date));
    const sourceDates = new Set((sourceCols.data || []).map((col: any) => col.collection_date));

    const overlappingDays = [...sourceDates].filter((d) => targetDates.has(d));
    const mergedDays = [...sourceDates].filter((d) => !targetDates.has(d));

    // 1. Back up affected records into merge backups table
    const { data: backup, error: backupError } = await supabase
      .from("found_aura_participant_merge_backups")
      .insert({
        campaign: target.campaign,
        target_participant_id: target.id,
        source_participant_id: source.id,
        retained_public_code: target.public_code,
        retired_public_code: source.public_code,
        target_snapshot: target,
        source_snapshot: source,
        source_collections_snapshot: sourceCols.data || [],
        overlapping_days: overlappingDays,
        merged_days: mergedDays,
        admin_user_id: adminUser.id,
        admin_notes: adminNotes,
      })
      .select()
      .single();

    if (backupError) throw backupError;

    // 2. Transfer non-overlapping collections to target participant
    for (const date of mergedDays) {
      await supabase.from("found_aura_campaign_collections").upsert(
        {
          participant_id: target.id,
          campaign: target.campaign,
          collection_date: date,
        },
        { onConflict: "participant_id,campaign,collection_date", ignoreDuplicates: true },
      );
    }

    // 3. Update duplicate record status to 'merged'
    await supabase
      .from("found_aura_campaign_participants")
      .update({
        status: "merged",
        merged_into_id: target.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", source.id);

    // 4. Revoke active sessions for duplicate participant
    await supabase
      .from("found_aura_participant_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("participant_id", source.id)
      .is("revoked_at", null);

    // 5. Audit log
    await supabase.from("found_aura_audit_logs").insert({
      action: "participant_merged",
      actor_user_id: adminUser.id,
      target_id: target.id,
      campaign: target.campaign,
      details: {
        backupId: backup.id,
        targetId: target.id,
        sourceId: source.id,
        retainedPublicCode: target.public_code,
        retiredPublicCode: source.public_code,
        overlappingDays,
        mergedDays,
        adminNotes,
      },
    });

    return c.json({
      success: true,
      backupId: backup.id,
      retainedPublicCode: target.public_code,
      retiredPublicCode: source.public_code,
      overlappingDays,
      mergedDays,
    });
  } catch (error) {
    return adminError(c, error);
  }
});

Deno.serve(app.fetch);
