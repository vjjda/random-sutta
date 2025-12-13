# Random Sutta Reader

A simple, focus-oriented reader for Early Buddhist Texts (EBT), designed for a seamless reading experience with robust offline capabilities.
Data is sourced from SuttaCentral's [Bilara](https://github.com/suttacentral/sc-data) project.

## 🌟 Key Features

- **Random Sutta:** Instantly discover a random discourse from the Nikayas.
- **Smart Hybrid Offline Mode:** - Automatically prioritizes cached data over network requests.
  - Supports full offline capability via a downloadable "DB Bundle".
  - Works seamlessly on `localhost` or static hosting.
- **Magic Navigation:** Integrated Breadcrumbs and Table of Contents (TOC) for easy context awareness.
- **Bilingual View:** Parallel display of Pāli and English (Bhante Sujato's translation).
- **Deep Linking:** Support for specific segments (e.g., `dn1:1.2`) and "Quicklook" previews for cross-references.
- **Customization:** Dark Mode, Sepia (Night Shift) mode, and adjustable font sizes.

## 🛠️ System Requirements

For building the data assets from source:

- **Python 3.8+**
- **Git**
- **Make** (Optional, but recommended for easy commands)
- Internet connection (to fetch raw data from SuttaCentral).

## 🚀 Installation & Build Guide

### 1\. Clone the repository

```bash
git clone https://github.com/vjjda/random-sutta.git
cd random-sutta
```

### 2\. Fetch Raw Data

The project requires raw data (Bilara texts & API metadata). You can sync everything using the provided Makefile:

```bash
# Installs git hooks and sets up environment
make setup

# Fetches Bilara data and API metadata
make sync
```

### 3\. Build Assets (Processor)

Convert raw JSON data into optimized JavaScript assets for the web app.

```bash
# Runs the Sutta Processor
make data
```

### 4\. Run Locally

Start a local development server to preview the app.

```bash
# Starts server at http://localhost:8000
make dev
```

## 🐞 Development & Debugging

The application includes a built-in Logger and Performance Timer system.

### Enabling Debug Mode

To view verbose logs, performance metrics (rendering time, fetch latency), and internal state transitions, append `?debug=1` or `?debug=true` to the URL.

**Example:**
`http://localhost:8000/?q=mn1&debug=1`

### What to look for in Console

- **⏱️ Render:** Time taken to process and render a Sutta.
- **📥 Data Fetch:** Time taken to retrieve data (helps verify if data is coming from Cache vs. Network).
- **⚡ Random Process:** Total time for the randomization logic.
- **[DEBUG] / [INFO]:** Detailed logs from internal modules (`SuttaController`, `SuttaRepository`, `PopupManager`, etc.).

## 📂 Project Structure

- `src/`: Python source code (Build Tools).
  - `sutta_fetcher/`: Synchronizes raw data from Bilara Git.
  - `api_fetcher.py`: Fetches metadata from SuttaCentral API.
  - `sutta_processor/`: Core logic to convert JSON -\> Optimized JS Assets.
  - `release_system/`: Handles versioning, bundling, and deployment.
- `data/`: Raw downloaded data (ignored by Git).
- `web/`: Frontend Application (HTML/CSS/JS).
  - `assets/sutta/`: Generated data assets (The App Database).
  - `assets/modules/`: ES6 Modules for UI and Logic.
  - `sw.js`: Service Worker for caching and offline support.

## 🤝 Contributing

Contributions are welcome\! Please feel free to submit a Pull Request or open an Issue.

## 📄 License

- **Content:** SuttaCentral (Creative Commons Zero - CC0).
- **Source Code:** MIT License.
