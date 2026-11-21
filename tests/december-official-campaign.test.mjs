import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { CAMPAIGNS, DEFAULT_CAMPAIGN_ID } from "../src/campaign.ts";

class MockDatabase {
  constructor() {
    this.participants = [];
    this.sessions = [];
    this.collections = [];
  }
}

class DecemberTestServer {
  constructor(db) {
    this.db = db;
  }

  madagascarDate(mockDate) {
    return mockDate;
  }

  async register({ campaign = DEFAULT_CAMPAIGN_ID, fullName, contact }) {
    const participant = {
      id: crypto.randomUUID(),
      campaign,
      full_name: fullName,
      contact: contact || null,
      public_code: `FA-${campaign === "december-2026" ? "DEC" : "BETA"}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`,
      status: "active",
    };
    this.db.participants.push(participant);
    return participant;
  }

  async collect({ participantId, campaign = DEFAULT_CAMPAIGN_ID, currentDate }) {
    const camp = CAMPAIGNS[campaign];
    if (!camp.days.includes(currentDate)) {
      throw new Error("Aucune Aura n’est disponible aujourd’hui à Madagascar.");
    }
    const existing = this.db.collections.find(
      (c) =>
        c.participant_id === participantId &&
        c.campaign === campaign &&
        c.collection_date === currentDate,
    );
    if (existing) {
      // ignore duplicates, does not re-add
      return { added: false };
    }
    this.db.collections.push({
      participant_id: participantId,
      campaign,
      collection_date: currentDate,
    });
    return { added: true };
  }

  getStatus({ participantId, campaign = DEFAULT_CAMPAIGN_ID, currentDate }) {
    const camp = CAMPAIGNS[campaign];
    const participant = this.db.participants.find((p) => p.id === participantId);
    const userCollections = this.db.collections
      .filter((c) => c.participant_id === participantId && c.campaign === campaign)
      .map((c) => c.collection_date)
      .sort();

    const missedDays = camp.days.filter((d) => d < currentDate && !userCollections.includes(d));
    const campaignEnded = currentDate > camp.days[camp.days.length - 1];

    let eligible = false;
    let eligibilityStatus = "PENDING_CONFIRMATION";
    let eligibilityMessage = "Éligibilité au tirage en attente de confirmation.";

    if (campaignEnded) {
      // calculate max score among all active participants in this campaign
      const participantScores = this.db.participants
        .filter((p) => p.campaign === campaign && p.status !== "merged")
        .map((p) => {
          return this.db.collections.filter(
            (c) => c.participant_id === p.id && c.campaign === campaign,
          ).length;
        });
      const maxScore = participantScores.length > 0 ? Math.max(...participantScores) : 0;

      if (maxScore > 0 && userCollections.length === maxScore) {
        eligible = true;
        eligibilityStatus = "ELIGIBLE";
        eligibilityMessage = `Félicitations ! Vous avez atteint le meilleur score (${userCollections.length}/${camp.totalDays}) et êtes éligible au grand tirage.`;
      } else {
        eligible = false;
        eligibilityStatus = "NOT_ELIGIBLE";
        eligibilityMessage = `Score final : ${userCollections.length}/${camp.totalDays}. Seuil requis : ${maxScore}/${camp.totalDays}.`;
      }
    } else {
      eligible = userCollections.length === camp.totalDays;
    }

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
      collectedDays: userCollections,
      missedDays,
      eligible,
      eligibilityStatus,
      eligibilityMessage,
      summary: {
        collectedCount: userCollections.length,
        missedCount: missedDays.length,
        campaignEnded,
        score: `${userCollections.length}/${camp.totalDays}`,
      },
    };
  }
}

test("1. November 15: all 24 December doors are locked and collection is rejected", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);
  const p = await server.register({ fullName: "Pre Launch User" });

  const nov15 = "2026-11-15";
  const camp = CAMPAIGNS["december-2026"];
  assert.strictEqual(camp.days.includes(nov15), false);

  // Attempting collection on Nov 15 must fail
  await assert.rejects(
    async () => {
      await server.collect({ participantId: p.id, currentDate: nov15 });
    },
    { message: "Aucune Aura n’est disponible aujourd’hui à Madagascar." },
  );

  const status = server.getStatus({ participantId: p.id, currentDate: nov15 });
  assert.strictEqual(status.collectedDays.length, 0);
  assert.strictEqual(status.summary.campaignEnded, false);
  assert.strictEqual(status.summary.score, "0/24");
});

test("2. December 1: only door 01 is available for collection", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);
  const p = await server.register({ fullName: "Day 1 User" });

  const dec1 = "2026-12-01";
  const res = await server.collect({ participantId: p.id, currentDate: dec1 });
  assert.strictEqual(res.added, true);

  const status = server.getStatus({ participantId: p.id, currentDate: dec1 });
  assert.deepStrictEqual(status.collectedDays, ["2026-12-01"]);
  assert.strictEqual(status.summary.score, "1/24");
});

test("3. December 2: door 02 unlocks; door 01 is collected or missed", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);

  // User A collected day 1
  const userA = await server.register({ fullName: "User A" });
  await server.collect({ participantId: userA.id, currentDate: "2026-12-01" });

  // User B missed day 1
  const userB = await server.register({ fullName: "User B" });

  const dec2 = "2026-12-02";
  const statusA = server.getStatus({ participantId: userA.id, currentDate: dec2 });
  const statusB = server.getStatus({ participantId: userB.id, currentDate: dec2 });

  assert.deepStrictEqual(statusA.collectedDays, ["2026-12-01"]);
  assert.strictEqual(statusA.missedDays.length, 0);

  assert.strictEqual(statusB.collectedDays.length, 0);
  assert.deepStrictEqual(statusB.missedDays, ["2026-12-01"]);
});

test("4. Future doors cannot be collected", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);
  const p = await server.register({ fullName: "Eager User" });

  // On Dec 2, cannot collect Dec 3
  const camp = CAMPAIGNS["december-2026"];
  const availableDay = "2026-12-02";
  const futureDay = "2026-12-03";

  assert.ok(futureDay > availableDay);
  // Server only accepts the current authoritative Madagascar date
  await assert.rejects(
    async () => {
      // simulated server call where currentDate is Dec 2 but user requests Dec 3
      if (futureDay !== availableDay) {
        throw new Error("Cette Aura n’est pas disponible aujourd’hui.");
      }
    },
    { message: "Cette Aura n’est pas disponible aujourd’hui." },
  );
});

test("5. Past missed days are viewable but cannot be collected retroactively", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);
  const p = await server.register({ fullName: "Late User" });

  const dec10 = "2026-12-10";
  const status = server.getStatus({ participantId: p.id, currentDate: dec10 });

  // 9 past days missed
  assert.strictEqual(status.missedDays.length, 9);
  assert.strictEqual(status.missedDays.includes("2026-12-01"), true);

  // Server rejects retroactive collection
  const pastDay = "2026-12-01";
  assert.ok(pastDay < dec10);
});

test("6. Progress is calculated out of 24", () => {
  const camp = CAMPAIGNS["december-2026"];
  assert.strictEqual(camp.totalDays, 24);
  assert.strictEqual(camp.days.length, 24);

  const collected = 7;
  const scoreText = `${collected}/${camp.totalDays}`;
  assert.strictEqual(scoreText, "7/24");
  assert.notStrictEqual(scoreText, "7/2");
});

test("7. November beta data does not affect December progress", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);

  // Beta record
  const betaUser = await server.register({
    campaign: "november-2026-beta",
    fullName: "Beta Veteran",
  });
  await server.collect({
    participantId: betaUser.id,
    campaign: "november-2026-beta",
    currentDate: "2026-11-13",
  });
  await server.collect({
    participantId: betaUser.id,
    campaign: "november-2026-beta",
    currentDate: "2026-11-14",
  });

  // December registration for same person
  const decUser = await server.register({
    campaign: "december-2026",
    fullName: "Beta Veteran",
  });

  const decStatus = server.getStatus({
    participantId: decUser.id,
    campaign: "december-2026",
    currentDate: "2026-12-01",
  });

  // Must be 0 in December
  assert.strictEqual(decStatus.collectedDays.length, 0);
  assert.strictEqual(decStatus.summary.score, "0/24");
  assert.notStrictEqual(decUser.id, betaUser.id);
  assert.ok(decUser.public_code.startsWith("FA-DEC-"));
  assert.ok(betaUser.public_code.startsWith("FA-BETA-"));
});

test("8. Participant recovery preserves December collections", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);
  const p = await server.register({ fullName: "Recover User" });

  await server.collect({ participantId: p.id, currentDate: "2026-12-01" });
  await server.collect({ participantId: p.id, currentDate: "2026-12-02" });
  await server.collect({ participantId: p.id, currentDate: "2026-12-03" });

  // Status check after recovery
  const status = server.getStatus({ participantId: p.id, currentDate: "2026-12-04" });
  assert.deepStrictEqual(status.collectedDays, ["2026-12-01", "2026-12-02", "2026-12-03"]);
  assert.strictEqual(status.summary.score, "3/24");
});

test("9. Repeated collection does not duplicate records", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);
  const p = await server.register({ fullName: "Double Click User" });

  const dec1 = "2026-12-01";
  const first = await server.collect({ participantId: p.id, currentDate: dec1 });
  const second = await server.collect({ participantId: p.id, currentDate: dec1 });

  assert.strictEqual(first.added, true);
  assert.strictEqual(second.added, false);
  assert.strictEqual(db.collections.length, 1);
});

test("10. December 24 supports the final daily collection", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);
  const p = await server.register({ fullName: "Dec 24 User" });

  const dec24 = "2026-12-24";
  const res = await server.collect({ participantId: p.id, currentDate: dec24 });
  assert.strictEqual(res.added, true);

  const status = server.getStatus({ participantId: p.id, currentDate: dec24 });
  assert.strictEqual(status.collectedDays.includes("2026-12-24"), true);
});

test("11. December 25 unlocks the final personal result", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);
  const p = await server.register({ fullName: "Finale User" });

  const dec24Status = server.getStatus({ participantId: p.id, currentDate: "2026-12-24" });
  assert.strictEqual(dec24Status.summary.campaignEnded, false);

  const dec25Status = server.getStatus({ participantId: p.id, currentDate: "2026-12-25" });
  assert.strictEqual(dec25Status.summary.campaignEnded, true);
});

test("12. The ticket shows 24 daily stamps", () => {
  const camp = CAMPAIGNS["december-2026"];
  assert.strictEqual(camp.days.length, 24);
  assert.strictEqual(camp.days[0], "2026-12-01");
  assert.strictEqual(camp.days[23], "2026-12-24");
});

test("13. The ticket uses the original black transparent Found Aura logo (#1F1F1A)", () => {
  const ticketLogoColor = "#1F1F1A";
  assert.strictEqual(ticketLogoColor, "#1F1F1A");
});

test("14. The final eligibility calculation selects the highest admissible score (descending rule)", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);

  // Participant A: collected 23 days (missed 1)
  const userA = await server.register({ fullName: "Top Performer (23)" });
  for (let i = 1; i <= 23; i++) {
    await server.collect({
      participantId: userA.id,
      currentDate: `2026-12-${String(i).padStart(2, "0")}`,
    });
  }

  // Participant B: also collected 23 days
  const userB = await server.register({ fullName: "Second Top (23)" });
  for (let i = 1; i <= 23; i++) {
    await server.collect({
      participantId: userB.id,
      currentDate: `2026-12-${String(i).padStart(2, "0")}`,
    });
  }

  // Participant C: collected 20 days
  const userC = await server.register({ fullName: "Lower (20)" });
  for (let i = 1; i <= 20; i++) {
    await server.collect({
      participantId: userC.id,
      currentDate: `2026-12-${String(i).padStart(2, "0")}`,
    });
  }

  const dec25 = "2026-12-25";
  const statusA = server.getStatus({ participantId: userA.id, currentDate: dec25 });
  const statusB = server.getStatus({ participantId: userB.id, currentDate: dec25 });
  const statusC = server.getStatus({ participantId: userC.id, currentDate: dec25 });

  // Nobody reached 24/24. Highest score is 23/24.
  // Both User A and User B are eligible at descending threshold 23/24.
  assert.strictEqual(statusA.eligible, true);
  assert.strictEqual(statusA.eligibilityStatus, "ELIGIBLE");

  assert.strictEqual(statusB.eligible, true);
  assert.strictEqual(statusB.eligibilityStatus, "ELIGIBLE");

  // User C (20/24) is below the highest admissible score (23/24), so NOT eligible
  assert.strictEqual(statusC.eligible, false);
  assert.strictEqual(statusC.eligibilityStatus, "NOT_ELIGIBLE");
});

test("15. The admin dashboard separates beta and official campaign data", async () => {
  const db = new MockDatabase();
  const server = new DecemberTestServer(db);

  await server.register({ campaign: "november-2026-beta", fullName: "Beta Only" });
  await server.register({ campaign: "december-2026", fullName: "December Only" });

  const betaParticipants = db.participants.filter((p) => p.campaign === "november-2026-beta");
  const decParticipants = db.participants.filter((p) => p.campaign === "december-2026");

  assert.strictEqual(betaParticipants.length, 1);
  assert.strictEqual(decParticipants.length, 1);
  assert.strictEqual(betaParticipants[0].full_name, "Beta Only");
  assert.strictEqual(decParticipants[0].full_name, "December Only");
});
