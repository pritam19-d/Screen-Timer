let totalTime = 0;
let currentDate = new Date().toDateString();
let lastActiveTime = null;

function resetDaily() {
  totalTime = 0;
  currentDate = new Date().toDateString();
  lastActiveTime = Date.now();
  chrome.storage.local.set({ screenTime: totalTime, savedDate: currentDate });
}

chrome.storage.local.get(["screenTime", "savedDate"], function (data) {
  totalTime = data.screenTime || 0;
  currentDate = data.savedDate || new Date().toDateString();
  if (currentDate !== new Date().toDateString()) resetDaily();
});

setInterval(() => {
  const today = new Date().toDateString();
  if (today !== currentDate) resetDaily();

  chrome.idle.queryState(60, function (state) {
    // 3 states = ["active", "idle", "locked"]

    if (state === "locked") {
      lastActiveTime = null;
      return;
    }

    if (lastActiveTime === null) {
      lastActiveTime = Date.now();
    } else {
      totalTime += Date.now() - lastActiveTime;
      lastActiveTime = Date.now();

      chrome.storage.local.set({
        screenTime: totalTime,
        savedDate: currentDate
      });
    }
  });
}, 1000);
