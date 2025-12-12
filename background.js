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
    if (!tab || !tab.active || !tab.url) {
      activeDomain = null;
      return;
    }
    const url = tab.url;

    if (url.startsWith("chrome-extension://")) {
      activeDomain = null;
      return;
    }

    if (url.startsWith("chrome://") ||
        url.startsWith("edge://") ||
        url.startsWith("brave://")) {
      activeDomain = null;
      return;
    }

    if (url.startsWith("file://")) {
      activeDomain = null;
      return;
    }

    if (url.includes("popup.html") || url.includes("lookaway")) {
      activeDomain = null;
      return;
    }

    try {
      activeDomain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      activeDomain = null;
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


chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["reminderInterval", "lastReminder"], (res) => {
    if (typeof res.reminderInterval === "undefined") {
      chrome.storage.local.set({ reminderInterval: 0 });
    }
    if (typeof res.lastReminder === "undefined") {
      chrome.storage.local.set({ lastReminder: Date.now() });
    }
  });
});

function scheduleReminderAlarm(minutes) {
  chrome.alarms.clear("lookAwayReminder", () => {
    if (!minutes || Number(minutes) <= 0) {
      return;
    }
    chrome.alarms.create("lookAwayReminder", {
      periodInMinutes: Number(minutes)
    });
  });
}

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(["reminderInterval"], (res) => {
    scheduleReminderAlarm(Number(res.reminderInterval || 0));
  });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["reminderInterval"], (res) => {
    scheduleReminderAlarm(Number(res.reminderInterval || 0));
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;

  if (changes.reminderInterval) {
    const minutes = Number(changes.reminderInterval.newValue || 0);
    chrome.storage.local.set({ lastReminder: Date.now() }, () => {
      scheduleReminderAlarm(minutes);
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || alarm.name !== "lookAwayReminder") return;

  chrome.idle.queryState(60, (state) => {
    if (state === "locked") {
      return;
    }

    chrome.system.display.getInfo((info) => {
      const screen = info[0].workArea;
      const popupWidth = 360;
      const popupHeight = 360;

      const left = Math.round(screen.left + (screen.width - popupWidth) / 2);
      const top = Math.round(screen.top + (screen.height - popupHeight) / 2);

      chrome.windows.create({
        url: chrome.runtime.getURL("lookaway/lookaway.html"),
        type: "popup",
        width: popupWidth,
        height: popupHeight,
        left,
        top
      });
    });
  });
});