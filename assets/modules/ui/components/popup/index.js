// Path: web/assets/modules/ui/components/popup/index.js
import { PopupOrchestrator } from './popup_orchestrator.js';

export function initPopupSystem() {
    PopupOrchestrator.init();
    return {
        scan: () => PopupOrchestrator.scanComments(),
        hideAll: () => PopupOrchestrator.closeAll(),
        restore: () => PopupOrchestrator.restoreState()
    };
}