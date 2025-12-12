import { MagicNav } from './magic_nav_controller.js';
export const MagicNavComponent = {
    init: () => MagicNav.init(),
    render: (...args) => MagicNav.render(...args),
    closeAll: () => MagicNav.closeAll()
};
