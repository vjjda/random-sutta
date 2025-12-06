// Path: web/assets/modules/data/sutta_info_provider.js
import { DB } from './db_manager.js';

/**
 * Lấy thông tin hiển thị (Tiêu đề, Subtitle) cho một Sutta ID.
 * Dùng cho Header và các nút điều hướng.
 */
export function getSuttaDisplayInfo(suttaId) {
    const id = suttaId.toLowerCase();
    const meta = DB.getMeta(id);
    
    if (meta) {
        return {
            title: meta.acronym || id,
            subtitle: meta.translated_title || meta.original_title || ""
        };
    }
    
    // Fallback nếu chưa load được meta
    return {
        title: id,
        subtitle: ""
    };
}
