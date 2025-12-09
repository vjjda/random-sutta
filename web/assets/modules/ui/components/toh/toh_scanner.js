// Path: web/assets/modules/ui/components/toh/toh_scanner.js
import { extractParagraphNumber } from './toh_utils.js';

export const TohScanner = {
    /**
     * Quét container để tìm dữ liệu cho mục lục.
     * @param {HTMLElement} container 
     * @returns {Object} { mode: 'headings'|'paragraphs'|'none', items: Array }
     */
    scan(container) {
        // 1. Chiến lược A: Tìm Heading cấu trúc (h2 trở lên)
        const headings = container.querySelectorAll("h2, h3, h4, h5");
        if (headings.length >= 2) {
            return {
                mode: 'headings',
                items: Array.from(headings).map(h => this._parseHeading(h))
            };
        }

        // 2. Chiến lược B: Paragraph Scan (Fallback)
        const paragraphs = container.querySelectorAll("p");
        const validItems = [];

        paragraphs.forEach(p => {
            const firstSeg = p.querySelector(".segment");
            if (firstSeg && firstSeg.id) {
                // Kiểm tra text rỗng
                if (firstSeg.textContent.trim().length > 0) {
                    validItems.push(this._parseParagraph(firstSeg));
                }
            }
        });

        if (validItems.length > 2) {
            return { mode: 'paragraphs', items: validItems };
        }

        return { mode: 'none', items: [] };
    },

    _getTextContent(element) {
        let text = element.textContent;
        const engNode = element.querySelector(".eng");
        const pliNode = element.querySelector(".pli");

        if (engNode && engNode.textContent.trim()) {
            text = engNode.textContent.trim();
        } else if (pliNode && pliNode.textContent.trim()) {
            text = pliNode.textContent.trim();
        }
        return text.replace(/\s+/g, ' ').trim();
    },

    _parseHeading(heading) {
        return {
            id: heading.id || '',
            text: this._getTextContent(heading),
            levelClass: `toh-${heading.tagName.toLowerCase()}`, // toh-h2, toh-h3...
            prefix: null
        };
    },

    _parseParagraph(segment) {
        let paraNum = extractParagraphNumber(segment.id);
        
        // [CHECK EVAM] Bỏ số nếu là đoạn 'Evam'
        if (segment.querySelector('.evam') || segment.closest('.evam')) {
            paraNum = "";
        }

        let text = "Paragraph";
        const rawText = this._getTextContent(segment);
        if (rawText) text = rawText;

        // Cắt ngắn nếu quá dài
        if (text.length > 60) {
            text = text.substring(0, 60) + "...";
        }

        return {
            id: segment.id,
            text: text,
            levelClass: "toh-h3", // Style giả lập H3
            prefix: paraNum
        };
    }
};