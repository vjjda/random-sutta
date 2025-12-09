// Path: web/assets/modules/ui/components/magic_nav/ui_manager.js
export const UIManager = {
    elements: {},
    // [UPDATED] Đã xóa timer variables

    init() {
        this.elements = {
            wrapper: document.getElementById("magic-nav-wrapper"),
            dot: document.getElementById("magic-nav-dot"),
            btnBreadcrumb: document.getElementById("btn-magic-breadcrumb"),
            btnToc: document.getElementById("btn-magic-toc"),
            bar: document.getElementById("magic-breadcrumb-bar"),
            drawer: document.getElementById("magic-toc-drawer"),
            tocContent: document.getElementById("magic-toc-content"),
            backdrop: document.getElementById("magic-backdrop"),
        };

        if (this.elements.wrapper) {
            this.elements.wrapper.addEventListener("click", (e) => {
                // Mở khi click vào vùng "Hot Corner"
                if (this.elements.wrapper.classList.contains("collapsed")) {
                    this.openWrapper();
                    e.stopPropagation();
                } 
                // Đóng khi click vào Dot (nút đóng) hoặc vùng trống của thanh bar
                else if (e.target === this.elements.dot || e.target === this.elements.wrapper) {
                    this.closeAll();
                    e.stopPropagation();
                }
            });
            
            // [UPDATED] Xóa các sự kiện mouseenter/mouseleave/touch gây auto-collapse
        }

        if (this.elements.backdrop) {
            this.elements.backdrop.addEventListener("click", () => this.closeAll());
        }

        return this.elements;
    },

    setHidden(isHidden) {
        if (this.elements.wrapper) {
            if (isHidden) {
                this.elements.wrapper.classList.add("hidden");
            } else {
                this.elements.wrapper.classList.remove("hidden");
                this.elements.wrapper.classList.add("collapsed"); 
            }
        }
    },

    updateContent(bcHtml, tocHtml) {
        if (this.elements.bar) this.elements.bar.innerHTML = bcHtml;
        if (this.elements.tocContent) this.elements.tocContent.innerHTML = tocHtml;
    },

    // [UPDATED] Các hàm timer đã bị xóa (startAutoCollapse, clear, reset)

    openWrapper() {
        this.elements.wrapper.classList.remove("collapsed");
        // Scroll ngay lập tức khi mở
        if (this.elements.bar && this.elements.bar.innerHTML) {
             this._scrollBreadcrumbToEnd();
        }
    },

    closeAll() {
        const { bar, drawer, backdrop, btnToc, btnBreadcrumb, wrapper } = this.elements;
        bar?.classList.remove("expanded");
        drawer?.classList.remove("open");
        backdrop?.classList.add("hidden");
        btnToc?.classList.remove("active");
        btnBreadcrumb?.classList.remove("active");
        btnBreadcrumb?.classList.remove("open");
        wrapper?.classList.add("collapsed");
    },

    toggleBreadcrumb() {
        const { bar, btnBreadcrumb } = this.elements;
        const isExpanded = bar.classList.contains("expanded");
        this._closePopupsOnly(); 

        if (!isExpanded) {
            bar.classList.add("expanded");
            btnBreadcrumb.classList.add("active");
            btnBreadcrumb.classList.add("open");
            this.elements.backdrop.classList.remove("hidden");
            this._scrollBreadcrumbToEnd();
            return true;
        }
        this.elements.backdrop.classList.remove("hidden"); 
        return false;
    },

    toggleTOC() {
        const { drawer, backdrop, btnToc } = this.elements;
        const isOpen = drawer.classList.contains("open");
        this._closePopupsOnly();

        if (!isOpen) {
            drawer.classList.add("open");
            backdrop.classList.remove("hidden");
            btnToc.classList.add("active");
            this._scrollToActive();
            return true;
        }
        backdrop.classList.remove("hidden");
        return false;
    },

    _closePopupsOnly() {
        const { bar, drawer, btnToc, btnBreadcrumb } = this.elements;
        bar?.classList.remove("expanded");
        drawer?.classList.remove("open");
        btnToc?.classList.remove("active");
        btnBreadcrumb?.classList.remove("active");
        btnBreadcrumb?.classList.remove("open");
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
        }, 0); 
    },

    _scrollBreadcrumbToEnd() {
        setTimeout(() => {
            const bar = this.elements.bar;
            if (bar) {
                bar.scrollTo({
                    left: bar.scrollWidth, // Scroll kịch kim sang phải
                    behavior: 'instant'
                });
            }
        }, 0);
    }
};