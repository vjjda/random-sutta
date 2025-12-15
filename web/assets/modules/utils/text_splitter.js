// Path: web/assets/modules/utils/text_splitter.js

/**
 * A utility to split long texts into smaller chunks based on sentence boundaries.
 */
export const TextSplitter = {
    /**
     * Splits a text into chunks, each not exceeding a specified maximum length.
     * The split respects sentence boundaries.
     * @param {string} text The input text to split.
     * @param {object} options Options for splitting.
     * @param {number} options.maxLength The maximum character length for each chunk.
     * @returns {string[]} An array of text chunks.
     */
    split(text, { maxLength = 450 } = {}) {
        if (!text) return [];
        if (text.length <= maxLength) return [text];

        let sentences = [];

        // [UPDATED] Use Intl.Segmenter for robust, locale-aware sentence splitting
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
            // Array.from is needed to convert the iterator
            sentences = Array.from(segmenter.segment(text)).map(s => s.segment);
        } else {
            // Fallback: Split by punctuation but KEEP the punctuation
            // This regex matches sentence ending + space, capturing the delimiter
            sentences = text.match(/[^.!?]+[.!?]+(\s+|$)|[^.!?]+$/g) || [text];
        }

        const chunks = [];
        let currentChunk = "";

        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (!trimmed) continue;

            // Check if adding this sentence exceeds limit
            // Note: We use 'sentence' (with original spaces) for concatenation flow, 
            // but 'trimmed' for logic checks to be safe.
            
            // Hard limit check: If single sentence is huge, force push it
            if (trimmed.length > maxLength) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                    currentChunk = "";
                }
                chunks.push(trimmed);
                continue;
            }

            if (currentChunk.length + sentence.length > maxLength) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence; // Start new chunk with current sentence (preserve leading space if any? No, usually trim)
                currentChunk = trimmed;
            } else {
                currentChunk += (currentChunk.length > 0 ? " " : "") + trimmed;
            }
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }
};
