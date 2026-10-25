/* Mat Manual — Class Plan Builder · logic tests. Run: node logic.test.js */
const L = require("./logic.js");
let n = 0, fails = 0;
function ok(cond, msg) { n++; if (!cond) { fails++; console.error("FAIL:", msg); } }
function eq(a, b, msg) { ok(a === b, msg + " (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")"); }

// ---------- allocate: exact sums ----------
for (const total of [10, 15, 20, 30, 45, 60, 90, 137]) {
  const out = L.allocate(total, [0.4, 0.35, 0.25], [2, 2, 2]);
  eq(out.reduce((a, b) => a + b, 0), total, "allocate sums to " + total);
  ok(out.every(x => x >= 0), "allocate non-negative");
}
eq(L.allocate(45, [0, 1, 0], [0, 5, 0])[1], 45, "zero weights get zero");
eq(L.allocate(45, [0, 0, 0], [0, 0, 0]).reduce((a, b) => a + b, 0), 0, "all-zero weights stay zero");
{ // floors exceeding total still sum exactly
  const out = L.allocate(6, [0.5, 0.5], [5, 5]);
  eq(out.reduce((a, b) => a + b, 0), 6, "over-floored allocate still exact");
}

// ---------- generation: exact sums across lengths x mixes x arts ----------
const LENGTHS = [20, 25, 30, 35, 40, 45, 50, 60, 75, 90, 120];
const TECHS = ["Mae geri", "Gyaku zuki", "Age uke", "Mawashi geri", "Shuto uke", "Yoko geri"];
for (const art of L.PROFILE_IDS) {
  for (const mix of L.LEVEL_MIXES) {
    for (const len of LENGTHS) {
      for (const tc of [0, 1, 3, 6]) {
        const segs = L.generateSegments({ art, classMinutes: len, levelMix: mix, techniques: TECHS.slice(0, tc) });
        eq(L.totalMinutes(segs), len, `sum exact art=${art} mix=${mix} len=${len} techs=${tc}`);
        ok(segs.every(s => s.minutes >= 0), "no negative minutes");
        ok(segs[0].kind === "warmup", "starts with warm-up");
        eq(segs[segs.length - 1].kind, "cooldown", "ends with cool-down");
        if (mix === "beginner") ok(!segs.some(s => s.kind === "live" && s.minutes > 0), "beginners get no live segment");
        if (len >= 45 && mix !== "beginner") ok(segs.some(s => s.kind === "live" && s.minutes > 0), "live segment present for " + mix + " " + len);
      }
    }
  }
}
// techniques split into two blocks when there are enough of them
{
  const segs = L.generateSegments({ art: "shotokan", classMinutes: 60, levelMix: "mixed", techniques: TECHS });
  const blocks = segs.filter(s => s.kind === "technique");
  eq(blocks.length, 2, "six techniques at 60 min split into two blocks");
  eq(blocks[0].items.length + blocks[1].items.length, 6, "all techniques placed");
  ok(blocks[0].items[0].includes("Mae geri"), "first technique in block 1");
}
// category carried through from imported items
{
  const segs = L.generateSegments({ art: "judo", classMinutes: 45, levelMix: "mixed",
    techniques: [{ name: "Seoi nage", category: "Te-waza" }] });
  const block = segs.find(s => s.kind === "technique");
  ok(block.items[0].includes("Seoi nage") && block.items[0].includes("Te-waza"), "category shown with technique");
}
// per-art segment language
eq(L.segmentLabel("judo", "live"), "Randori", "judo live = randori");
eq(L.segmentLabel("bjj", "live"), "Rolling — live rounds", "bjj live = rolling");
eq(L.segmentLabel("shotokan", "technique"), "Kihon & kata", "shotokan technique label");
eq(L.segmentLabel("taekwondo", "live"), "Sparring — kyorugi", "taekwondo live = kyorugi");
eq(L.segmentLabel("muaythai", "partner"), "Pad work with a partner", "muay thai partner = pads");
ok(L.generateSegments({ art: "catch", classMinutes: 45, levelMix: "advanced", techniques: [] })
  .some(s => s.title === "Live wrestling"), "catch uses its own live label");

// ---------- rebalance ----------
for (const target of [30, 45, 60, 90, 33]) {
  const base = L.generateSegments({ art: "bjj", classMinutes: 45, levelMix: "mixed", techniques: TECHS.slice(0, 3) });
  base[1].minutes += 7; base[2].minutes = 0; // user edits, including a zero
  const out = L.rebalance(base, target);
  eq(L.totalMinutes(out), target, "rebalance hits " + target);
  eq(out[2].minutes, 0, "zero segment stays zero through rebalance");
  ok(out[1].minutes >= 1, "nonzero segment keeps at least 1");
}
{ // all zero -> even split, exact
  const zero = L.generateSegments({ art: "judo", classMinutes: 45, levelMix: "mixed", techniques: [] })
    .map(s => ({ ...s, minutes: 0 }));
  const out = L.rebalance(zero, 45);
  eq(L.totalMinutes(out), 45, "all-zero rebalance still exact");
}
// deterministic fuzz: random edits always rebalance exactly
let seed = 42;
function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
for (let i = 0; i < 300; i++) {
  const base = L.generateSegments({ art: "general", classMinutes: 60, levelMix: "advanced", techniques: TECHS });
  base.forEach(s => { s.minutes = Math.floor(rnd() * 30); });
  const target = 20 + Math.floor(rnd() * 100);
  eq(L.totalMinutes(L.rebalance(base, target)), target, "fuzz rebalance #" + i);
}

// ---------- clock ----------
{
  const segs = L.generateSegments({ art: "shotokan", classMinutes: 45, levelMix: "mixed", techniques: [] });
  const clocked = L.withClock(segs, "18:05");
  eq(clocked[0].start, 0, "first segment starts at 0");
  eq(clocked[0].startClock, "6:05 PM", "clock start formats");
  eq(clocked[clocked.length - 1].endClock, "6:50 PM", "45-min class from 6:05 ends 6:50 PM");
  eq(clocked[clocked.length - 1].end, 45, "offsets sum to class length");
  const noClock = L.withClock(segs, "");
  ok(noClock[0].startClock === undefined, "no clock strings without a start time");
  eq(L.parseClock("25:00"), null, "invalid clock rejected");
  eq(L.fmtOffset(65), "1:05", "offset format");
}

// ---------- import mapping ----------
{
  const items = [
    { category_name: "Te-waza", requirement_name: "Seoi nage", level: "" },
    { category_name: "Te-waza", requirement_name: "Tai otoshi", level: "" },
    { category_name: "", requirement_name: "  ", level: "" }
  ];
  const techs = L.techniquesFromLessonItems(items);
  eq(techs.length, 2, "blank lesson items dropped");
  eq(techs[0].category, "Te-waza", "category snapshot carried");
  eq(L.mapArtText("Shotokan Karate"), "shotokan", "art text: shotokan");
  eq(L.mapArtText("Brazilian Jiu-Jitsu"), "bjj", "art text: bjj");
  eq(L.mapArtText("Kodokan Judo"), "judo", "art text: judo");
  eq(L.mapArtText("Muay Thai"), "muaythai", "art text: muay thai");
  eq(L.mapArtText("Taekwondo"), "taekwondo", "art text: taekwondo");
  eq(L.mapArtText("Catch Wrestling"), "catch", "art text: catch");
  eq(L.mapArtText("Aikido"), "general", "unknown art falls back to general");
  eq(L.mixForPhase("Foundations"), "beginner", "phase Foundations -> beginner");
  eq(L.mixForPhase("Test Ready"), "advanced", "phase Test Ready -> advanced");
  eq(L.mixForPhase("Expansion"), "mixed", "phase Expansion -> mixed");
}

// ---------- plan + state sanitising ----------
{
  const plan = L.newPlan({ art: "judo", classMinutes: 45, levelMix: "mixed", techniques: ["Seoi nage"] });
  eq(L.totalMinutes(plan.segments), 45, "newPlan segments sum to class length");
  eq(plan.source, "standalone", "newPlan defaults standalone");
  const round = L.sanitizePlan(JSON.parse(JSON.stringify(plan)));
  eq(round.id, plan.id, "plan survives JSON round-trip");
  eq(L.totalMinutes(round.segments), 45, "round-tripped plan still sums");

  const dirty = L.sanitizePlan({ name: "<b>x</b>", art: "nope", classMinutes: "abc", levelMix: "wild",
    segments: [{ kind: "technique", title: "T", minutes: "12", items: ["a<script>", " ok "] }, null, { kind: "zzz", minutes: -5 }] });
  ok(dirty !== null, "dirty plan sanitised, not dropped");
  eq(dirty.name, "x", "tags stripped from name");
  eq(dirty.art, "general", "unknown art -> general");
  eq(dirty.segments.length, 2, "null segment dropped, unknown kind kept as custom");
  eq(dirty.segments[1].kind, "custom", "unknown kind becomes custom");
  eq(dirty.segments[1].minutes, 0, "negative minutes clamped to 0");
  eq(L.sanitizePlan({ segments: [] }), null, "plan with no segments rejected");
  eq(L.sanitizePlan(null), null, "null plan rejected");

  const state = L.sanitizeState({ plans: [plan, { segments: [] }], activePlanId: "missing" });
  eq(state.plans.length, 1, "state keeps only valid plans");
  eq(state.activePlanId, plan.id, "active id falls back to first plan");
  eq(L.sanitizeState(null).plans.length, 0, "null state -> empty state");
  eq(L.sanitizeState("junk").activePlanId, null, "junk state -> null active");
}

// ---------- tier gating ----------
{
  const empty = { v: 1, plans: [], activePlanId: null };
  ok(L.canCreatePlan(empty, "free"), "free can create first plan");
  const three = { v: 1, plans: [1, 2, 3].map(i => L.newPlan({ name: "P" + i })), activePlanId: null };
  ok(!L.canCreatePlan(three, "free"), "free blocked at 3 plans");
  ok(!L.canCreatePlan(three, "pro"), "student Pro gets the free limits in this instructor tool");
  ok(L.canCreatePlan(three, "instructor"), "instructor unlimited");
  ok(!L.canImport("free") && !L.canImport("pro") && L.canImport("instructor"), "import is Pro Instructor");
  ok(!L.canPrint("free") && !L.canPrint("pro") && L.canPrint("instructor"), "print is Pro Instructor");
}

console.log(`\n${n} assertions, ${fails} failures`);
process.exit(fails ? 1 : 0);
