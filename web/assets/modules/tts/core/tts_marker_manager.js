// Path: web/assets/modules/tts/core/tts_marker_manager.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("TTS_MarkerManager");

export const TTSMarkerManager = {
    // Keep track of injected markers to clean up easily
    markers: [],
    playlist: [], // [NEW] Keep ref to playlist

    /**
     * Injects markers into the DOM based on the current playlist.
     * @param {Array} playlist - The current TTS playlist (segments or blocks)
     */
    inject(playlist) {
        this.remove(); // Clear existing first
        this.playlist = playlist; // Store for cache checking

        logger.info("Inject", `Injecting ${playlist.length} markers...`);

        playlist.forEach((item) => {
            if (!item.element) return;

            // Create Marker
            const marker = document.createElement("button");
            marker.className = "tts-marker";
            marker.setAttribute("aria-label", "Play from here");
            marker.setAttribute("data-tts-id", item.id); // Link to playlist ID
            
            // Inject: Prepend to the element (segment or block)
            // Note: The element must have position: relative (handled in CSS)
            // item.element might be a .segment OR a <p>/<div> block
            
            // Check if element supports appendChild (it should)
            if (item.element.firstChild) {
                item.element.insertBefore(marker, item.element.firstChild);
            } else {
                item.element.appendChild(marker);
            }

            this.markers.push(marker);
        });
    },

    /**
     * Removes all injected markers from the DOM.
     */
    remove() {
        this.markers.forEach(m => m.remove());
        this.markers = [];
        this.playlist = [];
        logger.info("Remove", "Markers cleared.");
    },

    /**
     * Updates a single marker to cached state if text matches.
     * @param {string} text - The text that was just cached.
     */
    markAsCached(text) {
        if (!text) return;
        // Find item in playlist with this text
        const item = this.playlist.find(p => p.text === text);
        if (item) {
            const marker = this.markers.find(m => m.getAttribute("data-tts-id") === item.id);
            if (marker) {
                marker.classList.add("cached");
            }
        }
    },

    /**
     * Updates marker visual state based on cache availability.
     * @param {Object} engine - The active TTS engine instance.
     */
    async checkCacheStatus(engine) {
        if (!engine || typeof engine.isCached !== 'function') return;

        logger.debug("CacheCheck", "Checking cache status for markers...");
        
        for (const item of this.playlist) {
            try {
                const isCached = await engine.isCached(item.text);
                if (isCached) {
                    const marker = this.markers.find(m => m.getAttribute("data-tts-id") === item.id);
                    if (marker) {
                        marker.classList.add("cached");
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        }
    }
};