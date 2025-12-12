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
  const top5Title = document.getElementById("top5-title")
  const allBlock = document.getElementById("all-sites-block"); // keep HTML intact but hide
  allBlock.style.display = "none"; // disable old block

  topUl.innerHTML = "";

  const entries = Object.entries(siteStats).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    topUl.innerHTML = "<li>No data yet</li>";
    return;
  }

  const top5 = entries.slice(0, 5);
  const rest = entries.slice(5);

  // Render Top 5
  top5.forEach(([domain, ms], index) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${index + 1}. ${domain}</span><span>${formatDigital(ms)}</span>`;
    topUl.appendChild(li);
  });

  // If only 5 items, no Show More button needed
  if (rest.length === 0) return;

  // Render hidden items (#6+)
  rest.forEach(([domain, ms], index) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${index + 6}. ${domain}</span><span>${formatDigital(ms)}</span>`;
    li.style.display = "none"; // hidden initially
    li.dataset.expandable = "1";
    topUl.appendChild(li);
  });

  // Show More / Show Less button
  const btn = document.createElement("button");
  btn.className = "show-more-btn";
  btn.innerText = "Show More";

  btn.onclick = () => {
    const items = topUl.querySelectorAll("[data-expandable='1']");
    const expanding = btn.innerText === "Show More";

    if (expanding) {
      items.forEach(li => li.style.display = "");
      btn.innerText = "Show Less";
      top5Title.innerText = "All Your Visited Sites"
    } else {
      items.forEach(li => li.style.display = "none");
      btn.innerText = "Show More";
      top5Title.innerText = "Top 5 Most Used Sites"
    }
  };

  topUl.appendChild(btn);
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
  setupReminderDropdown();

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
  updateThemeLabel(theme);
}

function loadTheme() {
  chrome.storage.local.get(["theme"], (res) => {
    const theme = res.theme || "dark";
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

function updateThemeLabel(theme) {
  const label = document.getElementById("themeLabel");
  if (!label) return;

  label.textContent = theme === "dark"
    ? "Mode: Dark"
    : "Mode: Light";
}

function setupReminderDropdown() {
  const select = document.getElementById("reminderSelect");
  if (!select) return;

  // Load saved interval
  chrome.storage.local.get(["reminderInterval"], (res) => {
    select.value = res.reminderInterval || "0";
  });

  select.addEventListener("change", () => {
    chrome.storage.local.set({
      reminderInterval: Number(select.value),
      lastReminder: Date.now()
    });
  });
}

initPopup();
