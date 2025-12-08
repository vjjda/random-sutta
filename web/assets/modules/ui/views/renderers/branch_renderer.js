// Path: web/assets/modules/ui/views/renderers/branch_renderer.js
import { ContentCompiler } from "../../../data/content_compiler.js"; 

export const BranchRenderer = {
    render(data) {
        const metaForMenu = data.contextMeta || {};
        if (data.meta) metaForMenu[data.uid] = data.meta;

        const htmlContent = ContentCompiler.compileBranch(
            data.bookStructure, 
            data.uid, 
            metaForMenu
        );

        // Branch thường dùng Title của chính nó cho Header
        const displayInfo = {
            main: data.meta?.acronym || data.uid.toUpperCase(),
            sub: data.meta?.translated_title || ""
        };

        return {
            html: htmlContent,
            displayInfo: displayInfo
        };
    }
};