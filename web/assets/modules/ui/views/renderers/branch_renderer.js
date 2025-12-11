// Path: web/assets/modules/ui/views/renderers/branch_renderer.js
import { ContentCompiler } from "../../../data/content_compiler.js";

export const BranchRenderer = {
    render(data) {
        const metaForMenu = data.contextMeta || {};
        if (data.meta) metaForMenu[data.uid] = data.meta;

        // 1. Sinh danh sách Card con (như cũ)
        const listHtml = ContentCompiler.compileBranch(
            data.bookStructure, 
            data.uid, 
            metaForMenu
        );

        // 2. [NEW] Sinh phần Header giới thiệu (Hero Section)
        const meta = data.meta || {};
        const title = meta.translated_title || meta.acronym || data.uid.toUpperCase();
        const original = meta.original_title || "";
        const blurb = meta.blurb || "";

        // Chỉ hiện Header nếu có ít nhất Title hoặc Blurb
        let headerHtml = "";
        if (title || blurb) {
            headerHtml = `
                <div class="branch-hero">
                    <h1 class="branch-hero-title">${title}</h1>
                    ${original ? `<div class="branch-hero-original">${original}</div>` : ''}
                    ${blurb ? `<div class="branch-hero-blurb">${blurb}</div>` : ''}
                    <div class="branch-hero-divider"></div>
                </div>
            `;
        }

        // 3. Display Info cho Header Bar
        const displayInfo = {
            main: meta.acronym || data.uid.toUpperCase(),
            sub: meta.translated_title || ""
        };

        return {
            // Ghép Header lên trước List
            html: headerHtml + listHtml,
            displayInfo: displayInfo
        };
    }
};