(function () {
  "use strict";

  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const statusSub = document.getElementById("status-sub");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (tab && tab.url && tab.url.includes("app.safe.global")) {
      statusDot.classList.add("active");
      statusText.textContent = "Connected to Safe";
      statusSub.textContent = "Shield button is active on this page";
    } else {
      statusDot.classList.add("inactive");
      statusText.textContent = "Not on Safe app";
      statusSub.textContent = "Navigate to app.safe.global to use";
    }
  });

  document.getElementById("open-safe-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: "https://app.safe.global" });
    window.close();
  });

  document.getElementById("open-dashboard-btn").addEventListener("click", () => {
    chrome.tabs.create({ url: "http://localhost:5173" });
    window.close();
  });
})();
