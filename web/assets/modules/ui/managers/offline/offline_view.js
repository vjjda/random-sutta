// Path: web/assets/modules/ui/managers/offline/offline_view.js
const ICONS = {
    SYNC: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 5.5A11 11 0 0 0 12 2c-6.237 0-11.232 5.26-10.96 11.58C1.4 21.03 8.35 26 15 22.6M2.5 22v-6h6M2.66 18.5a11 11 0 0 0 19.8-7.3"></path></svg>`,
    CHECK: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    ALERT: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
    RESET: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>`
};

export const OfflineView = {
    elements: {},

    init() {
        this.elements = {
            footer: document.getElementById("drawer-footer"),
            btnDownload: document.getElementById("btn-download-offline"),
            btnUpdate: document.getElementById("btn-update-offline"),
            progressBar: document.getElementById("global-progress-bar"),
            label: document.querySelector("#btn-download-offline .label"),
            icon: document.querySelector("#btn-download-offline .icon")
        };

        // [NEW] Dynamically inject Reset Button
        const offlineWidget = document.querySelector(".offline-widget");
        if (offlineWidget && !document.getElementById("btn-reset-app")) {
            const btnReset = document.createElement("button");
            btnReset.id = "btn-reset-app";
            btnReset.className = "icon-only-btn hidden";
            btnReset.title = "Hard Reset (Fix Issues)";
            btnReset.innerHTML = ICONS.RESET;
            
            // Insert before btnUpdate or append
            if (this.elements.btnUpdate) {
                offlineWidget.insertBefore(btnReset, this.elements.btnUpdate);
            } else {
                offlineWidget.appendChild(btnReset);
            }
            this.elements.btnReset = btnReset;
        }

        return this.elements;
    },

    renderState(state, text = "", percent = 0) {
        const { footer, btnDownload, btnUpdate, btnReset, progressBar, label, icon } = this.elements;

        if (footer) {
            footer.classList.remove("syncing", "ready", "error");
            if (state) footer.classList.add(state);
        }

        if (btnDownload) {
            if (label) label.textContent = text;
            
            if (state === 'syncing') {
                btnDownload.disabled = true;
                btnDownload.style.cursor = 'wait';
                if (icon) icon.innerHTML = ICONS.SYNC;
            } else if (state === 'ready') {
                btnDownload.disabled = false;
                btnDownload.style.cursor = 'help';
                if (icon) icon.innerHTML = ICONS.CHECK;
            } else if (state === 'error') {
                btnDownload.disabled = false;
                btnDownload.style.cursor = 'pointer';
                if (icon) icon.innerHTML = ICONS.ALERT;
            } else {
                btnDownload.disabled = false;
                btnDownload.style.cursor = 'pointer';
            }
        }

        if (btnUpdate) {
            if (state === 'ready') btnUpdate.classList.remove('hidden');
            else btnUpdate.classList.add('hidden');
        }

        // [NEW] Show Reset button when Ready or Error
        if (btnReset) {
            if (state === 'ready' || state === 'error') btnReset.classList.remove('hidden');
            else btnReset.classList.add('hidden');
        }

        if (progressBar) {
            if (state === 'syncing') {
                progressBar.classList.add('active');
                progressBar.style.width = `${percent}%`;
            } else if (state === 'ready' || state === 'error') {
                progressBar.style.width = '100%';
                setTimeout(() => {
                    progressBar.classList.remove('active');
                    setTimeout(() => { 
                        if (!progressBar.classList.contains('active')) progressBar.style.width = '0%'; 
                    }, 300);
                }, 1500);
            }
        }
    },

    flashVersion(versionString) {
        if (!this.elements.label) return;
        const originalText = this.elements.label.textContent;
        this.elements.label.textContent = `v${versionString.replace('v', '')}`;
        
        setTimeout(() => {
            this.elements.label.textContent = originalText;
        }, 3000);
    }
};