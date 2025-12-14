// Path: web/assets/modules/ui/components/popup/index.js
import { PopupManager } from './manager.js';

export function initPopupSystem() {
    PopupManager.init();
    return {
        scan: () => PopupManager.scanComments(),
        hideAll: () => PopupManager.hideAll(),
        restore: () => PopupManager.restoreState()
    };
}

// Backward Compatibility (cho các file chưa refactor)
export const initCommentPopup = () => {
    // PopupManager tự init trong app.js nên ở đây chỉ trả về API
    return { 
        hideComment: () => PopupManager.hideAll() 
    };
};