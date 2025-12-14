// Path: web/assets/modules/tts/core/tts_marker_manager.js
import { getLogger } from '../../utils/logger.js';

const logger = getLogger("TTS_MarkerManager");

export const TTSMarkerManager = {
    // Keep track of injected markers to clean up easily
    markers: [],

    /**
     * Injects markers into the DOM based on the current playlist.
     * @param {Array} playlist - The current TTS playlist (segments or blocks)
     */
    inject(playlist) {
        this.remove(); // Clear existing first

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
        logger.info("Remove", "Markers cleared.");
    }
};