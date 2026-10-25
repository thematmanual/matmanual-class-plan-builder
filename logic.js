/*
 * Mat Manual — Class Plan Builder · pure logic.
 *
 * Everything in this file is dependency-free and DOM-free so the
 * plan maths can be unit-tested in Node (logic.test.js) and the
 * exact same bytes can be inlined into index.html (the <script
 * id="logic"> block there is byte-identical to this file — the
 * splice script proves it).
 *
 * WHAT THIS APP DOES: turn a list of techniques — typed by hand, or
 * imported from one class in the user's own Curriculum Builder
 * rotation — into ONE timed class plan: warm-up, technique blocks,
 * partner drills, live practice, conditioning, cool-down. Segment
 * minutes ALWAYS sum exactly to the chosen class length; that is
 * the product's core promise and the tests hammer it across class
 * lengths and level mixes.
 *
 * PER-ART LANGUAGE (multi-domain rule): the six Mat Manual arts do
 * not run the same class. Segment names come from the selected
 * art's profile — judo warms up with ukemi and finishes technique
 * with randori, BJJ rolls, Muay Thai works pads, taekwondo spars
 * (kyorugi). A term is shared only where every art genuinely uses
 * it the same way ("warm-up", "conditioning"); everything else is
 * the profile's own word. A "general" profile covers classes
 * outside the six arts with neutral labels.
 *
 * HONESTY LAW (same as every Mat Manual tool): a class plan is a
 * plan, not a promise. Nothing here scores a class or claims an
 * outcome — the logic only divides time, orders segments, stores,
 * and prints.
 *
 * TIERS (app layer, mirroring the sibling tools; RLS enforces
 * ownership only): this is an instructor tool — Free = up to 3
 * saved plans, standalone mode only, on-screen, and a student Pro
 * account gets exactly that same free tier here. Pro Instructor =
 * unlimited plans, Curriculum Builder import, and printing. A
 * downgrade deletes nothing — the caps only block creating NEW
 * plans, and plans already saved stay fully usable.
 */
(function (global) {
  "use strict";

  // ---- Small utilities -------------------------------------------------------

  var uidCounter = 0;
  function uid() {
    uidCounter += 1;
    return "p" + Date.now().toString(36) + "x" + uidCounter.toString(36) +
      Math.floor(Math.random() * 0xfffff).toString(36);
  }

  // User text is kept as inert text: tags stripped, whitespace
  // collapsed, length-capped (same treatment as the sibling tools).
  function cleanText(v, max) {
    var s = String(v === null || v === undefined ? "" : v)
      .replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    if (max && s.length > max) s = s.slice(0, max).trim();
    return s;
  }

  function clampInt(v, lo, hi, fallback) {
    var n = Math.round(Number(v));
    if (!isFinite(n)) return fallback;
    if (n < lo) return lo;
    if (n > hi) return hi;
    return n;
  }

  // ---- The arts and their class language -------------------------------------
  // segments: display label per segment kind, in the art's own terms.
  // drillsNote: default framing line for the partner segment.
  // liveNote: default framing line for the live segment.
  var PROFILES = {
    general: {
      label: "General martial arts",
      segments: {
        warmup: "Warm-up", technique: "Technique", partner: "Partner drills",
        live: "Sparring / live practice", conditioning: "Conditioning", cooldown: "Cool-down & stretch"
      },
      drillsNote: "Work today's techniques with a partner, both sides, both roles.",
      liveNote: "Live practice built on today's techniques. Keep the intensity agreed before you start."
    },
    shotokan: {
      label: "Shotokan Karate",
      segments: {
        warmup: "Warm-up", technique: "Kihon & kata", partner: "Partner drills — kumite",
        live: "Free sparring — jiyu kumite", conditioning: "Conditioning", cooldown: "Cool-down & stretch"
      },
      drillsNote: "Kumite drills on today's techniques: start from kihon distance, agree the attacks before you begin.",
      liveNote: "Jiyu kumite. Controlled contact, protective equipment on, today's techniques are the scoring focus."
    },
    bjj: {
      label: "Brazilian Jiu-Jitsu",
      segments: {
        warmup: "Warm-up & movement drills", technique: "Technique instruction", partner: "Drilling with a partner",
        live: "Rolling — live rounds", conditioning: "Conditioning", cooldown: "Cool-down & stretch"
      },
      drillsNote: "Reps with a cooperative partner first, then add resistance in steps.",
      liveNote: "Live rounds starting from today's positions. Tap early, tap often."
    },
    judo: {
      label: "Kodokan Judo",
      segments: {
        warmup: "Warm-up & ukemi", technique: "Technique — uchi-komi & nage-komi", partner: "Partner practice",
        live: "Randori", conditioning: "Conditioning", cooldown: "Cool-down & stretch"
      },
      drillsNote: "Uchi-komi in moving lines, then nage-komi onto the crash pad in turns.",
      liveNote: "Randori at the agreed intensity. The throw only counts if uke can fall safely."
    },
    muaythai: {
      label: "Muay Thai",
      segments: {
        warmup: "Warm-up & shadow work", technique: "Technique instruction", partner: "Pad work with a partner",
        live: "Sparring rounds", conditioning: "Conditioning", cooldown: "Cool-down & stretch"
      },
      drillsNote: "Pad rounds on today's techniques — holder calls, striker answers, swap on the bell.",
      liveNote: "Technical sparring at agreed intensity. Today's techniques are the scoring focus."
    },
    taekwondo: {
      label: "Taekwondo",
      segments: {
        warmup: "Warm-up", technique: "Kicks & poomsae", partner: "Partner drills",
        live: "Sparring — kyorugi", conditioning: "Conditioning", cooldown: "Cool-down & stretch"
      },
      drillsNote: "Partner and paddle drills on today's kicks and poomsae sections, both legs.",
      liveNote: "Kyorugi rounds at the agreed intensity, full protective equipment."
    },
    catch: {
      label: "Catch Wrestling",
      segments: {
        warmup: "Warm-up & tumbling", technique: "Technique instruction", partner: "Partner drilling",
        live: "Live wrestling", conditioning: "Conditioning", cooldown: "Cool-down & stretch"
      },
      drillsNote: "Chain the entries and finishes with a partner: cooperative first, then progressive resistance.",
      liveNote: "Live goes from today's positions. Submissions are caught and released — control first, always."
    }
  };
  var PROFILE_IDS = Object.keys(PROFILES);

  function profileById(id) {
    return Object.prototype.hasOwnProperty.call(PROFILES, id) ? PROFILES[id] : PROFILES.general;
  }
  function profileLabel(id) { return profileById(id).label; }
  function segmentLabel(profileId, kind) {
    var p = profileById(profileId);
    return p.segments[kind] || PROFILES.general.segments[kind] || kind;
  }

  // The Curriculum Builder stores the art as free text. Map it to a
  // profile by looking for the art's own words; anything unrecognised
  // gets the neutral general profile rather than a wrong art's terms.
  function mapArtText(text) {
    var t = String(text || "").toLowerCase();
    if (/shotokan|karate/.test(t)) return "shotokan";
    if (/jiu|bjj|gracie/.test(t)) return "bjj";
    if (/judo/.test(t)) return "judo";
    if (/muay|thai boxing|kickbox/.test(t)) return "muaythai";
    if (/taekwondo|tae kwon|tkd/.test(t)) return "taekwondo";
    if (/catch|wrestling/.test(t)) return "catch";
    return "general";
  }

  // ---- Level mixes -------------------------------------------------------------
  var LEVEL_MIXES = ["beginner", "mixed", "advanced"];
  function levelMixLabel(mix) {
    return mix === "beginner" ? "Mostly beginners"
      : mix === "advanced" ? "Advanced class" : "Mixed levels";
  }
  // A Curriculum Builder rotation's phase is a fair default for the
  // mix: early rotations teach beginners, late ones run advanced.
  function mixForPhase(phase) {
    var p = String(phase || "").toLowerCase();
    if (p.indexOf("found") !== -1) return "beginner";
    if (p.indexOf("test") !== -1 || p.indexOf("integrat") !== -1) return "advanced";
    return "mixed";
  }

  // ---- The exact-sum allocator -------------------------------------------------
  // Distribute `total` whole minutes across segments by weight, with
  // per-segment floors, so the result sums EXACTLY to total. Largest
  // remainder after floors; any leftover goes to the largest weights.
  // Segments with weight 0 always get 0. Returns an array of ints.
  function allocate(total, weights, floors) {
    var n = weights.length;
    var out = new Array(n).fill(0);
    var active = [];
    var floorSum = 0;
    for (var i = 0; i < n; i++) {
      if (weights[i] > 0) {
        out[i] = Math.min(floors[i] || 0, total); // provisional
        floorSum += out[i];
        active.push(i);
      }
    }
    if (!active.length) return out;
    if (floorSum > total) {
      // Floors alone exceed the class: scale them down by weight order,
      // largest weight keeps its floor longest. Walk down minute by
      // minute from the smallest-weight segment until we fit.
      var order = active.slice().sort(function (a, b) { return weights[a] - weights[b]; });
      var oi = 0;
      while (floorSum > total) {
        var idx = order[oi % order.length];
        if (out[idx] > 0) { out[idx] -= 1; floorSum -= 1; }
        oi += 1;
        if (oi > 10000) break;
      }
      return out;
    }
    var rest = total - floorSum;
    var wSum = 0;
    active.forEach(function (i) { wSum += weights[i]; });
    var remainders = [];
    active.forEach(function (i) {
      var exact = rest * (weights[i] / wSum);
      var whole = Math.floor(exact);
      out[i] += whole;
      rest -= whole;
      remainders.push({ i: i, frac: exact - whole });
    });
    remainders.sort(function (a, b) { return b.frac - a.frac; });
    for (var k = 0; k < rest; k++) out[remainders[k % remainders.length].i] += 1;
    return out;
  }

  // ---- Generation ----------------------------------------------------------------
  var SEGMENT_KINDS = ["warmup", "technique", "partner", "live", "conditioning", "cooldown"];

  // Minutes weights per level mix. Live practice is 0 for beginners
  // (their "live" time is folded into partner drills) and conditioning
  // drops out of very short classes — a 2-minute conditioning block
  // is a rounding error, not training.
  function weightsFor(total, mix) {
    var w = {
      beginner: { warmup: 0.13, technique: 0.42, partner: 0.30, live: 0, conditioning: 0.05, cooldown: 0.10 },
      mixed:    { warmup: 0.11, technique: 0.35, partner: 0.24, live: 0.15, conditioning: 0.06, cooldown: 0.09 },
      advanced: { warmup: 0.10, technique: 0.29, partner: 0.20, live: 0.25, conditioning: 0.08, cooldown: 0.08 }
    }[mix] || { warmup: 0.11, technique: 0.35, partner: 0.24, live: 0.15, conditioning: 0.06, cooldown: 0.09 };
    var out = {};
    SEGMENT_KINDS.forEach(function (k) { out[k] = w[k]; });
    if (total < 40 && mix === "beginner") out.conditioning = 0;
    if (total < 35 && mix === "mixed") out.conditioning = 0;
    if (total < 30) out.conditioning = 0;
    return out;
  }

  function floorsFor(total) {
    return {
      warmup: total >= 30 ? 4 : 3,
      technique: 8, partner: 5, live: 5, conditioning: 3, cooldown: 3
    };
  }

  function makeSegment(profileId, kind, minutes, items, note, titleOverride) {
    return {
      id: uid(),
      kind: kind,
      title: cleanText(titleOverride || segmentLabel(profileId, kind), 80),
      minutes: Math.max(0, Math.round(minutes) || 0),
      items: (items || []).map(function (s) { return cleanText(s, 120); }).filter(Boolean),
      note: cleanText(note || "", 280)
    };
  }

  // Build the full timed plan. `techniques` is an array of names
  // (strings) or { name, category } — category is preserved in the
  // segment item text only when it adds information (the Curriculum
  // Builder's categories read as the class's own structure).
  function generateSegments(opts) {
    var profileId = PROFILE_IDS.indexOf(opts.art) !== -1 ? opts.art : "general";
    var profile = profileById(profileId);
    var total = clampInt(opts.classMinutes, 10, 240, 45);
    var mix = LEVEL_MIXES.indexOf(opts.levelMix) !== -1 ? opts.levelMix : "mixed";
    var techs = (opts.techniques || []).map(function (t) {
      if (typeof t === "string") return { name: cleanText(t, 120), category: "" };
      return { name: cleanText(t && t.name, 120), category: cleanText(t && t.category, 80) };
    }).filter(function (t) { return t.name; });

    var weights = weightsFor(total, mix);
    var floors = floorsFor(total);
    var kinds = SEGMENT_KINDS.filter(function (k) { return weights[k] > 0; });
    var minutes = allocate(total,
      kinds.map(function (k) { return weights[k]; }),
      kinds.map(function (k) { return floors[k]; }));
    var byKind = {};
    kinds.forEach(function (k, i) { byKind[k] = minutes[i]; });

    var segments = [];
    segments.push(makeSegment(profileId, "warmup", byKind.warmup || 0, [],
      mix === "beginner" ? "Raise the temperature, move every joint, finish with the movement patterns today's techniques need."
                         : "Raise the temperature and rehearse the movement patterns today's techniques need."));

    // Technique time: two blocks once there are enough techniques to
    // make a break worthwhile, one block otherwise.
    var techMinutes = byKind.technique || 0;
    if (techs.length >= 4 && techMinutes >= 16) {
      var half = Math.ceil(techs.length / 2);
      var first = Math.round(techMinutes / 2);
      segments.push(makeSegment(profileId, "technique", first,
        techs.slice(0, half).map(itemText), ""));
      segments.push(makeSegment(profileId, "technique", techMinutes - first,
        techs.slice(half).map(itemText), "", segmentLabel(profileId, "technique") + " — second block"));
    } else {
      segments.push(makeSegment(profileId, "technique", techMinutes,
        techs.map(itemText), techs.length ? "" : "Add the techniques this class teaches."));
    }

    if (byKind.partner) {
      segments.push(makeSegment(profileId, "partner", byKind.partner,
        techs.map(function (t) { return t.name; }), profile.drillsNote));
    }
    if (byKind.live) {
      segments.push(makeSegment(profileId, "live", byKind.live, [], profile.liveNote));
    }
    if (byKind.conditioning) {
      segments.push(makeSegment(profileId, "conditioning", byKind.conditioning, [],
        "Short and honest: the conditioning serves the art — legs, grips, core, breathing under effort."));
    }
    segments.push(makeSegment(profileId, "cooldown", byKind.cooldown || 0, [],
      "Slow the breathing down, stretch what the class loaded, and say what next class builds on."));

    return segments;

    function itemText(t) {
      return t.category ? t.name + " (" + t.category + ")" : t.name;
    }
  }

  function totalMinutes(segments) {
    return (segments || []).reduce(function (sum, s) { return sum + (Math.round(Number(s.minutes)) || 0); }, 0);
  }

  // Rescale edited segments so they sum exactly to `target`, keeping
  // each segment's share. Zero-minute segments stay zero unless every
  // segment is zero (then the target is split evenly). Minimum 1 for
  // any segment that had minutes, while the total allows it.
  function rebalance(segments, target) {
    target = clampInt(target, 1, 600, 45);
    var list = (segments || []).map(function (s) {
      return { s: s, m: Math.max(0, Math.round(Number(s.minutes)) || 0) };
    });
    var sum = list.reduce(function (a, b) { return a + b.m; }, 0);
    var weights, floors;
    if (sum === 0) {
      weights = list.map(function () { return 1; });
      floors = list.map(function () { return 0; });
    } else {
      weights = list.map(function (e) { return e.m; });
      floors = list.map(function (e) { return e.m > 0 ? 1 : 0; });
    }
    var mins = allocate(target, weights, floors);
    return list.map(function (e, i) {
      var copy = {};
      for (var k in e.s) copy[k] = e.s[k];
      copy.minutes = mins[i];
      return copy;
    });
  }

  // Cumulative clock offsets for display/print. Returns copies with
  // `start` and `end` (minutes from class start). When startTime
  // ("18:05") is given, also `startClock`/`endClock` ("6:05 PM").
  function withClock(segments, startTime) {
    var start = parseClock(startTime);
    var t = 0;
    return (segments || []).map(function (s) {
      var copy = {};
      for (var k in s) copy[k] = s[k];
      var m = Math.max(0, Math.round(Number(s.minutes)) || 0);
      copy.start = t;
      copy.end = t + m;
      if (start !== null) {
        copy.startClock = fmtClock(start + t);
        copy.endClock = fmtClock(start + t + m);
      }
      t += m;
      return copy;
    });
  }
  function parseClock(v) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(v || "").trim());
    if (!m) return null;
    var h = +m[1], min = +m[2];
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  }
  function fmtClock(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    var h24 = Math.floor(mins / 60), m = mins % 60;
    var ap = h24 >= 12 ? "PM" : "AM";
    var h = h24 % 12; if (h === 0) h = 12;
    return h + ":" + (m < 10 ? "0" : "") + m + " " + ap;
  }
  function fmtOffset(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? h + ":" + (m < 10 ? "0" : "") + m : "0:" + (m < 10 ? "0" : "") + m;
  }

  // ---- Plans ---------------------------------------------------------------------
  function newPlan(opts) {
    opts = opts || {};
    var profileId = PROFILE_IDS.indexOf(opts.art) !== -1 ? opts.art : "general";
    var classMinutes = clampInt(opts.classMinutes, 10, 240, 45);
    var mix = LEVEL_MIXES.indexOf(opts.levelMix) !== -1 ? opts.levelMix : "mixed";
    var now = new Date().toISOString();
    return {
      id: uid(),
      name: cleanText(opts.name || "", 90) || defaultPlanName(profileId, classMinutes),
      art: profileId,
      source: opts.source === "curriculum" ? "curriculum" : "standalone",
      sourceRef: sanitizeSourceRef(opts.sourceRef),
      classMinutes: classMinutes,
      levelMix: mix,
      startTime: parseClock(opts.startTime) !== null ? String(opts.startTime).trim() : "",
      segments: generateSegments({ art: profileId, classMinutes: classMinutes, levelMix: mix, techniques: opts.techniques || [] }),
      notes: cleanText(opts.notes || "", 600),
      createdAt: now, updatedAt: now
    };
  }
  function defaultPlanName(profileId, classMinutes) {
    return profileLabel(profileId) + " — " + classMinutes + "-minute class";
  }
  function sanitizeSourceRef(ref) {
    if (!ref || typeof ref !== "object") return null;
    var out = {
      curriculumId: cleanText(ref.curriculumId, 60),
      curriculumName: cleanText(ref.curriculumName, 90),
      lessonNumber: clampInt(ref.lessonNumber, 0, 999, 0),
      week: clampInt(ref.week, 0, 999, 0),
      phase: cleanText(ref.phase, 40)
    };
    return out.curriculumId ? out : null;
  }

  // A saved Curriculum Builder lesson becomes plan input: lesson_items
  // carry category_name + requirement_name snapshots, which map
  // directly onto the technique list the generator consumes.
  function techniquesFromLessonItems(items) {
    return (items || []).map(function (it) {
      return {
        name: cleanText(it && (it.requirement_name || it.requirementName), 120),
        category: cleanText(it && (it.category_name || it.categoryName), 80)
      };
    }).filter(function (t) { return t.name; });
  }

  // ---- Sanitising saved state ------------------------------------------------------
  function sanitizeSegment(raw) {
    if (!raw || typeof raw !== "object") return null;
    var kind = SEGMENT_KINDS.indexOf(raw.kind) !== -1 ? raw.kind : "custom";
    return {
      id: cleanText(raw.id, 40) || uid(),
      kind: kind,
      title: cleanText(raw.title, 80) || kind,
      minutes: clampInt(raw.minutes, 0, 600, 0),
      items: Array.isArray(raw.items) ? raw.items.map(function (s) { return cleanText(s, 120); }).filter(Boolean).slice(0, 40) : [],
      note: cleanText(raw.note, 280)
    };
  }
  function sanitizePlan(raw) {
    if (!raw || typeof raw !== "object") return null;
    var segments = Array.isArray(raw.segments) ? raw.segments.map(sanitizeSegment).filter(Boolean).slice(0, 20) : [];
    if (!segments.length) return null;
    return {
      id: cleanText(raw.id, 40) || uid(),
      name: cleanText(raw.name, 90) || "Untitled class plan",
      art: PROFILE_IDS.indexOf(raw.art) !== -1 ? raw.art : "general",
      source: raw.source === "curriculum" ? "curriculum" : "standalone",
      sourceRef: sanitizeSourceRef(raw.sourceRef),
      classMinutes: clampInt(raw.classMinutes, 10, 240, totalMinutes(segments) || 45),
      levelMix: LEVEL_MIXES.indexOf(raw.levelMix) !== -1 ? raw.levelMix : "mixed",
      startTime: parseClock(raw.startTime) !== null ? String(raw.startTime).trim() : "",
      segments: segments,
      notes: cleanText(raw.notes, 600),
      createdAt: cleanText(raw.createdAt, 40) || new Date().toISOString(),
      updatedAt: cleanText(raw.updatedAt, 40) || new Date().toISOString()
    };
  }
  function sanitizeState(raw) {
    var out = { v: 1, plans: [], activePlanId: null };
    if (!raw || typeof raw !== "object") return out;
    if (Array.isArray(raw.plans)) {
      out.plans = raw.plans.map(sanitizePlan).filter(Boolean).slice(0, 500);
    }
    var ids = {};
    out.plans.forEach(function (p) { ids[p.id] = true; });
    out.activePlanId = raw.activePlanId && ids[raw.activePlanId] ? raw.activePlanId : (out.plans[0] ? out.plans[0].id : null);
    return out;
  }

  // ---- Tier gating -------------------------------------------------------------------
  var FREE_PLAN_LIMIT = 3;
  function canCreatePlan(state, plan) {
    return plan === "instructor" || !state || !Array.isArray(state.plans) || state.plans.length < FREE_PLAN_LIMIT;
  }
  function canImport(plan) { return plan === "instructor"; }
  function canPrint(plan) { return plan === "instructor"; }

  var API = {
    PROFILES: PROFILES, PROFILE_IDS: PROFILE_IDS,
    LEVEL_MIXES: LEVEL_MIXES, SEGMENT_KINDS: SEGMENT_KINDS,
    FREE_PLAN_LIMIT: FREE_PLAN_LIMIT,
    uid: uid, cleanText: cleanText, clampInt: clampInt,
    profileById: profileById, profileLabel: profileLabel, segmentLabel: segmentLabel,
    mapArtText: mapArtText, levelMixLabel: levelMixLabel, mixForPhase: mixForPhase,
    allocate: allocate, weightsFor: weightsFor,
    generateSegments: generateSegments, totalMinutes: totalMinutes,
    rebalance: rebalance, withClock: withClock, parseClock: parseClock, fmtClock: fmtClock, fmtOffset: fmtOffset,
    newPlan: newPlan, defaultPlanName: defaultPlanName,
    techniquesFromLessonItems: techniquesFromLessonItems,
    sanitizeSegment: sanitizeSegment, sanitizePlan: sanitizePlan, sanitizeState: sanitizeState,
    canCreatePlan: canCreatePlan, canImport: canImport, canPrint: canPrint
  };
  global.MMCPLogic = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
