// File: Website/Challenges/progress.js
// Purpose: Centralised progress + points helpers for all challenges and the selector page.
// Usage:
//   1) Include on pages that need it:
//        <script defer src="Challenges/progress.js"></script>
//   2) Call Progress.init() after loading to fetch server data.
//   3) Mark a challenge complete (optionally add points and/or count a repeat run):
//        Progress.markComplete(2, { points: 50, countRun: true });
//      - or the global shorthand:
//        markChallengeComplete(2, { points: 50, countRun: true });
//
// Notes:
// - Progress and points are now stored on the server and cached locally.
// - Runs (for endless/repeatable levels) remain in localStorage.
// - Requires user to be logged in (user.id in localStorage).

(function () {
  // INTEGRATION CHANGE: Added in-memory cache for server data to allow synchronous checks.
  let userProgress = {}; // Cached { [challengeId]: true } from server
  let userPoints = 0; // Cached points from server
  let userId = null; // Cached user ID

  // INTEGRATION CHANGE: Helper to get user ID from localStorage.
  function getUserId() {
    try {
      const user = JSON.parse(localStorage.getItem('user') || 'null');
      return user && user.id ? user.id : null;
    } catch {
      return null;
    }
  }

  // INTEGRATION CHANGE: Async function to fetch progress and points from server and cache them.
  async function fetchProgress() {
    userId = getUserId();
    if (!userId) return; // Not logged in, skip
    try {
      const res = await fetch(`/api/user/${userId}/points`);
      if (!res.ok) throw new Error('Failed to fetch progress');
      const data = await res.json();
      userProgress = {};
      data.completed.forEach(id => userProgress[id] = true);
      userPoints = data.points || 0;
      // INTEGRATION CHANGE: Dispatch event to update UI after fetching.
      window.dispatchEvent(new CustomEvent('progress:updated', { detail: { type: 'progress', value: userProgress } }));
      window.dispatchEvent(new CustomEvent('progress:updated', { detail: { type: 'points', value: userPoints } }));
    } catch (e) {
      console.error('Error fetching progress from server:', e);
    }
  }

  // ---- internal utils ----
  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // ---- progress helpers ----
  // INTEGRATION CHANGE: getProgress now returns cached server data instead of localStorage.
  function getProgress() {
    return { ...userProgress };
  }
  // INTEGRATION CHANGE: setProgress now updates cache and dispatches event (used internally after server updates).
  function setProgress(p) {
    userProgress = { ...p };
    window.dispatchEvent(new CustomEvent('progress:updated', { detail: { type: 'progress', value: userProgress } }));
  }
  // INTEGRATION CHANGE: hasCompleted checks cached server data.
  function hasCompleted(n) {
    return !!userProgress[n];
  }
  // INTEGRATION CHANGE: markChallengeComplete now sends to server, updates cache, and dispatches events.
  async function markChallengeComplete(n, opts = {}) {
    const { points = 0, countRun = false } = opts;
    if (!userId) return; // Not logged in
    if (userProgress[n]) {
      // Already completed, just dispatch event for UI update
      window.dispatchEvent(new CustomEvent('progress:updated', { detail: { type: 'progress', value: userProgress } }));
      return;
    }
    try {
      const res = await fetch(`/api/user/${userId}/complete-challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: n, pointsEarned: points })
      });
      if (!res.ok) throw new Error('Failed to mark complete');
      const data = await res.json();
      userProgress[n] = true;
      userPoints = data.newPoints || userPoints + points;
      setProgress(userProgress); // Update cache and dispatch
      window.dispatchEvent(new CustomEvent('progress:updated', { detail: { type: 'points', value: userPoints } }));
    } catch (e) {
      console.error('Error marking challenge complete:', e);
    }
    if (countRun) incrementRuns(n);
  }
  // INTEGRATION CHANGE: clearChallenge now updates cache (though server doesn't have a delete endpoint, so this is local-only for now).
  function clearChallenge(n) {
    delete userProgress[n];
    setProgress(userProgress);
  }
  // INTEGRATION CHANGE: resetAllProgress clears cache (server reset not implemented).
  function resetAllProgress() {
    userProgress = {};
    setProgress(userProgress);
  }

  // ---- run counters (for infinite/repeatable levels) ----
  // INTEGRATION CHANGE: Runs remain in localStorage (not on server yet).
  const KEYS = {
    RUNS: 'challengeRuns',
  };
  function getRunsMap() {
    return readJSON(KEYS.RUNS, {});
  }
  function setRunsMap(m) {
    writeJSON(KEYS.RUNS, m || {});
    window.dispatchEvent(new CustomEvent('progress:updated', { detail: { type: 'runs', value: m } }));
  }
  function getRuns(n) {
    const m = getRunsMap();
    return Number(m[n] || 0);
  }
  function incrementRuns(n, delta = 1) {
    const m = getRunsMap();
    m[n] = Number(m[n] || 0) + (Number(delta) || 0);
    setRunsMap(m);
    return m[n];
  }
  function resetRuns(n) {
    const m = getRunsMap();
    if (n == null) {
      setRunsMap({});
    } else {
      delete m[n];
      setRunsMap(m);
    }
  }

  // ---- points helpers ----
  // INTEGRATION CHANGE: getPoints returns cached server data.
  function getPoints() {
    return userPoints;
  }
  // INTEGRATION CHANGE: setPoints sends to server and updates cache.
  async function setPoints(v) {
    const next = Math.max(0, Number(v) || 0);
    if (!userId) return next;
    try {
      const res = await fetch(`/api/user/${userId}/points`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points: next })
      });
      if (!res.ok) throw new Error('Failed to update points');
      userPoints = next;
      window.dispatchEvent(new CustomEvent('progress:updated', { detail: { type: 'points', value: userPoints } }));
    } catch (e) {
      console.error('Error updating points:', e);
    }
    return userPoints;
  }
  // INTEGRATION CHANGE: addPoints uses setPoints.
  async function addPoints(amount) {
    const next = userPoints + (Number(amount) || 0);
    return await setPoints(next);
  }

  // ---- convenience for endless/random level ----
  // INTEGRATION CHANGE: completeRun remains localStorage-based for runs.
  function completeRun(n, opts = {}) {
    const { pointsPerRun = 0 } = opts;
    incrementRuns(n, 1);
    if (pointsPerRun) addPoints(pointsPerRun); // This now goes to server
    window.dispatchEvent(new CustomEvent('progress:updated', { detail: { type: 'runComplete', level: n } }));
  }

  // Public API
  const api = {
    // progress
    getProgress, setProgress, hasCompleted, markChallengeComplete, clearChallenge, resetAllProgress,
    // runs
    getRuns, incrementRuns, resetRuns,
    // points
    getPoints, setPoints, addPoints,
    // endless helpers
    completeRun,
    // keys (for runs)
    keys: { ...KEYS },
    // INTEGRATION CHANGE: Added init function to fetch server data.
    init: fetchProgress,
  };

  // Expose under a namespaced object
  window.Progress = api;

  // Also expose a few global shorthands to avoid refactors
  window.getProgress = getProgress;
  window.markChallengeComplete = markChallengeComplete;
  window.getPoints = getPoints;
  window.addPoints = addPoints;
  window.completeRun = completeRun;
})();