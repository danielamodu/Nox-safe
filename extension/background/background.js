(function () {
  "use strict";

  chrome.action.onClicked.addListener((tab) => {
    if (tab.url && tab.url.includes("app.safe.global")) {
      chrome.tabs.sendMessage(tab.id, { type: "OPEN_NOX_MODAL" });
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_SETTINGS") {
      chrome.storage.local.get(["noxModule", "safeAddress"], (result) => {
        sendResponse(result);
      });
      return true;
    }

    if (message.type === "SAVE_SETTINGS") {
      chrome.storage.local.set(message.data, () => {
        sendResponse({ success: true });
      });
      return true;
    }
  });
})();
