// Path: web/assets/modules/tts/core/tts_session_manager.js
import { TTSStateStore } from './tts_state_store.js';
import { TTSDOMParser } from './tts_dom_parser.js';
import { TTSMarkerManager } from './tts_marker_manager.js';
import { getLogger } from 'utils/logger.js';
import { TextSplitter } from 'utils/text_splitter.js';
import { AppConfig } from 'core/app_config.js';

const logger = getLogger("TTS_SessionManager");

export const TTSSessionManager = {
    // Dependencies
    player: null,
    highlighter: null,
    ui: null,

    init(player, highlighter, ui) {
        this.player = player;
        this.highlighter = highlighter;
        this.ui = ui;
        this._splitElements = new Set(); // Track elements that were split into spans
    },

    start() {
        if (TTSStateStore.isSessionActive) {
            if (this.ui) this.ui.togglePlayer(true);
            return;
        }

        logger.info("Lifecycle", "Starting Session...");
        TTSStateStore.setSessionActive(true);
        
        // [NEW] Thêm class vào body để CSS đẩy padding lên
        document.body.classList.add('tts-open');

        this.refresh();
        if (this.ui) this.ui.togglePlayer(true);
    },

    end() {
        logger.info("Lifecycle", "Ending Session.");
        
        if (this.player) this.player.stop();
        
        TTSStateStore.setSessionActive(false); 
        
        // [NEW] Xóa class khỏi body -> Padding trở về bình thường
        document.body.classList.remove('tts-open');
        
        if (this.ui) {
            this.ui.togglePlayer(false); 
            this.ui.closeSettings();
        }
        
        if (this.highlighter) this.highlighter.clear();
        this._restoreDom();
        TTSMarkerManager.remove();
    },

    refresh(autoPlay = false) {
        if (!TTSStateStore.isSessionActive) return;

        if (this.player) {
            this.player.stop();
            this.player.reset(); // [NEW] Reset prefetch buffer state
        }

        this._restoreDom();

        let originalItems = [];
        if (TTSStateStore.playbackMode === 'paragraph') {
            originalItems = TTSDOMParser.parseParagraphs("sutta-container");
        } else {
            originalItems = TTSDOMParser.parse("sutta-container");
        }
        
        // [REFACTORED] Process items to split long paragraphs/segments granularly
        const processedItems = [];
        const splitThreshold = AppConfig.TTS?.PARAGRAPH_SPLIT_THRESHOLD || 300;

        originalItems.forEach(item => {
            const chunks = this._splitItem(item, splitThreshold);
            processedItems.push(...chunks);
        });

        TTSStateStore.resetPlaylist(processedItems);
        TTSMarkerManager.inject(processedItems); // Inject markers based on new playlist
        
        // [NEW] Check Cache Status (Async)
        if (this.player && this.player.engine) {
            setTimeout(() => {
                TTSMarkerManager.checkCacheStatus(this.player.engine);
            }, 100);
        }
        
        if (processedItems.length > 0) {
            if (autoPlay) {
                if (this.player) this.player.play();
            } else {
                if (this.highlighter) this.highlighter.activate(0);
            }
        } else {
            if (this.highlighter) this.highlighter.clear();
            if (this.ui) this.ui.updateInfo(0, 0);
        }
    },

    _splitItem(item, threshold) {
        if (TTSStateStore.playbackMode === 'paragraph' && item.segments) {
            return this._splitParagraph(item, threshold);
        } else {
            return this._splitSegment(item, threshold);
        }
    },

    /**
     * Splits a paragraph by grouping segments into chunks, 
     * ensuring each chunk scrolls to its starting segment.
     */
    _splitParagraph(item, threshold) {
        const chunks = [];
        let currentChunkText = "";
        let currentChunkSegments = [];

        const flush = () => {
            if (currentChunkSegments.length === 0) return;
            chunks.push({
                ...item,
                id: `${currentChunkSegments[0].id}_p`,
                text: currentChunkText.trim(),
                element: currentChunkSegments[0].element, // Scroll to specific segment!
                blockElement: item.element, // Reference back to the <p> for markers
                isFirstOfBlock: chunks.length === 0
            });
            currentChunkText = "";
            currentChunkSegments = [];
        };

        item.segments.forEach(seg => {
            if (seg.text.length > threshold) {
                flush();
                const subChunks = this._splitSegment(seg, threshold);
                subChunks.forEach((sc, i) => {
                    chunks.push({
                        ...sc,
                        blockElement: item.element,
                        isFirstOfBlock: chunks.length === 0
                    });
                });
            } else {
                if (currentChunkText.length + seg.text.length > threshold && currentChunkSegments.length > 0) {
                    flush();
                }
                currentChunkText += (currentChunkText ? " " : "") + seg.text;
                currentChunkSegments.push(seg);
            }
        });

        flush();
        return chunks;
    },

    /**
     * Splits a single segment into <span> chunks if it exceeds threshold.
     */
    _splitSegment(item, threshold) {
        if (item.text.length <= threshold) {
            return [{ ...item, isFirstOfBlock: true }];
        }

        const transEl = item.element.querySelector(".trans");
        if (!transEl) return [{ ...item, isFirstOfBlock: true }];

        const chunksTexts = TextSplitter.split(item.text, { maxLength: threshold });
        if (chunksTexts.length <= 1) return [{ ...item, isFirstOfBlock: true }];

        // Save original for restoration
        if (!transEl.dataset.originalText) {
            transEl.dataset.originalText = transEl.textContent;
            this._splitElements.add(transEl);
        }

        transEl.innerHTML = "";
        return chunksTexts.map((chunk, index) => {
            const span = document.createElement("span");
            span.className = "tts-chunk";
            span.textContent = chunk;
            transEl.appendChild(span);
            
            return {
                ...item,
                id: `${item.id}_c${index}`,
                text: chunk,
                element: span, // Highlight/Scroll to this specific span!
                isFirstOfBlock: index === 0
            };
        });
    },

    _restoreDom() {
        this._splitElements.forEach(el => {
            if (el.dataset.originalText) {
                el.textContent = el.dataset.originalText;
                delete el.dataset.originalText;
            }
        });
        this._splitElements.clear();
    },

    isActive() {
        return TTSStateStore.isSessionActive;
    }
};