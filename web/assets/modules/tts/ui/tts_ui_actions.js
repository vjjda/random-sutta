// Path: web/assets/modules/tts/ui/tts_ui_actions.js
import { AppConfig } from '../../core/app_config.js'; // [NEW]

export const TTSUIActions = {
    bind(orchestrator, renderer) {
        const els = renderer.elements;

        // 1. Magic Corner Trigger: BẮT ĐẦU SESSION
        els.trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            orchestrator.startSession();
        });

        // 2. Close Button: KẾT THÚC SESSION (Thoát hẳn)
        els.btnClose.addEventListener("click", (e) => {
            e.stopPropagation();
            orchestrator.endSession();
        });

        // Controls cơ bản
        els.btnPlay.addEventListener("click", () => orchestrator.togglePlay());
        els.btnPrev.addEventListener("click", () => orchestrator.prev());
        els.btnNext.addEventListener("click", () => orchestrator.next());
        
        els.btnSettings.addEventListener("click", (e) => {
            e.stopPropagation();
            renderer.toggleSettings();
        });

        // Settings Inputs
        els.rateRange.addEventListener("input", (e) => {
            const val = e.target.value;
            renderer.elements.rateVal.textContent = val;
            orchestrator.engine.setRate(val);
        });
        els.voiceSelect.addEventListener("change", (e) => {
            orchestrator.engine.setVoice(e.target.value);
        });
        els.autoNextCheckbox.addEventListener("change", (e) => {
            orchestrator.setAutoNext(e.target.checked);
        });

        // Click outside to close settings
        document.addEventListener("click", (e) => {
            if (!els.settingsPanel.classList.contains("hidden") && 
                !els.player.contains(e.target)) {
                renderer.closeSettings();
            }
        });

        // --- GLOBAL INTERACTIONS ---
        
        // [UPDATED] Trigger phụ: Double Tap vào Nav Title Display
        const navTitleDisplay = document.getElementById("nav-title-display");
        if (navTitleDisplay && AppConfig.TTS?.ENABLE_NAV_DOUBLE_TAP) {
            let navLastTap = 0;
            navTitleDisplay.addEventListener("click", (e) => {
                // Chỉ bắt sự kiện nếu click vào vùng trống hoặc text, tránh click vào nút search
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;

                const now = Date.now();
                const timeDiff = now - navLastTap;
                
                if (timeDiff < 300 && timeDiff > 50) {
                    // Double Tap Detected -> Start Session
                    orchestrator.startSession();
                    navLastTap = 0;
                } else {
                    navLastTap = now;
                }
            });
        }

        // [UPDATED] Segment Trigger: Chỉ hoạt động khi Session Active
        const container = document.getElementById("sutta-container");
        if (container) {
            let segmentLastTap = 0;
            
            container.addEventListener("click", (e) => {
                // Logic click/double-click cho Segment
                const segment = e.target.closest(".segment");
                
                if (segment) {
                    // [LOGIC MỚI] Kiểm tra Session Active trước
                    if (!orchestrator.isSessionActive()) {
                        // Nếu session chưa active -> Bỏ qua hoàn toàn (để dành cho Dictionary sau này)
                        return;
                    }

                    // Nếu Session Active -> Xử lý trigger đọc
                    // Bạn có thể chọn single click hoặc double click. 
                    // Với Reading Mode, single click thường tự nhiên hơn. 
                    // Nhưng code cũ dùng double click (để tránh bôi đen). Tôi giữ logic cũ nhưng thêm check session.
                    
                    const now = Date.now();
                    const timeDiff = now - segmentLastTap;

                    // [TWEAK] Chuyển sang Single Click cho nhạy nếu đã ở trong Session Active?
                    // Hoặc giữ Double Click để tránh conflict bôi đen. 
                    // Ở đây tôi giữ Double Click như logic cũ của bạn để an toàn.
                    if (timeDiff < 300 && timeDiff > 50) {
                        
                        // Check Selection
                        const selection = window.getSelection();
                        const hasSelection = selection && selection.toString().length > 0;

                        if (!hasSelection) {
                            orchestrator.jumpToID(segment.id);
                            if (selection) selection.removeAllRanges();
                        }
                        segmentLastTap = 0;
                        return;
                    }
                    segmentLastTap = now;
                }
            });
        }
    }
};