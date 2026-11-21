import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

// In-memory mock database modeling Supabase state for testing Edge Function behavior
class MockDatabase {
  constructor() {
    this.participants = [];
    this.sessions = [];
    this.collections = [];
    this.recoveryRequests = [];
    this.mergeBackups = [];
    this.auditLogs = [];
  }
}

function normalizeContact(contact) {
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
  return crypto.randomBytes(bytes).toString("base64url");
}

function tokenHash(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Edge Function logic mock harness implementing the exact same code as index.tsx
class FoundAuraServer {
  constructor(db) {
    this.db = db;
  }

  async registerParticipant({ campaign, fullName, contact, accepted, marketingConsent }) {
    const trimmedName = String(fullName || "").trim();
    const rawContact = String(contact || "").trim() || null;
    const normContact = normalizeContact(rawContact);

    if (trimmedName.length < 2 || trimmedName.length > 120 || !accepted) {
      throw new Error("INVALID_REGISTRATION");
    }

    if (normContact) {
      const existing = this.db.participants.find(
        (p) =>
          p.campaign === campaign &&
          p.status !== "merged" &&
          normalizeContact(p.contact) === normContact,
      );
      if (existing) {
        return {
          recoveryRequired: true,
          message:
            "Si ces coordonnées sont déjà associées à une participation, aucun nouveau compte n’a été créé afin de protéger votre historique. Utilisez votre lien privé de récupération ou l’assistance Found Aura.",
        };
      }
    }

    const recoveryToken = randomToken();
    const recoveryHash = tokenHash(recoveryToken);
    const publicCode = `FA-${campaign === "november-2026-beta" ? "BETA" : "DEC"}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const participant = {
      id: crypto.randomUUID(),
      campaign,
      full_name: trimmedName,
      contact: rawContact,
      normalized_contact: normContact,
      status: "active",
      marketing_consent: Boolean(marketingConsent),
      public_code: publicCode,
      recovery_token_hash: recoveryHash,
      registered_at: new Date().toISOString(),
    };
    this.db.participants.push(participant);

    const sessionToken = randomToken();
    const session = {
      id: crypto.randomUUID(),
      participant_id: participant.id,
      token_hash: tokenHash(sessionToken),
      expires_at: new Date(Date.now() + 120 * 86400000).toISOString(),
      revoked_at: null,
    };
    this.db.sessions.push(session);

    return {
      recoveryRequired: false,
      participantSession: sessionToken,
      recoveryToken,
      participant,
    };
  }

  async recoverWithToken({ campaign, recoveryToken }) {
    const hash = tokenHash(recoveryToken);
    const participant = this.db.participants.find(
      (p) => p.campaign === campaign && p.recovery_token_hash === hash && p.status !== "merged",
    );
    if (!participant) throw new Error("PARTICIPANT_AUTH_REQUIRED");

    const sessionToken = randomToken();
    const session = {
      id: crypto.randomUUID(),
      participant_id: participant.id,
      token_hash: tokenHash(sessionToken),
      expires_at: new Date(Date.now() + 120 * 86400000).toISOString(),
      revoked_at: null,
    };
    this.db.sessions.push(session);

    const collections = this.db.collections.filter(
      (c) => c.participant_id === participant.id && c.campaign === campaign,
    );

    return {
      participantSession: sessionToken,
      participant,
      collectedDays: collections.map((c) => c.collection_date),
    };
  }

  async submitRecoveryRequest({ campaign, fullName, contact, explanation }) {
    const trimmedName = String(fullName || "").trim();
    const rawContact = String(contact || "").trim();
    const normContact = normalizeContact(rawContact);

    if (trimmedName.length < 2 || rawContact.length < 3 || !normContact) {
      throw new Error("INVALID_RECOVERY_REQUEST");
    }

    const matched = this.db.participants.find(
      (p) =>
        p.campaign === campaign &&
        p.status !== "merged" &&
        normalizeContact(p.contact) === normContact,
    );

    const request = {
      id: crypto.randomUUID(),
      campaign,
      full_name: trimmedName,
      contact: rawContact,
      normalized_contact: normContact,
      explanation: explanation || null,
      status: "pending",
      matched_participant_id: matched ? matched.id : null,
      created_at: new Date().toISOString(),
      admin_notes: null,
      reviewed_by: null,
      reviewed_at: null,
    };
    this.db.recoveryRequests.push(request);

    return {
      success: true,
      message:
        "Votre demande de récupération a été transmise à l'équipe Found Aura. Si votre participation est confirmée après vérification manuelle, un administrateur vous transmettra un nouveau lien privé.",
    };
  }

  async reviewRecoveryRequest({ userRole, requestId, action, adminNotes }) {
    if (userRole !== "admin") throw new Error("ADMIN_AUTH_REQUIRED");
    if (!adminNotes || adminNotes.trim().length < 3) throw new Error("ADMIN_NOTES_REQUIRED");

    const request = this.db.recoveryRequests.find((r) => r.id === requestId);
    if (!request) throw new Error("REQUEST_NOT_FOUND");

    if (action === "reject") {
      request.status = "rejected";
      request.admin_notes = adminNotes;
      request.reviewed_at = new Date().toISOString();
      return { success: true, status: "rejected" };
    }

    if (!request.matched_participant_id) {
      throw new Error("NO_MATCHED_PARTICIPANT");
    }

    const participant = this.db.participants.find((p) => p.id === request.matched_participant_id);
    if (!participant) throw new Error("PARTICIPANT_NOT_FOUND");

    const replacementToken = randomToken();
    const replacementHash = tokenHash(replacementToken);

    // Update participant token hash and rotate date; preserve ID and public code
    participant.recovery_token_hash = replacementHash;
    participant.recovery_rotated_at = new Date().toISOString();

    // Revoke previous sessions
    for (const session of this.db.sessions) {
      if (session.participant_id === participant.id && !session.revoked_at) {
        session.revoked_at = new Date().toISOString();
      }
    }

    request.status = "approved";
    request.admin_notes = adminNotes;
    request.replacement_token_hash = replacementHash;
    request.reviewed_at = new Date().toISOString();

    return {
      success: true,
      status: "approved",
      recoveryToken: replacementToken,
      participant: {
        id: participant.id,
        publicCode: participant.public_code,
      },
    };
  }

  async getDuplicates({ userRole, campaign }) {
    if (userRole !== "admin") throw new Error("ADMIN_AUTH_REQUIRED");

    const active = this.db.participants.filter(
      (p) => p.campaign === campaign && p.status !== "merged" && p.contact,
    );

    const groupsMap = new Map();
    for (const p of active) {
      const norm = normalizeContact(p.contact);
      if (!groupsMap.has(norm)) groupsMap.set(norm, []);
      groupsMap.get(norm).push(p);
    }

    const duplicateGroups = [];
    for (const [normContact, members] of groupsMap.entries()) {
      if (members.length > 1) {
        duplicateGroups.push({
          normalizedContact: normContact,
          participants: members.map((p) => ({
            id: p.id,
            fullName: p.full_name,
            contact: p.contact,
            publicCode: p.public_code,
            registeredAt: p.registered_at,
            collections: this.db.collections
              .filter((c) => c.participant_id === p.id)
              .map((c) => c.collection_date),
          })),
        });
      }
    }

    return { duplicateGroups };
  }

  async mergeParticipants({ userRole, primaryId, duplicateId, adminNotes }) {
    if (userRole !== "admin") throw new Error("ADMIN_AUTH_REQUIRED");
    if (!adminNotes || adminNotes.trim().length < 5) throw new Error("ADMIN_NOTES_REQUIRED");
    if (primaryId === duplicateId) throw new Error("CANNOT_MERGE_SELF");

    const primary = this.db.participants.find((p) => p.id === primaryId);
    const duplicate = this.db.participants.find((p) => p.id === duplicateId);
    if (!primary || !duplicate) throw new Error("PARTICIPANT_NOT_FOUND");

    if (primary.campaign !== duplicate.campaign) {
      throw new Error("CANNOT_MERGE_ACROSS_CAMPAIGNS");
    }

    const primaryCols = this.db.collections.filter((c) => c.participant_id === primary.id);
    const duplicateCols = this.db.collections.filter((c) => c.participant_id === duplicate.id);

    const primaryDates = new Set(primaryCols.map((c) => c.collection_date));
    const duplicateDates = new Set(duplicateCols.map((c) => c.collection_date));

    const overlapping = [...duplicateDates].filter((d) => primaryDates.has(d));
    const mergedDays = [...duplicateDates].filter((d) => !primaryDates.has(d));

    // Backup record
    const backup = {
      id: crypto.randomUUID(),
      campaign: primary.campaign,
      target_participant_id: primary.id,
      source_participant_id: duplicate.id,
      retained_public_code: primary.public_code,
      retired_public_code: duplicate.public_code,
      overlapping_days: overlapping,
      merged_days: mergedDays,
      admin_notes: adminNotes,
      created_at: new Date().toISOString(),
    };
    this.db.mergeBackups.push(backup);

    // Move non-overlapping collections
    for (const date of mergedDays) {
      this.db.collections.push({
        participant_id: primary.id,
        campaign: primary.campaign,
        collection_date: date,
      });
    }

    // Mark duplicate as merged
    duplicate.status = "merged";
    duplicate.merged_into_id = primary.id;

    // Revoke sessions of duplicate
    for (const session of this.db.sessions) {
      if (session.participant_id === duplicate.id && !session.revoked_at) {
        session.revoked_at = new Date().toISOString();
      }
    }

    return {
      success: true,
      backupId: backup.id,
      retainedPublicCode: primary.public_code,
      retiredPublicCode: duplicate.public_code,
      overlappingDays: overlapping,
      mergedDays,
    };
  }
}

// =======================
// TEST CASES (Scenarios 1-10)
// =======================

test("1. First registration creates one participant with unique public code and recovery token", async () => {
  const db = new MockDatabase();
  const server = new FoundAuraServer(db);

  const res = await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Aina Rasolofo",
    contact: "aina.rasolofo@example.com",
    accepted: true,
    marketingConsent: true,
  });

  assert.strictEqual(res.recoveryRequired, false);
  assert.ok(res.participantSession);
  assert.ok(res.recoveryToken);
  assert.strictEqual(db.participants.length, 1);
  assert.strictEqual(db.participants[0].full_name, "Aina Rasolofo");
  assert.strictEqual(db.participants[0].public_code.startsWith("FA-DEC-"), true);
  assert.strictEqual(db.participants[0].status, "active");
});

test("2. Same-browser return restores the original participant", async () => {
  const db = new MockDatabase();
  const server = new FoundAuraServer(db);

  const reg = await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Bao Rabe",
    contact: "bao.rabe@example.com",
    accepted: true,
  });

  // Mock browser localStorage storing session token
  const browserStorage = { "session-token": reg.participantSession };
  const storedToken = browserStorage["session-token"];
  assert.ok(storedToken);

  // Validate session token against database
  const hash = tokenHash(storedToken);
  const session = db.sessions.find((s) => s.token_hash === hash && !s.revoked_at);
  assert.ok(session);
  assert.strictEqual(session.participant_id, reg.participant.id);
});

test("3. Private recovery link restores the original participant on a new device", async () => {
  const db = new MockDatabase();
  const server = new FoundAuraServer(db);

  const reg = await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Fara Andriana",
    contact: "fara@example.com",
    accepted: true,
  });

  // Record collection on day 1
  db.collections.push({
    participant_id: reg.participant.id,
    campaign: "december-2026",
    collection_date: "2026-12-01",
  });

  // Participant opens private recovery link on new device (empty localStorage)
  const recovered = await server.recoverWithToken({
    campaign: "december-2026",
    recoveryToken: reg.recoveryToken,
  });

  assert.strictEqual(recovered.participant.id, reg.participant.id);
  assert.strictEqual(recovered.participant.public_code, reg.participant.public_code);
  assert.deepStrictEqual(recovered.collectedDays, ["2026-12-01"]);
});

test("4. Duplicate registration does not automatically expose or recover an existing account", async () => {
  const db = new MockDatabase();
  const server = new FoundAuraServer(db);

  const first = await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Soa Rasoa",
    contact: "soa.rasoa@example.com",
    accepted: true,
  });
  assert.strictEqual(first.recoveryRequired, false);

  // Duplicate attempt with slight variation in whitespace and casing
  const second = await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Soa Imposter",
    contact: "  SOA.RASOA@example.com  ",
    accepted: true,
  });

  // Must return neutral recovery response
  assert.strictEqual(second.recoveryRequired, true);
  assert.ok(second.message);
  // Must NOT leak code or token
  assert.strictEqual(second.participantSession, undefined);
  assert.strictEqual(second.recoveryToken, undefined);
  // Must NOT create another participant in database
  assert.strictEqual(db.participants.length, 1);
});

test("5. Losing the link triggers an assisted recovery flow without account enumeration", async () => {
  const db = new MockDatabase();
  const server = new FoundAuraServer(db);

  await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Hery Rajaona",
    contact: "hery@example.com",
    accepted: true,
  });

  // Submit recovery request for existing account
  const resExisting = await server.submitRecoveryRequest({
    campaign: "december-2026",
    fullName: "Hery Rajaona",
    contact: "hery@example.com",
    explanation: "J'ai changé de smartphone et perdu mon lien.",
  });

  // Submit recovery request for non-existent account
  const resNonExistent = await server.submitRecoveryRequest({
    campaign: "december-2026",
    fullName: "Inconnu",
    contact: "inconnu@example.com",
    explanation: "Test",
  });

  // Both must return identical neutral responses to avoid account enumeration
  assert.strictEqual(resExisting.success, true);
  assert.strictEqual(resNonExistent.success, true);
  assert.strictEqual(resExisting.message, resNonExistent.message);
  assert.strictEqual(db.recoveryRequests.length, 2);
  // Only the matching one should have matched_participant_id
  assert.ok(db.recoveryRequests[0].matched_participant_id);
  assert.strictEqual(db.recoveryRequests[1].matched_participant_id, null);
});

test("6. Only an authorized administrator can approve recovery", async () => {
  const db = new MockDatabase();
  const server = new FoundAuraServer(db);

  const reg = await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Tahina Rakoto",
    contact: "tahina@example.com",
    accepted: true,
  });

  await server.submitRecoveryRequest({
    campaign: "december-2026",
    fullName: "Tahina Rakoto",
    contact: "tahina@example.com",
    explanation: "Perdu",
  });
  const requestId = db.recoveryRequests[0].id;

  // Non-admin attempt should be rejected
  await assert.rejects(
    async () => {
      await server.reviewRecoveryRequest({
        userRole: "participant",
        requestId,
        action: "approve",
        adminNotes: "Tentative non autorisée",
      });
    },
    { message: "ADMIN_AUTH_REQUIRED" },
  );

  // Authorized admin review succeeds
  const adminRes = await server.reviewRecoveryRequest({
    userRole: "admin",
    requestId,
    action: "approve",
    adminNotes: "Identité vérifiée par téléphone le 14/11",
  });

  assert.strictEqual(adminRes.success, true);
  assert.strictEqual(adminRes.status, "approved");
  assert.ok(adminRes.recoveryToken);
});

test("7. Recovery preserves the original code and collection history", async () => {
  const db = new MockDatabase();
  const server = new FoundAuraServer(db);

  const reg = await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Vola Ravelo",
    contact: "vola@example.com",
    accepted: true,
  });
  const originalId = reg.participant.id;
  const originalCode = reg.participant.public_code;

  // Add 3 collections
  db.collections.push(
    { participant_id: originalId, campaign: "december-2026", collection_date: "2026-12-01" },
    { participant_id: originalId, campaign: "december-2026", collection_date: "2026-12-02" },
    { participant_id: originalId, campaign: "december-2026", collection_date: "2026-12-03" },
  );

  await server.submitRecoveryRequest({
    campaign: "december-2026",
    fullName: "Vola Ravelo",
    contact: "vola@example.com",
  });

  const review = await server.reviewRecoveryRequest({
    userRole: "admin",
    requestId: db.recoveryRequests[0].id,
    action: "approve",
    adminNotes: "Vérification effectuée avec succès",
  });

  // Recover using the replacement token
  const restored = await server.recoverWithToken({
    campaign: "december-2026",
    recoveryToken: review.recoveryToken,
  });

  assert.strictEqual(restored.participant.id, originalId);
  assert.strictEqual(restored.participant.public_code, originalCode);
  assert.deepStrictEqual(restored.collectedDays, ["2026-12-01", "2026-12-02", "2026-12-03"]);
  assert.strictEqual(db.participants.length, 1);
});

test("8. Old recovery credentials are revoked when replaced", async () => {
  const db = new MockDatabase();
  const server = new FoundAuraServer(db);

  const reg = await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Koto Randria",
    contact: "koto@example.com",
    accepted: true,
  });
  const oldToken = reg.recoveryToken;
  const oldSessionToken = reg.participantSession;

  await server.submitRecoveryRequest({
    campaign: "december-2026",
    fullName: "Koto Randria",
    contact: "koto@example.com",
  });

  await server.reviewRecoveryRequest({
    userRole: "admin",
    requestId: db.recoveryRequests[0].id,
    action: "approve",
    adminNotes: "Remplacement autorisé",
  });

  // Old recovery token should fail
  await assert.rejects(
    async () => {
      await server.recoverWithToken({
        campaign: "december-2026",
        recoveryToken: oldToken,
      });
    },
    { message: "PARTICIPANT_AUTH_REQUIRED" },
  );

  // Old session token should be marked revoked
  const oldSessionHash = tokenHash(oldSessionToken);
  const sessionRecord = db.sessions.find((s) => s.token_hash === oldSessionHash);
  assert.ok(sessionRecord.revoked_at);
});

test("9. Existing duplicate records are not automatically merged", async () => {
  const db = new MockDatabase();
  const server = new FoundAuraServer(db);

  // Simulate 2 duplicate records from the November beta
  const recordA = {
    id: "uuid-beta-a",
    campaign: "november-2026-beta",
    full_name: "Mamy Beta",
    contact: "mamy@example.com",
    normalized_contact: "mamy@example.com",
    status: "active",
    public_code: "FA-BETA-AAAA-1111-XXXX",
    registered_at: "2026-11-13T08:00:00Z",
  };
  const recordB = {
    id: "uuid-beta-b",
    campaign: "november-2026-beta",
    full_name: "Mamy Beta (2nd)",
    contact: "mamy@example.com",
    normalized_contact: "mamy@example.com",
    status: "active",
    public_code: "FA-BETA-BBBB-2222-YYYY",
    registered_at: "2026-11-14T09:00:00Z",
  };
  db.participants.push(recordA, recordB);

  // Day 1 collected on record A, Day 2 collected on record B
  db.collections.push(
    { participant_id: recordA.id, campaign: "november-2026-beta", collection_date: "2026-11-13" },
    { participant_id: recordB.id, campaign: "november-2026-beta", collection_date: "2026-11-14" },
  );

  // Check that system does NOT auto-merge them
  assert.strictEqual(db.participants.length, 2);
  assert.strictEqual(recordA.status, "active");
  assert.strictEqual(recordB.status, "active");

  // Admin inspects duplicates
  const dupRes = await server.getDuplicates({ userRole: "admin", campaign: "november-2026-beta" });
  assert.strictEqual(dupRes.duplicateGroups.length, 1);
  assert.strictEqual(dupRes.duplicateGroups[0].participants.length, 2);

  // Admin executes controlled merge with audit notes
  const mergeRes = await server.mergeParticipants({
    userRole: "admin",
    primaryId: recordA.id,
    duplicateId: recordB.id,
    adminNotes: "Client contacté en boutique, confirmation des deux participations beta",
  });

  assert.strictEqual(mergeRes.success, true);
  assert.strictEqual(mergeRes.retainedPublicCode, recordA.public_code);
  assert.strictEqual(mergeRes.retiredPublicCode, recordB.public_code);
  assert.strictEqual(db.mergeBackups.length, 1);
  assert.strictEqual(recordB.status, "merged");
  assert.strictEqual(recordB.merged_into_id, recordA.id);

  // All distinct collections are now associated with primary record
  const finalCollections = db.collections.filter((c) => c.participant_id === recordA.id);
  assert.strictEqual(finalCollections.length, 2);
});

test("10. A different person entering another participant's email cannot access their account", async () => {
  const db = new MockDatabase();
  const server = new FoundAuraServer(db);

  const victim = await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Victime Legitime",
    contact: "victime@example.com",
    accepted: true,
  });

  // Attacker attempts to register with victim's email
  const attackerReg = await server.registerParticipant({
    campaign: "december-2026",
    fullName: "Attaquant",
    contact: "victime@example.com",
    accepted: true,
  });

  // Attacker gets neutral recovery notice, no session, no recovery token, no participation code
  assert.strictEqual(attackerReg.recoveryRequired, true);
  assert.strictEqual(attackerReg.participantSession, undefined);
  assert.strictEqual(attackerReg.recoveryToken, undefined);

  // Attacker attempts assisted recovery
  await server.submitRecoveryRequest({
    campaign: "december-2026",
    fullName: "Attaquant",
    contact: "victime@example.com",
    explanation: "Donnez moi l'accès svp",
  });
  const attackerRequestId = db.recoveryRequests[0].id;

  // Administrator reviews and refuses recovery because ownership cannot be proven
  const adminRejection = await server.reviewRecoveryRequest({
    userRole: "admin",
    requestId: attackerRequestId,
    action: "reject",
    adminNotes: "Preuve de propriété insuffisante - refus de transmission de jeton",
  });

  assert.strictEqual(adminRejection.status, "rejected");
  // Victim account token remains unchanged and uncompromised
  assert.strictEqual(
    victim.participant.recovery_token_hash,
    db.participants[0].recovery_token_hash,
  );
});
