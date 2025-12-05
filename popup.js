// popup.js

function formatDigital(ms) {
  let sec = Math.floor(ms / 1000);
  let h = Math.floor(sec / 3600);
  let m = Math.floor((sec % 3600) / 60);
  let s = sec % 60;

  return (
    String(h).padStart(2, "0") + ":" +
    String(m).padStart(2, "0") + ":" +
    String(s).padStart(2, "0")
  );
}

function getToday() {
  return new Date().toDateString();
}

let baseMs = 0;
let lastTick = null;
let timerInterval = null;

function render(ms) {
  document.getElementById("timer").innerText = formatDigital(ms);
}

function stopLocalTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function startLocalTimer() {
  stopLocalTimer();
  lastTick = Date.now();

  timerInterval = setInterval(function () {
    const now = Date.now();
    const delta = now - lastTick;
    lastTick = now;

    baseMs += delta;
    render(baseMs);
  }, 1000);
}

function initPopup() {
  const today = getToday();

  chrome.storage.local.get(
    ["screenTime", "savedDate", "isFocused", "lastFocusTime"],
    function (data) {
      let screenTime = data.screenTime || 0;
      let savedDate = data.savedDate || today;
      const isFocused = data.isFocused || false;
      const lastFocusTime = data.lastFocusTime || null;

      // If data is from an older day, ignore it
      if (savedDate !== today) {
        screenTime = 0;
      } else if (isFocused && lastFocusTime) {
        // Add current active session from last focus until now
        screenTime += Date.now() - lastFocusTime;
      }

      baseMs = screenTime;
      render(baseMs);

      // Always animate locally when popup is open
      startLocalTimer();
    }
  );
}

// Reset button
document.getElementById("reset").onclick = function () {
  // Ask background to reset canonical state
  chrome.runtime.sendMessage(
    { type: "RESET_TODAY", isFocused: true }, // treat as focused after reset
    function () {
      baseMs = 0;
      render(0);
      startLocalTimer();
    }
  );
};

initPopup();
