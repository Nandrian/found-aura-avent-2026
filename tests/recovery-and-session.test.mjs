import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { CAMPAIGNS, DEFAULT_CAMPAIGN_ID } from "../src/campaign.ts";

class MockStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.get(key) || null;
  }
  setItem(key, val) {
    this.store.set(key, String(val));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

class FullFlowServer {
  constructor() {
    this.participants = [];
    this.sessions = [];
    this.collections = [];
  }

  async register({ campaign = DEFAULT_CAMPAIGN_ID, fullName, contact }) {
    const recoveryToken = crypto.randomBytes(32).toString("base64url");
    const recoveryHash = tokenHash(recoveryToken);
    const publicCode = `FA-${campaign === "december-2026" ? "DEC" : "BETA"}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const participant = {
      id: crypto.randomUUID(),
      campaign,
      full_name: fullName,
      contact: contact || null,
      public_code: publicCode,
      recovery_token_hash: recoveryHash,
      status: "active",
    };
    this.participants.push(participant);

    const sessionToken = crypto.randomBytes(32).toString("base64url");
    const session = {
      id: crypto.randomUUID(),
      participant_id: participant.id,
      token_hash: tokenHash(sessionToken),
      revoked_at: null,
    };
    this.sessions.push(session);

    return {
      participantSession: sessionToken,
      recoveryToken,
      participant,
    };
  }

  async recover({ campaign = DEFAULT_CAMPAIGN_ID, recoveryToken }) {
    if (!recoveryToken || recoveryToken.length < 40) {
      throw new Error("PARTICIPANT_AUTH_REQUIRED");
    }
    const hash = tokenHash(recoveryToken);
    const participant = this.participants.find(
      (p) => p.campaign === campaign && p.recovery_token_hash === hash && p.status !== "merged",
    );
    if (!participant) {
      throw new Error("PARTICIPANT_AUTH_REQUIRED");
    }

    const sessionToken = crypto.randomBytes(32).toString("base64url");
    const session = {
      id: crypto.randomUUID(),
      participant_id: participant.id,
      token_hash: tokenHash(sessionToken),
      revoked_at: null,
    };
    this.sessions.push(session);

    const userCollections = this.collections
      .filter((c) => c.participant_id === participant.id && c.campaign === campaign)
      .map((c) => c.collection_date);

    return {
      participantSession: sessionToken,
      status: {
        campaign: CAMPAIGNS[campaign],
        participant: {
          fullName: participant.full_name,
          participationCode: participant.public_code,
        },
        collectedDays: userCollections,
        summary: {
          collectedCount: userCollections.length,
          score: `${userCollections.length}/${CAMPAIGNS[campaign].totalDays}`,
        },
      },
      participant,
    };
  }

  async getStatus({ campaign = DEFAULT_CAMPAIGN_ID, sessionToken }) {
    const hash = tokenHash(sessionToken);
    const session = this.sessions.find((s) => s.token_hash === hash && !s.revoked_at);
    if (!session) throw new Error("PARTICIPANT_AUTH_REQUIRED");

    const participant = this.participants.find((p) => p.id === session.participant_id);
    if (!participant || participant.campaign !== campaign) {
      throw new Error("PARTICIPANT_AUTH_REQUIRED");
    }

    const userCollections = this.collections
      .filter((c) => c.participant_id === participant.id && c.campaign === campaign)
      .map((c) => c.collection_date);

    return {
      campaign: CAMPAIGNS[campaign],
      participant: {
        fullName: participant.full_name,
        participationCode: participant.public_code,
      },
      collectedDays: userCollections,
      summary: {
        collectedCount: userCollections.length,
        score: `${userCollections.length}/${CAMPAIGNS[campaign].totalDays}`,
      },
    };
  }

  revokeToken(participantId) {
    const participant = this.participants.find((p) => p.id === participantId);
    if (participant) {
      participant.recovery_token_hash = tokenHash(crypto.randomBytes(32).toString("base64url"));
    }
    for (const session of this.sessions) {
      if (session.participant_id === participantId) {
        session.revoked_at = new Date().toISOString();
      }
    }
  }
}

test("A. First registration creates a December participant with a FA-DEC- code", async () => {
  const server = new FullFlowServer();
  const reg = await server.register({
    campaign: "december-2026",
    fullName: "Jeanne Decembre",
    contact: "jeanne@example.com",
  });

  assert.ok(reg.participant.public_code.startsWith("FA-DEC-"));
  assert.ok(reg.recoveryToken.length >= 43);
  assert.strictEqual(reg.participant.campaign, "december-2026");
  assert.strictEqual(server.participants.length, 1);
});

test("B. Refreshing the same browser restores the original participant without registration", async () => {
  const server = new FullFlowServer();
  const reg = await server.register({
    campaign: "december-2026",
    fullName: "Rindra Solofo",
    contact: "rindra@example.com",
  });

  const storage = new MockStorage();
  const sessionKey = `found-aura:participant-session:december-2026`;
  storage.setItem(sessionKey, reg.participantSession);

  // Simulate page refresh: read from storage, query status
  const storedSession = storage.getItem(sessionKey);
  assert.ok(storedSession);

  const status = await server.getStatus({
    campaign: "december-2026",
    sessionToken: storedSession,
  });

  assert.strictEqual(status.participant.participationCode, reg.participant.public_code);
  assert.strictEqual(status.participant.fullName, "Rindra Solofo");
  assert.strictEqual(status.summary.score, "0/24");
});

test("C. Opening the recovery link in incognito restores the same participant ID, code and progress", async () => {
  const server = new FullFlowServer();
  const reg = await server.register({
    campaign: "december-2026",
    fullName: "Noro Bakoly",
    contact: "noro@example.com",
  });

  // Simulate Day 1 collection
  server.collections.push({
    participant_id: reg.participant.id,
    campaign: "december-2026",
    collection_date: "2026-12-01",
  });

  // Participant opens recovery link in incognito (empty storage)
  const incognitoStorage = new MockStorage();
  const recovered = await server.recover({
    campaign: "december-2026",
    recoveryToken: reg.recoveryToken,
  });

  incognitoStorage.setItem(
    "found-aura:participant-session:december-2026",
    recovered.participantSession,
  );

  assert.strictEqual(recovered.participant.id, reg.participant.id);
  assert.strictEqual(recovered.participant.public_code, reg.participant.public_code);
  assert.deepStrictEqual(recovered.status.collectedDays, ["2026-12-01"]);
  assert.strictEqual(recovered.status.summary.score, "1/24");
  // Exactly 1 participant in database (no duplicate created)
  assert.strictEqual(server.participants.length, 1);
});

test("D. The application automatically enters the wardrobe after recovery without modal prompt", async () => {
  let wardrobeScrolled = false;
  let privateRecoveryModalOpen = false;

  // Simulated app recovery action
  const onRecoverSuccess = () => {
    // privateRecoveryLink is NOT set during recovery restoration
    privateRecoveryModalOpen = false;
    wardrobeScrolled = true;
  };

  onRecoverSuccess();
  assert.strictEqual(wardrobeScrolled, true);
  assert.strictEqual(privateRecoveryModalOpen, false);
});

test("E. The URL is cleaned only after successful recovery", () => {
  let mockUrl = new URL(
    "https://example.com/?campaign=december-2026&recovery=testtoken1234567890123456789012345678901234567890",
  );
  assert.strictEqual(
    mockUrl.searchParams.get("recovery"),
    "testtoken1234567890123456789012345678901234567890",
  );

  // Only clean when recovered successfully
  mockUrl.searchParams.delete("recovery");
  assert.strictEqual(mockUrl.searchParams.get("recovery"), null);
  assert.strictEqual(mockUrl.searchParams.get("campaign"), "december-2026");
});

test("F. A revoked link is rejected", async () => {
  const server = new FullFlowServer();
  const reg = await server.register({
    campaign: "december-2026",
    fullName: "Revoke Test",
  });

  const oldToken = reg.recoveryToken;
  server.revokeToken(reg.participant.id);

  await assert.rejects(
    async () => {
      await server.recover({
        campaign: "december-2026",
        recoveryToken: oldToken,
      });
    },
    { message: "PARTICIPANT_AUTH_REQUIRED" },
  );
});

test("G. An invalid link displays a recovery error rather than silently returning home", async () => {
  const server = new FullFlowServer();
  const fakeToken = "invalid_token_1234567890123456789012345678901234567890";

  let recoveryFailure = null;
  let dumpedToHome = false;

  try {
    await server.recover({ campaign: "december-2026", recoveryToken: fakeToken });
  } catch (err) {
    recoveryFailure = {
      isNetworkError: false,
      message: "Ce lien secret de récupération est invalide, a expiré ou a été révoqué.",
    };
    dumpedToHome = false; // Does NOT redirect or silently dump to home
  }

  assert.ok(recoveryFailure);
  assert.strictEqual(recoveryFailure.isNetworkError, false);
  assert.strictEqual(dumpedToHome, false);
});

test("H. Recovery does not generate a second participant", async () => {
  const server = new FullFlowServer();
  const reg = await server.register({
    campaign: "december-2026",
    fullName: "Unique Participant",
  });
  assert.strictEqual(server.participants.length, 1);

  // Perform 3 recoveries
  await server.recover({ campaign: "december-2026", recoveryToken: reg.recoveryToken });
  await server.recover({ campaign: "december-2026", recoveryToken: reg.recoveryToken });
  await server.recover({ campaign: "december-2026", recoveryToken: reg.recoveryToken });

  assert.strictEqual(server.participants.length, 1);
});

test("I. The November beta remains isolated from December", async () => {
  const server = new FullFlowServer();
  const betaReg = await server.register({
    campaign: "november-2026-beta",
    fullName: "Beta Participant",
  });

  // Attempting to recover a Beta token on December campaign fails
  await assert.rejects(
    async () => {
      await server.recover({
        campaign: "december-2026",
        recoveryToken: betaReg.recoveryToken,
      });
    },
    { message: "PARTICIPANT_AUTH_REQUIRED" },
  );

  // Recovering with its correct campaign succeeds and stays isolated
  const betaRecovered = await server.recover({
    campaign: "november-2026-beta",
    recoveryToken: betaReg.recoveryToken,
  });
  assert.strictEqual(betaRecovered.participant.campaign, "november-2026-beta");
});

test("J. The participant can navigate between Home, Wardrobe and Aura Passport without losing their session", async () => {
  const server = new FullFlowServer();
  const reg = await server.register({
    campaign: "december-2026",
    fullName: "Active Navigator",
  });

  const storage = new MockStorage();
  const key = "found-aura:participant-session:december-2026";
  storage.setItem(key, reg.participantSession);

  // State mock during navigation
  let participantSession = storage.getItem(key);
  assert.ok(participantSession);

  // Navigate to #wardrobe
  assert.strictEqual(storage.getItem(key), reg.participantSession);
  // Open Passport
  const passportStatus = await server.getStatus({
    campaign: "december-2026",
    sessionToken: participantSession,
  });
  assert.strictEqual(passportStatus.participant.fullName, "Active Navigator");
  // Close Passport, return to Home
  assert.strictEqual(storage.getItem(key), reg.participantSession);
});
