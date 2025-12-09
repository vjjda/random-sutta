// Path: web/assets/modules/ui/components/magic_nav/ui_manager.js
export const UIManager = {
    // Cache DOM Elements
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
        return this.elements; // Trả về để Controller gắn event
    },

    setHidden(isHidden) {
        if (this.elements.wrapper) {
            isHidden 
                ? this.elements.wrapper.classList.add("hidden")
                : this.elements.wrapper.classList.remove("hidden");
        }
    },

    updateContent(breadcrumbHtml, tocHtml) {
        if (this.elements.bar && breadcrumbHtml) {
            this.elements.bar.innerHTML = breadcrumbHtml;
        }
        if (this.elements.tocContent && tocHtml) {
            this.elements.tocContent.innerHTML = tocHtml;
        }
    },

    // --- TOGGLE LOGIC ---

    closeAll() {
        const { bar, drawer, backdrop, btnToc, btnBreadcrumb } = this.elements;
        
        bar?.classList.remove("expanded");
        drawer?.classList.remove("open");
        backdrop?.classList.add("hidden");
        
        btnToc?.classList.remove("active");
        btnBreadcrumb?.classList.remove("active");
        btnBreadcrumb?.classList.remove("open"); // Reset xoay icon
    },

    toggleBreadcrumb() {
        const { bar, btnBreadcrumb } = this.elements;
        const isExpanded = bar.classList.contains("expanded");

        this.closeAll(); // Reset trạng thái trước

        if (!isExpanded) {
            bar.classList.add("expanded");
            btnBreadcrumb.classList.add("active");
            btnBreadcrumb.classList.add("open"); // Kích hoạt xoay icon
            return true; // Báo hiệu đã mở
        }
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

    // --- HELPERS ---

    isBreadcrumbExpanded() {
        return this.elements.bar?.classList.contains("expanded");
    },

    _scrollToActive() {
        // Sử dụng timeout nhỏ để đảm bảo drawer đã display block/visible
        setTimeout(() => {
            const { drawer } = this.elements;
            const activeItem = drawer?.querySelector(".toc-item.active") || drawer?.querySelector(".toc-header.active");
            
            if (activeItem) {
                // Snappy scroll (instant) theo yêu cầu
                activeItem.scrollIntoView({ block: "center", behavior: "instant" });
            }
        }, 50);
    }
};