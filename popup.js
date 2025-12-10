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

function renderScreenTime(ms) {
  const el = document.getElementById("timer");
  if (el) el.innerText = formatDigital(ms);
}

function renderChromeTime(ms) {
  const el = document.getElementById("chromeTimer");
  if (el) el.innerText = formatDigital(ms);
}

function renderSites(siteStats) {
  const topUl = document.getElementById("top-sites");
  const allUl = document.getElementById("all-sites");
  const allBlock = document.getElementById("all-sites-block");

  if (!topUl || !allUl) return;

  topUl.innerHTML = "";
  allUl.innerHTML = "";

  const entries = Object.entries(siteStats || {});

  if (entries.length === 0) {
    topUl.innerHTML = "<li>No data yet</li>";
    return;
  }

  entries.sort((a, b) => b[1] - a[1]);

  const top5 = entries.slice(0, 5);
  const rest = entries.slice(6, -1);

  top5.forEach(([domain, ms], i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${i+1 + ". " + domain}</span><span>${formatDigital(ms)}</span>`;
    topUl.appendChild(li);
  });

  if (!!rest) {
    allBlock.style.display = "block";
    rest.forEach(([domain, ms], i) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${i+6 + ". " + domain}</span><span>${formatDigital(ms)}</span>`;
      allUl.appendChild(li);
    });
  }
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
    renderScreenTime(baseMs);
  }, 1000);
}

function initPopup() {
  const today = getToday();

  loadTheme();
  setupThemeToggle();

  chrome.storage.local.get(
    ["screenTime", "chromeTime", "siteStats", "savedDate"],
    function (data) {
      let screenTime = data.screenTime || 0;
      let chromeTime = data.chromeTime || 0;
      let savedDate = data.savedDate || today;

      // If data is from an older day, ignore it
      if (savedDate !== today) {
        screenTime = 0;
        chromeTime = 0;
      }

      baseMs = screenTime;
      renderScreenTime(baseMs);
      renderChromeTime(chromeTime);
      renderSites(data.siteStats || {});
      startLocalTimer();
    }
  );
}

// Reset button
document.getElementById("reset").onclick = function () {
  if (!confirm("Reset today's usage?")) return;

  chrome.runtime.sendMessage(
    { type: "RESET_TODAY" },
    function () {
      baseMs = 0;
      renderScreenTime(0);
      renderChromeTime(0);
      renderSites({});
      startLocalTimer();
    }
  );
};

function applyTheme(theme) {
  const body = document.body;
  body.classList.remove("light", "dark");
  body.classList.add(theme);

  const toggle = document.getElementById("themeToggle");
  if (toggle) toggle.checked = theme === "dark";
}

function loadTheme() {
  chrome.storage.local.get(["theme"], (res) => {
    const theme = res.theme || "light";
    applyTheme(theme);
  });
}

function setupThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  toggle.addEventListener("change", () => {
    const theme = toggle.checked ? "dark" : "light";
    chrome.storage.local.set({ theme });
    applyTheme(theme);
  });
}

initPopup();
