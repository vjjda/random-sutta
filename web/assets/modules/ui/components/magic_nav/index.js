// Path: web/assets/modules/ui/components/magic_nav/index.js
import { MagicNav } from './magic_nav_controller.js';

export const MagicNavComponent = {
    init: () => MagicNav.init(),
    render: (tree, uid, meta, superTree, superMeta) => MagicNav.render(tree, uid, meta, superTree, superMeta),
    closeAll: () => MagicNav.closeAll()
};