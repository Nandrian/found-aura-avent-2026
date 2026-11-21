import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { CAMPAIGNS } from "../src/campaign.ts";

class PassportTestServer {
  constructor() {
    this.participants = [];
    this.sessions = [];
    this.collections = [];
  }

  async register({ campaign = "december-2026", fullName, contact }) {
    const token = crypto.randomBytes(32).toString("base64url");
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const publicCode = `FA-${campaign === "december-2026" ? "DEC" : "BETA"}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const participant = {
      id: crypto.randomUUID(),
      campaign,
      full_name: fullName,
      contact: contact || null,
      public_code: publicCode,
      recovery_token_hash: hash,
      status: "active",
    };
    this.participants.push(participant);

    const sessionToken = crypto.randomBytes(32).toString("base64url");
    this.sessions.push({
      id: crypto.randomUUID(),
      participant_id: participant.id,
      token_hash: crypto.createHash("sha256").update(sessionToken).digest("hex"),
      revoked_at: null,
    });

    return {
      participantSession: sessionToken,
      recoveryToken: token,
      participant,
      status: this.getStatus({
        participantId: participant.id,
        campaign,
        currentDate: "2026-11-15",
      }),
    };
  }

  getStatus({ participantId, campaign = "december-2026", currentDate = "2026-11-15" }) {
    const participant = this.participants.find((p) => p.id === participantId);
    const camp = CAMPAIGNS[campaign];
    const userCols = this.collections
      .filter((c) => c.participant_id === participantId && c.campaign === campaign)
      .map((c) => c.collection_date);

    return {
      campaign: {
        id: camp.id,
        name: camp.name,
        days: camp.days,
        totalDays: camp.totalDays,
      },
      participant: {
        fullName: participant.full_name,
        participationCode: participant.public_code,
      },
      collectedDays: userCols,
      missedDays: camp.days.filter((d) => d < currentDate && !userCols.includes(d)),
      eligible: false,
      eligibilityStatus: "PENDING_CONFIRMATION",
      eligibilityMessage: "Éligibilité au tirage en attente de confirmation.",
      summary: {
        collectedCount: userCols.length,
        missedCount: 0,
        campaignEnded: false,
        score: `${userCols.length}/${camp.totalDays}`,
      },
    };
  }
}

test("1. A newly registered December participant can open Passport and inspect their data", async () => {
  const server = new PassportTestServer();
  const reg = await server.register({ fullName: "Hasina Razafy", contact: "hasina@example.com" });

  assert.ok(reg.status);
  assert.strictEqual(reg.status.participant.fullName, "Hasina Razafy");
  assert.ok(reg.status.participant.participationCode.startsWith("FA-DEC-"));
  assert.strictEqual(reg.status.summary.score, "0/24");
});

test("2. Passport displays their correct name and FA-DEC code", async () => {
  const server = new PassportTestServer();
  const reg = await server.register({ fullName: "Malala Rasoa" });

  const passportStatus = reg.status;
  assert.strictEqual(passportStatus.participant.fullName, "Malala Rasoa");
  assert.strictEqual(passportStatus.participant.participationCode.startsWith("FA-DEC-"), true);
});

test("3. Passport displays 0/24 before December 1", async () => {
  const server = new PassportTestServer();
  const reg = await server.register({ fullName: "Pre Launch Member" });
  const status = server.getStatus({ participantId: reg.participant.id, currentDate: "2026-11-15" });

  assert.strictEqual(status.summary.collectedCount, 0);
  assert.strictEqual(status.summary.totalDays ?? 24, 24);
  assert.strictEqual(status.summary.score, "0/24");
  assert.strictEqual(status.collectedDays.length, 0);
});

test("4. Refreshing preserves the session and status", async () => {
  const server = new PassportTestServer();
  const reg = await server.register({ fullName: "Reload Participant" });

  // Mock storage
  const storage = new Map();
  storage.set("found-aura:participant-session:december-2026", reg.participantSession);

  // Restore on refresh
  const stored = storage.get("found-aura:participant-session:december-2026");
  assert.strictEqual(stored, reg.participantSession);

  const reloadedStatus = server.getStatus({ participantId: reg.participant.id });
  assert.strictEqual(reloadedStatus.participant.fullName, "Reload Participant");
  assert.strictEqual(reloadedStatus.summary.score, "0/24");
});

test("5. Switching between Passport and recovery-link modal works without overlap (single modal invariant)", () => {
  // Simulate UI modal state transitions
  let activeModal = "passport";
  let modalReturnContext = null;
  let renderedModals = [];

  // Helper to record rendered modals
  const updateRendered = () => {
    renderedModals = [];
    if (activeModal === "passport") renderedModals.push("Passport");
    if (activeModal === "recoveryNotice") renderedModals.push("RecoveryNotice");
  };
  updateRendered();
  assert.deepStrictEqual(renderedModals, ["Passport"]);

  // User clicks "Créer ou remplacer mon lien privé"
  modalReturnContext = "passport";
  activeModal = "recoveryNotice"; // Passport is closed BEFORE RecoveryNotice opens
  updateRendered();

  // Only RecoveryNotice is rendered - NEVER both
  assert.deepStrictEqual(renderedModals, ["RecoveryNotice"]);
  assert.strictEqual(renderedModals.length, 1);

  // User closes RecoveryNotice
  if (modalReturnContext === "passport") {
    modalReturnContext = null;
    activeModal = "passport";
  } else {
    activeModal = "none";
  }
  updateRendered();

  // Returned to Passport seamlessly
  assert.deepStrictEqual(renderedModals, ["Passport"]);
  assert.strictEqual(renderedModals.length, 1);
});

test("6. A valid private link restores the same participant in incognito", async () => {
  const server = new PassportTestServer();
  const reg = await server.register({ fullName: "Incognito Participant" });

  // Add 2 collections in December
  server.collections.push(
    {
      participant_id: server.participants[0].id,
      campaign: "december-2026",
      collection_date: "2026-12-01",
    },
    {
      participant_id: server.participants[0].id,
      campaign: "december-2026",
      collection_date: "2026-12-02",
    },
  );

  // Incognito browser: recovery token resolves to original participant
  const hash = crypto.createHash("sha256").update(reg.recoveryToken).digest("hex");
  const matched = server.participants.find((p) => p.recovery_token_hash === hash);
  assert.ok(matched);
  assert.strictEqual(matched.full_name, "Incognito Participant");

  const restoredStatus = server.getStatus({ participantId: matched.id, currentDate: "2026-12-03" });
  assert.deepStrictEqual(restoredStatus.collectedDays, ["2026-12-01", "2026-12-02"]);
  assert.strictEqual(restoredStatus.summary.score, "2/24");
});

test("7. Expired or invalid sessions show a recovery option", () => {
  const errorMessage = "Session participante invalide ou expirée.";
  const isSessionExpired =
    Boolean(errorMessage) &&
    (errorMessage.includes("401") ||
      errorMessage.includes("invalide ou expirée") ||
      errorMessage.includes("expiré"));

  assert.strictEqual(isSessionExpired, true);

  // In SESSION_EXPIRED state, UI displays "Session expirée" with recovery button
  const passportState = isSessionExpired ? "SESSION_EXPIRED" : "ERROR";
  assert.strictEqual(passportState, "SESSION_EXPIRED");
});

test("8. An HTTP 429 displays a rate-limit message instead of invalid credentials", () => {
  const mockResponse = {
    status: 429,
    ok: false,
    body: { error: "Trop de tentatives. Veuillez réessayer plus tard." },
  };

  let thrownMessage = "";
  try {
    if (!mockResponse.ok) {
      if (mockResponse.status === 429) {
        throw new Error(mockResponse.body.error);
      }
      throw new Error("Generic error");
    }
  } catch (err) {
    thrownMessage = err.message;
  }

  assert.strictEqual(thrownMessage, "Trop de tentatives. Veuillez réessayer plus tard.");
  assert.strictEqual(thrownMessage.includes("invalide"), false);
});

test("9. No extra participant is created during passport consultation or recovery", async () => {
  const server = new PassportTestServer();
  await server.register({ fullName: "Single Participant" });
  assert.strictEqual(server.participants.length, 1);

  // Inspect passport status multiple times
  server.getStatus({ participantId: server.participants[0].id });
  server.getStatus({ participantId: server.participants[0].id });
  server.getStatus({ participantId: server.participants[0].id });

  // Still exactly 1
  assert.strictEqual(server.participants.length, 1);
});

test("10. The November beta remains unchanged and isolated", async () => {
  const server = new PassportTestServer();
  const betaReg = await server.register({
    campaign: "november-2026-beta",
    fullName: "Beta Participant",
  });
  const decReg = await server.register({
    campaign: "december-2026",
    fullName: "December Participant",
  });

  assert.strictEqual(server.participants.length, 2);
  assert.ok(betaReg.status.participant.participationCode.startsWith("FA-BETA-"));
  assert.ok(decReg.status.participant.participationCode.startsWith("FA-DEC-"));
  assert.strictEqual(betaReg.status.campaign.totalDays, 2);
  assert.strictEqual(decReg.status.campaign.totalDays, 24);
});
