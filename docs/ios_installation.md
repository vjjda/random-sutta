# iOS Installation Guide (AltStore, Sideloadly & IPA)

This guide provides instructions on how to install and update **Random Sutta** on your iPhone or iPad. Since this app is not on the official App Store, you need to "sideload" it.

---

## Method 1: AltStore (Recommended)
AltStore allows for the easiest updates and source management.

### Step 1: Install AltStore on your Device
If you haven't installed AltStore yet, follow the official guide at [altstore.io](https://altstore.io).
1. Download AltServer for Mac or Windows.
2. Connect your iPhone to your computer via USB.
3. Click the AltServer icon in the menu bar/system tray and select **"Install AltStore"**.
4. Enter your Apple ID and password to sign the app.

### Step 2: Add Random Sutta Source
1. Open the **AltStore** app on your iPhone.
2. Go to the **"Sources"** tab.
3. Tap the **"+"** button (top right).
4. Paste the following URL:
   ```text
   https://raw.githubusercontent.com/vjjda/random-sutta/main/altstore.json
   ```
5. Tap **"Add Source"**.

### Step 3: Install & Update
- Go to the **"Browse"** tab, find **Random Sutta**, and tap **"FREE"**.
- To update, go to **"My Apps"** and tap **"Update"**. 
- *Note: You must be on the same Wi-Fi as your AltServer to refresh/update.*

---

## Method 2: Manual IPA Install (via AltStore)
If the Source method fails or you want to install a specific version:

1. **Download the IPA:** Open Safari on your iPhone and go to the [GitHub Releases](https://github.com/vjjda/random-sutta/releases) page. Download the `randomsutta.ipa` file.
2. **Transfer to AltStore:**
   - Option A: Open the downloaded file in the **Files** app, tap the **Share** icon, and choose **AltStore**.
   - Option B (For Developers): If your iPhone is connected via USB, run `make ios-copy` from the project root. This copies the IPA directly into the **Documents** app on your phone. Then, in AltStore, go to **"My Apps"**, tap the **"+"** (top left), and select the IPA from the Documents folder.

---

## Method 3: Sideloadly (Windows & Mac)
Sideloadly is a fast desktop alternative that doesn't require an app on the phone to manage installations.

1. **Download Sideloadly:** Get it from [sideloadly.io](https://sideloadly.io/).
2. **Download the IPA:** Download `randomsutta.ipa` from [GitHub Releases](https://github.com/vjjda/random-sutta/releases) to your computer.
3. **Connect Device:** Plug your iPhone/iPad into your computer via USB.
4. **Setup Sideloadly:**
   - Drag and drop the `randomsutta.ipa` into the Sideloadly window.
   - Enter your **Apple ID**.
   - Click **"Start"**.
5. **Verify:** Once "Done" appears, the app will be on your home screen.
   - *Note: Like AltStore, you must re-install/refresh every 7 days unless you have a paid developer account.*

---

## Important: Post-Installation Steps
After the first time you install the app using any method, you must trust the developer:
1. Open **Settings** on your iPhone.
2. Go to **General** > **VPN & Device Management**.
3. Tap on your **Apple ID**.
4. Tap **"Trust [Your Apple ID]"**.

---

## Troubleshooting
- **7-Day Limit:** Apps installed with a free Apple ID expire after 7 days. You must "Refresh" them in AltStore or re-sideload them to keep them working.

*May you be happy, may you be free from suffering.*
