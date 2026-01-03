// Path: web/assets/modules/lookup/core/lookup_state.js

export const LookupState = {
    highlightNode: null,
    currentStart: 0,
    currentEnd: 0,
    isNavigating: false,

    reset() {
        this.highlightNode = null;
        this.currentStart = 0;
        this.currentEnd = 0;
        this.isNavigating = false;
    },

    setHighlight(node, start, end) {
        this.highlightNode = node;
        this.currentStart = start;
        this.currentEnd = end;
    },
    
    getHighlightNode() {
        // Validation check for detached nodes
        if (this.highlightNode && !this.highlightNode.isConnected) {
            // Try to recover? Or just return null
            return null;
        }
        return this.highlightNode;
    }
};