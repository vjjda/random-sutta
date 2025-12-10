// Path: web/assets/modules/ui/components/toh/content_scanner.js
import { extractParagraphNumber, getCleanTextContent } from './text_utils.js';

export const ContentScanner = {
    /**
     * Quét container để tìm dữ liệu cho mục lục.
     * @param {HTMLElement} container 
     * @returns {Object} { mode: 'headings'|'paragraphs'|'none', items: Array }
     */
    scan(container) {
        // 1. Chiến lược A: Tìm Heading cấu trúc (h2 trở lên)
        const headings = container.querySelectorAll("h2, h3, h4, h5");
        
        if (headings.length >= 2) {
            // [LOGIC MỚI] Kiểm tra sự phân bố của các heading trong các article
            const uniqueArticleIds = new Set();
            
            headings.forEach(h => {
                // Tìm thẻ article gần nhất bao ngoài heading đó
                const parentArticle = h.closest('article');
                if (parentArticle && parentArticle.id) {
                    uniqueArticleIds.add(parentArticle.id);
                }
            });

            // Chỉ sử dụng prefix nếu danh sách heading nằm trên NHIỀU article khác nhau.
            // (Ví dụ: Dhp có dhp1, dhp2... thì size > 1 -> Cần hiện prefix)
            // (Ví dụ: DN2 chỉ có article id="dn2" bao trùm -> size == 1 -> Không hiện prefix)
            const useArticlePrefix = uniqueArticleIds.size > 1;

            return {
                mode: 'headings',
                items: Array.from(headings).map((h, index) => 
                    this._parseHeading(h, index, useArticlePrefix)
                )
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

    _parseHeading(heading, index, useArticlePrefix) {
        // Tự động gán ID nếu thiếu để chức năng cuộn hoạt động
        if (!heading.id) {
            heading.id = `toh-heading-${index}`;
        }

        let prefix = null;

        // Chỉ lấy Article ID làm prefix nếu cờ useArticlePrefix = true
        if (useArticlePrefix) {
            const parent = heading.closest('article');
            if (parent && parent.id) {
                prefix = parent.id;
            }
        }

        // [NEW] Extract first sentence of ALL following paragraphs until next heading
        const subTexts = [];
        let nextElem = heading.nextElementSibling;
        
        while (nextElem) {
            // Stop if we hit another heading
            if (/^H[1-6]$/i.test(nextElem.tagName)) {
                break;
            }

            if (nextElem.tagName.toLowerCase() === 'p') {
                const rawSub = getCleanTextContent(nextElem);
                if (rawSub) {
                    let subText = "";
                    // Take first sentence or truncate
                    const dotIndex = rawSub.indexOf('.');
                    if (dotIndex !== -1 && dotIndex < 100) {
                        subText = rawSub.substring(0, dotIndex + 1);
                    } else {
                        subText = rawSub.substring(0, 80) + (rawSub.length > 80 ? "..." : "");
                    }
                    
                    // Find ID for linking
                    let paraId = null;
                    const segment = nextElem.querySelector('.segment');
                    if (segment && segment.id) {
                        paraId = segment.id;
                    } else if (nextElem.id) {
                        paraId = nextElem.id;
                    }

                    // Extract Prefix
                    let paraNum = "";
                    if (paraId) {
                        paraNum = extractParagraphNumber(paraId);
                        // Check Evam
                        if (nextElem.querySelector('.evam') || nextElem.closest('.evam')) {
                            paraNum = "";
                        }
                    }

                    subTexts.push({ id: paraId, text: subText, prefix: paraNum });
                }
            }
            nextElem = nextElem.nextElementSibling;
        }

        return {
            id: heading.id,
            text: getCleanTextContent(heading),
            levelClass: `toh-${heading.tagName.toLowerCase()}`, 
            prefix: prefix,
            subTexts: subTexts // [UPDATED] Return array of objects
        };
    },

    _parseParagraph(segment) {
        let paraNum = extractParagraphNumber(segment.id);
        
        // [CHECK EVAM] Bỏ số nếu là đoạn 'Evam'
        if (segment.querySelector('.evam') || segment.closest('.evam')) {
            paraNum = "";
        }

        let text = "Paragraph";
        const rawText = getCleanTextContent(segment);
        if (rawText) text = rawText;

        // Cắt ngắn nếu quá dài
        if (text.length > 60) {
            text = text.substring(0, 60) + "...";
        }

        return {
            id: segment.id,
            text: text,
            levelClass: "toh-h3", 
            prefix: paraNum
        };
    }
};