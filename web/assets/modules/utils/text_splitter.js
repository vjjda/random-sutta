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
        if (!text || text.length <= maxLength) {
            return [text];
        }

        // 1. Split the text into sentences. This regex looks for sentence-ending punctuation
        // followed by a space or the end of the string, which is more robust than a simple split.
        const sentences = text.match(/[^.!?]+[.!?]+(\s+|$)/g) || [text];

        const chunks = [];
        let currentChunk = "";

        for (const sentence of sentences) {
            const trimmedSentence = sentence.trim();
            if (!trimmedSentence) continue;

            // If the current chunk is empty and the sentence itself is too long,
            // we have no choice but to add it as its own chunk.
            if (currentChunk.length === 0 && trimmedSentence.length > maxLength) {
                // For very long "sentences", we might need a more aggressive split,
                // but for now, we'll just add it as is to avoid losing content.
                chunks.push(trimmedSentence);
                continue;
            }

            // If adding the next sentence exceeds the max length, push the current
            // chunk and start a new one.
            if (currentChunk.length + trimmedSentence.length + 1 > maxLength) {
                chunks.push(currentChunk.trim());
                currentChunk = trimmedSentence;
            } else {
                // Otherwise, add the sentence to the current chunk.
                currentChunk += (currentChunk.length > 0 ? " " : "") + trimmedSentence;
            }
        }

        // 3. Add the last remaining chunk.
        if (currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }
};
