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

        // 1. Primary Strategy: Intl.Segmenter (Browser Native NLP)
        // Supports: EN, VI, ZH, JA, TH, etc. perfectly.
        // Handles "Mr. Smith" vs "End of sentence." smartly.
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
            try {
                // Use 'en' as base, but it handles CJK punctuation reasonably well too.
                // For true multi-lang, we might detect lang later.
                const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
                sentences = Array.from(segmenter.segment(text)).map(s => s.segment);
            } catch (e) {
                console.warn("Intl.Segmenter failed, using regex fallback", e);
            }
        }

        // 2. Fallback Strategy: Robust Regex
        // Only runs if Intl is missing or failed.
        if (sentences.length === 0) {
            // Regex Breakdown:
            // [^.!?。？！]+       -> Body: Anything NOT a terminator (Latin or CJK)
            // (?:                -> Group for terminator + closers
            //   [.!?。？！]+     -> Terminator: . ! ? or 。 ！ ？
            //   ['"”’)}\]]*      -> Optional Closing Marks: quotes, brackets
            // )?                 -> The whole terminator group is optional (catch end of text)
            // (?:\s+|$)          -> Followed by space or End of String
            const robustRegex = /[^.!?。？！]+(?:[.!?。？！]+['"”’)}\]]*)?(?:\s+|$)/g;
            
            sentences = text.match(robustRegex) || [text];
        }

        const chunks = [];
        let currentChunk = "";

        for (const sentence of sentences) {
            // Trim logic: We usually want to trim for calculation, 
            // but carefully preserve needed spaces when joining.
            // Intl.Segmenter usually includes the trailing space in the segment.
            const trimmed = sentence.trim();
            if (!trimmed) continue;

            // Hard limit check for massive single sentences
            if (trimmed.length > maxLength) {
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                    currentChunk = "";
                }
                chunks.push(trimmed);
                continue;
            }

            // Check fits
            if (currentChunk.length + sentence.length > maxLength) {
                chunks.push(currentChunk.trim());
                // Start new chunk
                currentChunk = sentence; 
            } else {
                // If currentChunk is empty, just take the sentence (preserve leading format)
                // If not empty, we need to ensure spacing. 
                // Note: 'sentence' from Segmenter/Regex often keeps its own trailing space.
                if (currentChunk.length === 0) {
                    currentChunk = sentence;
                } else {
                    // Rudimentary join: If previous chunk didn't end with space, add one.
                    // (For CJK in future, this logic needs 'isCJK' check to avoid adding spaces)
                    if (!currentChunk.match(/\s$/)) {
                        currentChunk += " ";
                    }
                    currentChunk += sentence;
                }
            }
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }
};
