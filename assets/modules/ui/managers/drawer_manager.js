// Path: web/assets/modules/ui/managers/drawer_manager.js
export const DrawerManager = {
    init() {
        const toggleDrawerBtn = document.getElementById("btn-toggle-drawer");
        const filterDrawer = document.getElementById("filter-drawer");
    
        if (toggleDrawerBtn && filterDrawer) {
            // 1. Toggle Button Click
            toggleDrawerBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Ngăn sự kiện nổi lên document
                filterDrawer.classList.toggle("hidden");
                toggleDrawerBtn.classList.toggle("open");
            });

            // 2. Click Outside to Close
            document.addEventListener("click", (e) => {
                const isHidden = filterDrawer.classList.contains("hidden");
                
                // Nếu drawer đang mở, và click KHÔNG nằm trong drawer, KHÔNG nằm trong nút toggle
                if (!isHidden && 
                    !filterDrawer.contains(e.target) && 
                    !toggleDrawerBtn.contains(e.target)) {
                    
                    filterDrawer.classList.add("hidden");
                    toggleDrawerBtn.classList.remove("open");
                }
            });

            // Ngăn click bên trong drawer làm đóng drawer
            filterDrawer.addEventListener("click", (e) => {
                e.stopPropagation();
            });
        }
    }
};