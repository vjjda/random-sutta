// Path: web/assets/modules/ui/components/magic_nav/ui_manager.js
export const UIManager = {
    elements: {},

    init() {
        this.elements = {
            wrapper: document.getElementById("magic-nav-wrapper"),
            btnBreadcrumb: document.getElementById("btn-magic-breadcrumb"),
            btnToc: document.getElementById("btn-magic-toc"),
            bar: document.getElementById("magic-breadcrumb-bar"),
            drawer: document.getElementById("magic-toc-drawer"),
            tocContent: document.getElementById("magic-toc-content"),
            backdrop: document.getElementById("magic-backdrop"),
        };
        return this.elements;
    },

    // ... (Giữ nguyên setHidden, updateContent) ...
    setHidden(isHidden) {
        if (this.elements.wrapper) {
            isHidden ? this.elements.wrapper.classList.add("hidden") : this.elements.wrapper.classList.remove("hidden");
        }
    },
    updateContent(bcHtml, tocHtml) {
        if (this.elements.bar) this.elements.bar.innerHTML = bcHtml;
        if (this.elements.tocContent) this.elements.tocContent.innerHTML = tocHtml;
    },

    closeAll() {
        const { bar, drawer, backdrop, btnToc, btnBreadcrumb } = this.elements;
        
        bar?.classList.remove("expanded");
        drawer?.classList.remove("open");
        backdrop?.classList.add("hidden");
        
        btnToc?.classList.remove("active");
        btnBreadcrumb?.classList.remove("active");
        btnBreadcrumb?.classList.remove("open"); // [FIXED] Xóa class open để xoay lại
    },

    toggleBreadcrumb() {
        const { bar, btnBreadcrumb } = this.elements;
        const isExpanded = bar.classList.contains("expanded");

        this.closeAll(); // Đóng các cái khác trước

        if (!isExpanded) {
            bar.classList.add("expanded");
            btnBreadcrumb.classList.add("active");
            btnBreadcrumb.classList.add("open"); // [FIXED] Thêm class open để xoay icon
            return true;
        }
        // Nếu đã mở, closeAll() ở trên đã đóng nó rồi -> Logic toggle hoàn tất
        return false;
    },

    toggleTOC() {
        const { drawer, backdrop, btnToc } = this.elements;
        const isOpen = drawer.classList.contains("open");

        this.closeAll();

        if (!isOpen) {
            drawer.classList.add("open");
            backdrop.classList.remove("hidden");
            btnToc.classList.add("active");
            this._scrollToActive();
            return true;
        }
        return false;
    },

    isBreadcrumbExpanded() {
        return this.elements.bar?.classList.contains("expanded");
    },

    _scrollToActive() {
        setTimeout(() => {
            const { drawer } = this.elements;
            const activeItem = drawer?.querySelector(".toc-item.active") || drawer?.querySelector(".toc-header.active");
            if (activeItem) {
                activeItem.scrollIntoView({ block: "center", behavior: "instant" });
            }
        }, 50);
    }
};