// Path: web/assets/modules/ui/views/renderers/leaf_renderer.js
import { ContentCompiler } from "../../../data/content_compiler.js"; 

function getDisplayInfo(uid, metaEntry) {
    let main = uid.toUpperCase();
    let sub = "";
    const match = uid.match(/^([a-z]+)(\d.*)$/i);
    if (match) main = `${match[1].toUpperCase()} ${match[2]}`;

    if (metaEntry) {
        main = metaEntry.acronym || main;
        sub = metaEntry.translated_title || metaEntry.original_title || "";
    }
    return { main, sub };
}

export const LeafRenderer = {
    render(data) {
        const htmlContent = ContentCompiler.compile(data.content, data.uid);
        
        // Info cho Header (Renderer chính sẽ dùng)
        const displayInfo = getDisplayInfo(data.uid, data.meta);
        
        return {
            html: htmlContent,
            displayInfo: displayInfo
        };
    }
};