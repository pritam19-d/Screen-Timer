let totalTime = 0;
let currentDate = new Date().toDateString();
let lastActiveTime = null;
let chromeUsage = 0;
let siteStats = {};
let chromeFocused = false;
let activeDomain = null;

function resetDaily() {
  totalTime = 0;
  chromeUsage = 0;
  siteStats = {};
  currentDate = new Date().toDateString();
  lastActiveTime = Date.now();

  chrome.storage.local.set({
    screenTime: totalTime,
    chromeTime: chromeUsage,
    siteStats,
    savedDate: currentDate
  });
}

// Load saved data
chrome.storage.local.get(
  ["screenTime", "chromeTime", "siteStats", "savedDate"],
  function (data) {
    totalTime = data.screenTime || 0;
    chromeUsage = data.chromeTime || 0;
    siteStats = data.siteStats || {};
    currentDate = data.savedDate || new Date().toDateString();

    if (currentDate !== new Date().toDateString()) resetDaily();
  }
);

chrome.windows.onFocusChanged.addListener((winId) => {
  chromeFocused = winId !== chrome.windows.WINDOW_ID_NONE;
});

function updateDomain(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    if (tab && tab.active && tab.url) {
      try {
        const url = new URL(tab.url);
        activeDomain = url.hostname.replace(/^www\./, "");
      } catch (e) {
        activeDomain = null;
      }
    }
  });
}

chrome.tabs.onActivated.addListener((info) => updateDomain(info.tabId));

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab && tab.active && changeInfo.url) {
    updateDomain(tabId);
  }
});

setInterval(() => {
  const today = new Date().toDateString();
  if (today !== currentDate) {
    resetDaily();
  }

  chrome.idle.queryState(60, function (state) {
    // 3 states = ["active", "idle", "locked"]

    if (state === "locked") {
      lastActiveTime = null;
      return;
    }

    if (lastActiveTime === null) {
      lastActiveTime = Date.now();
    } else {
      const now = Date.now();
      const delta = now - lastActiveTime;
      lastActiveTime = now;
      totalTime += delta;

      if (chromeFocused) {
        chromeUsage += delta;

        if (activeDomain) {
          siteStats[activeDomain] =
            (siteStats[activeDomain] || 0) + delta;
        }
      }

      chrome.storage.local.set({
        screenTime: totalTime,
        chromeTime: chromeUsage,
        siteStats,
        savedDate: currentDate
      });
    }
  });
}, 1000);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "RESET_TODAY") {
    resetDaily();
    sendResponse({ ok: true });
  }
});
