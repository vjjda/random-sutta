// Path: web/assets/modules/data/content_compiler.js
import { DB } from './db_manager.js';

function _findNodeInStructure(structure, targetId) {
    if (Array.isArray(structure)) {
        for (const item of structure) {
            const res = _findNodeInStructure(item, targetId);
            if (res) return res;
        }
    } else if (typeof structure === "object" && structure !== null) {
        for (const key in structure) {
            if (key === targetId) return structure[key];
            const res = _findNodeInStructure(structure[key], targetId);
            if (res) return res;
        }
    }
    return null;
}

/**
 * Biên dịch HTML cho một 'leaf' (bài kinh đơn lẻ).
 */
function compileLeafHtml(suttaId) {
    const book = DB.findBookContaining(suttaId);
    if (!book || !book.content || !book.content[suttaId]) return null;

    const segments = book.content[suttaId];
    let fullHtml = "";
    const segmentIds = Object.keys(segments).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    segmentIds.forEach((segId) => {
        const seg = segments[segId];
        const shortId = segId.includes(":") ? segId.split(":")[1] : segId;
        let contentInner = "";
        if (seg.pli) contentInner += `<span class='pli'>${seg.pli}</span>`;
        if (seg.eng) contentInner += `<span class='eng'>${seg.eng}</span>`;
        if (seg.comm) {
            const safeComm = seg.comm.replace(/'/g, "&#39;");
            contentInner += `<span class='comment-marker' data-comment='${safeComm}'>*</span>`;
        }
        const segmentWrapper = `<span class='segment' id='${shortId}'>${contentInner}</span>`;
        if (seg.html) fullHtml += seg.html.replace("{}", segmentWrapper) + "\n";
        else fullHtml += `<p>${segmentWrapper}</p>\n`;
    });
    return fullHtml;
}

/**
 * Biên dịch HTML cho một 'branch' (một mục lục, tuyển tập).
 */
function compileBranchHtml(branchId) {
    const book = DB.findBookContaining(branchId);
    if (!book) return null;
    const meta = DB.getMeta(branchId);
    if (!meta) return null;

    let childrenNode = _findNodeInStructure(book.structure, branchId);
    if (!childrenNode && book.id === branchId) childrenNode = book.structure;
    if (!childrenNode) return null;

    let html = `<div class="branch-container">`;
    html += `<h1 class="branch-title">${meta.translated_title || meta.acronym || branchId}</h1>`;
    if (meta.original_title) html += `<h2 class="branch-subtitle">${meta.original_title}</h2>`;
    if (meta.blurb) html += `<div class="branch-blurb">${meta.blurb}</div>`;
    html += `<hr class="branch-divider">`;
    html += `<ul class="branch-list">`;

    const processItem = (item) => {
        let id, type;
        if (typeof item === "string") {
            id = item;
            type = "leaf";
        } else {
            id = Object.keys(item)[0];
            type = "branch";
        }

        const childMeta = DB.getMeta(id) || { translated_title: id };
        const title = childMeta.translated_title || childMeta.acronym || id;
        const subtitle = childMeta.original_title || "";
        const blurb = childMeta.blurb || "";
        const displayText = childMeta.acronym || id;
        const cssClass = type === "branch" ? "branch-card-group" : "branch-card-leaf";

        return `<li class="${cssClass}">
                    <a href="#" onclick="window.loadSutta('${id}'); return false;" class="b-card-link">
                        <div class="b-content">
                            <div class="b-header">
                                <span class="b-title">${title}</span>
                                ${subtitle ? `<span class="b-orig">${subtitle}</span>` : ""}
                            </div>
                            ${blurb ? `<div class="b-blurb">${blurb}</div>` : ""} 
                            <div class="b-footer"><span class="b-badge">${displayText}</span></div>
                        </div>
                    </a>
                  </li>`;
    };

    if (Array.isArray(childrenNode)) {
        childrenNode.forEach((item) => (html += processItem(item)));
    } else if (typeof childrenNode === "object") {
        Object.keys(childrenNode).forEach(
            (key) => (html += processItem({ [key]: childrenNode[key] }))
        );
    }
    html += `</ul></div>`;
    return html;
}

export const ContentCompiler = {
    compileHtml: compileLeafHtml,
    compileBranchHtml: compileBranchHtml
};
