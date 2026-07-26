# Nox-Safe Chrome Extension — Install Guide

<!-- GIF_PLACEHOLDER: replace the line below with your recorded install GIF -->
<!-- ![Install walkthrough](install-demo.gif) -->

> **Recording script is below** — follow it once, drop the output GIF here, and delete this comment.

---

## Install from ZIP (Developer Mode)

Four steps, under 60 seconds:

**1. Download the zip**

Download [`nox-safe-extension-v0.1.0.zip`](https://github.com/danielamodu/Nox-safe/releases) and unzip it to a permanent folder on your machine (e.g. `~/nox-safe-extension/`). Don't delete the folder after loading — Chrome reads the extension live from disk.

**2. Open Chrome Extensions**

Navigate to `chrome://extensions` in your address bar.

**3. Enable Developer Mode**

Toggle **Developer mode** in the top-right corner of the Extensions page.

**4. Load Unpacked**

Click **Load unpacked** → select the unzipped `extension/` folder → click **Select Folder**.

The Nox-Safe shield icon appears in your Chrome toolbar. Pin it for easy access.

---

## Using the Extension

- Go to [app.safe.global](https://app.safe.global) and open an existing Sepolia Safe.
- The extension auto-detects the Safe from the URL. Click the toolbar icon to see live oracle status, daily spend, and policy caps.
- On any Safe transaction page, a floating **Shield with Nox** button lets you encrypt and submit a confidential intent without leaving Safe's UI.

---

## Recording the Install GIF (2-minute script)

> Use [LICEcap](https://www.cockos.com/licecap/) (free, Windows/Mac) or [ScreenToGif](https://www.screentogif.com/) (Windows).

**Before you start:**
- Have the unzipped `extension/` folder ready on your Desktop.
- Close any extra tabs so Chrome Extensions is easy to navigate to.
- Set capture region to ~900×600 px centered on the browser window.
- Use 10 fps / 256 colors in LICEcap for a small file size.

**Steps to record (narrate with cursor movement, no audio needed):**

| # | Action | What viewer sees |
|---|--------|-----------------|
| 1 | Start recording. Open a Finder/Explorer window showing the unzipped `extension/` folder. | Folder with manifest.json visible |
| 2 | In Chrome address bar, type `chrome://extensions` and press Enter. | Extensions page loads |
| 3 | Hover over "Developer mode" toggle (top-right), then click it ON. | "Load unpacked" button appears |
| 4 | Click **Load unpacked** → navigate to / click the `extension/` folder → click **Select Folder**. | Nox-Safe card appears in the grid |
| 5 | Click the puzzle-piece icon in the toolbar → click the pin next to Nox-Safe. | Shield icon is pinned to toolbar |
| 6 | Click the Nox-Safe icon → popup opens showing "Connect your Safe" or live Safe data. | Popup UI is visible |
| 7 | Stop recording. | — |

Save as `install-demo.gif` and place it in this `extension/` folder. Then replace the placeholder comment at the top of this file with:

```markdown
![Install walkthrough](install-demo.gif)
```

**Target file size:** under 3 MB. If it's larger, reduce capture region or trim to steps 2–4 only.
