// File: next-challenge.js
// Purpose: send "Lets Go!" to the correct next challenge for this user.

(function () {
  // default fallback (in case progress hasn't loaded yet)
  let nextChallengeUrl = "/Challenges/Challenge1/challenge.html";

  // Decide which challenge the player should do next.
  // Uses the cached completion info from progress.js.
  function computeNextChallenge() {
    // Check Challenges 1 -> 10 in order
    for (let i = 1; i <= 10; i++) {
      // If this challenge is NOT completed, that's our target
      if (!window.Progress || !Progress.hasCompleted(i)) {
        nextChallengeUrl = `/Challenges/Challenge${i}/challenge.html`;
        return nextChallengeUrl;
      }
    }

    // If we got here, 1-10 are all completed -> go to Endless/Random
    nextChallengeUrl = "/Challenges/Random/challenge.html";
    return nextChallengeUrl;
  }

  // Handle the click on the big button
  function handleClick() {
    // just to be safe, recompute right before navigating
    computeNextChallenge();
    window.location.href = nextChallengeUrl;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("next-challenge-btn");
    if (!btn) return;

    // Kick off server fetch of progress/points
    if (window.Progress && typeof Progress.init === "function") {
      Progress.init();
    }

    // As soon as progress.js tells us it has fresh progress,
    // recalc the destination.
    window.addEventListener("progress:updated", (ev) => {
      if (ev.detail && ev.detail.type === "progress") {
        computeNextChallenge();
      }
    });

    // Also compute once on load (covers the case where cache is already there)
    computeNextChallenge();

    // Wire up the button
    btn.addEventListener("click", handleClick);
  });
})();
