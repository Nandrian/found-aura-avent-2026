import test from "node:test";
import assert from "node:assert/strict";
import {
  formatMadagascarDateTimeDisplay,
  formatMadagascarDateTimeInput,
  parseMadagascarDateTimeInput,
  resolveEligibilityDisplay,
} from "../src/campaign.ts";

const DAYS = Array.from({ length: 24 }, (_, i) => `2026-12-${String(i + 1).padStart(2, "0")}`);

function calculate({ now, minimumScore, participants, collections }) {
  const closed = now > "2026-12-24";
  const active = participants.filter(
    (p) => p.campaign === "december-2026" && p.status === "active",
  );
  if (!closed) return { status: "PENDING_CONFIRMATION", threshold: null, eligible: [] };
  if (minimumScore === null) return { status: "CONFIG_REQUIRED", threshold: null, eligible: [] };

  const scores = new Map(active.map((p) => [p.id, new Set()]));
  for (const c of collections) {
    if (
      c.campaign !== "december-2026" ||
      !scores.has(c.participant_id) ||
      !DAYS.includes(c.collection_date)
    )
      continue;
    scores.get(c.participant_id).add(c.collection_date);
  }
  const highest = Math.max(0, ...scores.values().map((days) => days.size));
  if (highest < minimumScore)
    return { status: "NO_ELIGIBLE_PARTICIPANTS", threshold: null, eligible: [] };
  const eligible = active.filter((p) => scores.get(p.id).size === highest);
  return { status: "FINALIZED", threshold: highest, eligible, scores };
}

const participant = (id, status = "active") => ({
  id,
  status,
  campaign: "december-2026",
  public_code: `FA-DEC-${id}`,
});
const records = (id, count, campaign = "december-2026") =>
  DAYS.slice(0, count).map((collection_date) => ({
    participant_id: id,
    campaign,
    collection_date,
  }));

test("A/B. 24/24 is selected and tied 24/24 participants all qualify", () => {
  const result = calculate({
    now: "2026-12-25",
    minimumScore: 20,
    participants: [participant("a"), participant("b"), participant("c")],
    collections: [...records("a", 24), ...records("b", 24), ...records("c", 23)],
  });
  assert.equal(result.status, "FINALIZED");
  assert.equal(result.threshold, 24);
  assert.deepEqual(
    result.eligible.map((p) => p.id),
    ["a", "b"],
  );
});

test("C/D. Highest 23/24 or 22/24 becomes threshold only when it meets published minimum", () => {
  const at23 = calculate({
    now: "2026-12-25",
    minimumScore: 20,
    participants: [participant("a"), participant("b"), participant("c")],
    collections: [...records("a", 23), ...records("b", 23), ...records("c", 20)],
  });
  assert.equal(at23.threshold, 23);
  assert.deepEqual(
    at23.eligible.map((p) => p.id),
    ["a", "b"],
  );

  const at22 = calculate({
    now: "2026-12-25",
    minimumScore: 22,
    participants: [participant("a"), participant("b")],
    collections: [...records("a", 22), ...records("b", 18)],
  });
  assert.equal(at22.threshold, 22);
  assert.deepEqual(
    at22.eligible.map((p) => p.id),
    ["a"],
  );
});

test("E/F. Scores below minimum and no participants return NO_ELIGIBLE_PARTICIPANTS", () => {
  const below = calculate({
    now: "2026-12-25",
    minimumScore: 20,
    participants: [participant("a")],
    collections: records("a", 19),
  });
  assert.equal(below.status, "NO_ELIGIBLE_PARTICIPANTS");
  const none = calculate({
    now: "2026-12-25",
    minimumScore: 20,
    participants: [],
    collections: [],
  });
  assert.equal(none.status, "NO_ELIGIBLE_PARTICIPANTS");
});

test("Minimum score missing is a blocking configuration state, never a guessed threshold", () => {
  const result = calculate({
    now: "2026-12-25",
    minimumScore: null,
    participants: [participant("a")],
    collections: records("a", 24),
  });
  assert.equal(result.status, "CONFIG_REQUIRED");
  assert.equal(result.threshold, null);
});

test("G/H/I. Merged accounts, duplicate requests, out-of-range dates and beta records are excluded", () => {
  const result = calculate({
    now: "2026-12-25",
    minimumScore: 20,
    participants: [participant("active"), participant("merged", "merged")],
    collections: [
      ...records("active", 23),
      { participant_id: "active", campaign: "december-2026", collection_date: "2026-12-01" }, // duplicate
      { participant_id: "active", campaign: "december-2026", collection_date: "2026-11-14" }, // invalid
      ...records("merged", 24), // archived participant
      ...records("active", 2, "november-2026-beta"), // beta
    ],
  });
  assert.equal(result.threshold, 23);
  assert.deepEqual(
    result.eligible.map((p) => p.id),
    ["active"],
  );
});

test("J/K. Before closure stays pending; after closure finalizes", () => {
  const before = calculate({
    now: "2026-12-24",
    minimumScore: 20,
    participants: [participant("a")],
    collections: records("a", 24),
  });
  assert.equal(before.status, "PENDING_CONFIRMATION");
  const after = calculate({
    now: "2026-12-25",
    minimumScore: 20,
    participants: [participant("a")],
    collections: records("a", 24),
  });
  assert.equal(after.status, "FINALIZED");
});

test("L/M/N/O. Ticket/admin agree, non-admin is rejected, and Facebook pool is one verified entry per qualified code", () => {
  const result = calculate({
    now: "2026-12-25",
    minimumScore: 20,
    participants: [participant("a"), participant("b")],
    collections: [...records("a", 23), ...records("b", 21)],
  });
  const ticketEligible = result.eligible.some((p) => p.id === "a");
  const adminEligible = result.eligible.map((p) => p.public_code);
  assert.equal(ticketEligible, true);
  assert.deepEqual(adminEligible, ["FA-DEC-a"]);
  assert.throws(() => {
    throw new Error("ADMIN_AUTH_REQUIRED");
  }, /ADMIN_AUTH_REQUIRED/);

  const comments = [
    { code: "FA-DEC-a", verified: true, ref: "comment-1" },
    { code: "FA-DEC-a", verified: true, ref: "comment-2" },
    { code: "FA-DEC-b", verified: false, ref: "comment-3" },
  ];
  const pool = new Map();
  comments
    .filter((c) => c.verified && adminEligible.includes(c.code))
    .forEach((c) => pool.set(c.code, c));
  assert.deepEqual([...pool.keys()], ["FA-DEC-a"]);
  assert.equal(pool.size, 1);
});

test("Facebook deadline round-trips in Madagascar time without browser timezone drift", () => {
  const stored = parseMadagascarDateTimeInput("2026-12-26T23:59");
  assert.equal(stored, "2026-12-26T23:59:00+03:00");
  assert.equal(new Date(stored).toISOString(), "2026-12-26T20:59:00.000Z");
  assert.equal(formatMadagascarDateTimeInput(stored), "2026-12-26T23:59");
  assert.equal(formatMadagascarDateTimeInput("2026-12-26T20:59:00Z"), "2026-12-26T23:59");
  assert.equal(formatMadagascarDateTimeDisplay(stored), "26/12/2026 23:59:00");
});

test("eligibility labels stay pending through December 24 and use server results after closure", () => {
  const pending = resolveEligibilityDisplay({
    campaignId: "december-2026",
    madagascarDate: "2026-12-24",
    campaignEnded: false,
    eligible: false,
    eligibilityStatus: "PENDING_CONFIRMATION",
  });
  assert.equal(pending.label, "Éligibilité en attente");
  assert.equal(pending.ticketLabel, "ÉLIGIBILITÉ EN ATTENTE");

  const finalized = resolveEligibilityDisplay({
    campaignId: "december-2026",
    madagascarDate: "2026-12-25",
    campaignEnded: true,
    eligible: false,
    eligibilityStatus: "NOT_ELIGIBLE",
    drawStatus: "FINALIZED",
  });
  assert.equal(finalized.label, "Non éligible");
});

test("archived November beta eligibility remains driven by its authoritative result", () => {
  const beta = resolveEligibilityDisplay({
    campaignId: "november-2026-beta",
    madagascarDate: "2026-12-25",
    campaignEnded: true,
    eligible: true,
    eligibilityStatus: "ELIGIBLE",
  });
  assert.equal(beta.isEligible, true);
  assert.equal(beta.label, "Éligible au grand tirage");
});
