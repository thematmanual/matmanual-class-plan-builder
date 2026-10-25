/* Mat Manual idle sign-out — identical in every app; change everywhere or nowhere.
   Source of truth: ~/workspace/matmanual/mm-idle.js (see idle-signout.md).
   Byte-identical copies live in the website and in every account tool;
   the Training Timer has no accounts and does not carry it.

   Behaviour: after 55 minutes without real activity, a visible warning
   appears ("Still there? You'll be signed out in 5 minutes" with a
   "Stay signed in" button). At 60 minutes of inactivity the host app's
   onTimeout runs — each host wires that to its existing Supabase
   sign-out, which clears the shared .matmanual.com session, so the
   sign-out is global across the website and every tool.

   Activity is a real input event: mouse movement or press, a keypress,
   a touch, or a scroll. A slow reader scrolling a long article is
   active the whole time and is never signed out mid-read. Any
   interaction while the warning is up dismisses it and restarts the
   clock.

   Cross-tab: the last-activity timestamp is kept in localStorage
   ("mm-last-activity") and every tab's checker adopts the freshest
   stamp it sees, so activity in any one tab keeps them all alive.

   Host API:
     MM_IDLE.start(onTimeout [, { warnAfterMs, signOutAfterMs, checkMs }])
     MM_IDLE.stop()
     MM_IDLE.reset()  — record activity right now
   The option overrides exist for tests; production hosts pass none. */
(function () {
  "use strict";

  var WARN_AFTER_MS = 55 * 60 * 1000;
  var SIGN_OUT_AFTER_MS = 60 * 60 * 1000;
  var CHECK_MS = 5000;
  var STORE_KEY = "mm-last-activity";
  var ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "touchmove", "wheel", "pointerdown", "scroll"];

  var running = false;
  var onTimeout = null;
  var warnAfterMs = WARN_AFTER_MS;
  var signOutAfterMs = SIGN_OUT_AFTER_MS;
  var checkMs = CHECK_MS;
  var timer = null;
  var lastActivity = 0;
  var lastStoreWrite = 0;
  var warned = false;
  var warnEl = null;

  var CSS = "#mm-idle-warn{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483000;max-width:min(92vw,452px);background:#ffffff;color:#26292b;border:1px solid #cfc9ba;border-radius:12px;box-shadow:0 12px 34px rgba(20,22,24,.28);padding:14px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;font:15px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}"
    + "#mm-idle-warn .mm-idle-msg{margin:0;flex:1 1 220px}"
    + "#mm-idle-warn .mm-idle-btn{flex:none;background:#282d30;color:#ffffff;border:0;border-radius:8px;padding:9px 14px;font-family:inherit;font-size:14px;font-weight:600;cursor:pointer}"
    + "#mm-idle-warn .mm-idle-btn:hover{background:#3a4045}";

  function readStore() {
    try {
      var v = parseInt(window.localStorage.getItem(STORE_KEY) || "", 10);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch (e) { return 0; }
  }
  function writeStore(t) {
    try { window.localStorage.setItem(STORE_KEY, String(t)); } catch (e) { /* private mode etc. — this tab's own clock still runs */ }
  }

  function ensureStyle() {
    if (document.getElementById && document.getElementById("mm-idle-style")) return;
    var st = document.createElement("style");
    st.id = "mm-idle-style";
    st.textContent = CSS;
    (document.head || document.documentElement || document.body).appendChild(st);
  }

  function remainingPhrase(ms) {
    if (ms > 75000) {
      var mins = Math.round(ms / 60000);
      return mins === 1 ? "in 1 minute" : "in " + mins + " minutes";
    }
    return "in under a minute";
  }
  function updateWarningText() {
    if (!warnEl || !warnEl._msg) return;
    var remaining = signOutAfterMs - (Date.now() - lastActivity);
    warnEl._msg.textContent = "Still there? You'll be signed out " + remainingPhrase(Math.max(0, remaining)) + ".";
  }

  function showWarning() {
    ensureStyle();
    if (!warnEl) {
      warnEl = document.createElement("div");
      warnEl.id = "mm-idle-warn";
      warnEl.setAttribute("role", "alertdialog");
      warnEl.setAttribute("aria-live", "assertive");
      warnEl.setAttribute("aria-label", "You are about to be signed out for inactivity");
      var p = document.createElement("p");
      p.className = "mm-idle-msg";
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mm-idle-btn";
      b.textContent = "Stay signed in";
      b.addEventListener("click", function () { noteActivity(); });
      warnEl.appendChild(p);
      warnEl.appendChild(b);
      warnEl._msg = p;
    }
    updateWarningText();
    if (!warnEl.parentNode && document.body) document.body.appendChild(warnEl);
  }
  function hideWarning() {
    if (warnEl && warnEl.parentNode) warnEl.parentNode.removeChild(warnEl);
  }

  function noteActivity() {
    var t = Date.now();
    lastActivity = t;
    // Mousemove fires constantly; the shared stamp needs at most one
    // write a second to keep every other tab's checker honest.
    if (t - lastStoreWrite >= 1000) { lastStoreWrite = t; writeStore(t); }
    if (warned) { warned = false; hideWarning(); }
  }

  function check() {
    if (!running) return;
    var stored = readStore();
    if (stored > lastActivity) {
      // Another tab was active more recently than this one.
      lastActivity = stored;
      if (warned) { warned = false; hideWarning(); }
    }
    var idleFor = Date.now() - lastActivity;
    if (idleFor >= signOutAfterMs) {
      var cb = onTimeout;
      stop();
      if (cb) cb();
      return;
    }
    if (idleFor >= warnAfterMs) {
      if (!warned) { warned = true; showWarning(); }
      else updateWarningText();
    }
  }

  var activityHandler = function () { noteActivity(); };
  var storageHandler = function (e) { if (!e || e.key === STORE_KEY || e.key === null) check(); };
  var visibilityHandler = function () { if (!document.hidden) check(); };

  function bind() {
    ACTIVITY_EVENTS.forEach(function (ev) {
      window.addEventListener(ev, activityHandler, { passive: true, capture: ev === "scroll" });
    });
    window.addEventListener("storage", storageHandler);
    if (document.addEventListener) document.addEventListener("visibilitychange", visibilityHandler);
  }
  function unbind() {
    ACTIVITY_EVENTS.forEach(function (ev) {
      window.removeEventListener(ev, activityHandler, ev === "scroll");
    });
    window.removeEventListener("storage", storageHandler);
    if (document.removeEventListener) document.removeEventListener("visibilitychange", visibilityHandler);
  }

  function start(cb, options) {
    if (options) {
      warnAfterMs = options.warnAfterMs || WARN_AFTER_MS;
      signOutAfterMs = options.signOutAfterMs || SIGN_OUT_AFTER_MS;
      checkMs = options.checkMs || CHECK_MS;
      // Hosts re-start on every session event; with explicit options
      // (tests) the checker cadence follows the new values.
      if (running && timer !== null) { clearInterval(timer); timer = setInterval(check, checkMs); }
    }
    onTimeout = cb || null;
    if (running) return;
    running = true;
    warned = false;
    // A fresh page load is itself presence. Honour a recent stamp from
    // another tab; ignore a stale one left behind by a long-closed tab
    // rather than signing a just-arrived user straight back out.
    var stored = readStore();
    var t = Date.now();
    if (stored && t - stored < signOutAfterMs) {
      lastActivity = stored;
    } else {
      lastActivity = t;
      lastStoreWrite = t;
      writeStore(t);
    }
    bind();
    timer = setInterval(check, checkMs);
  }

  function stop() {
    if (!running) return;
    running = false;
    onTimeout = null;
    if (timer !== null) { clearInterval(timer); timer = null; }
    unbind();
    warned = false;
    hideWarning();
  }

  window.MM_IDLE = {
    start: start,
    stop: stop,
    reset: noteActivity,
    WARN_AFTER_MS: WARN_AFTER_MS,
    SIGN_OUT_AFTER_MS: SIGN_OUT_AFTER_MS,
    _lastActivity: function () { return lastActivity; },
    _isRunning: function () { return running; },
    _isWarned: function () { return warned; }
  };
})();
