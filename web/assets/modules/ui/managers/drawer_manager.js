// Path: web/assets/modules/ui/drawer_manager.js
export const DrawerManager = {
    init() {
        const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
        const filterDrawer = document.getElementById("filter-drawer");
    
        if (toggleDrawerBtn && filterDrawer) {
            toggleDrawerBtn.addEventListener("click", () => {
                filterDrawer.classList.toggle("hidden");
                toggleDrawerBtn.classList.toggle("open");
            });
        }
    }
};