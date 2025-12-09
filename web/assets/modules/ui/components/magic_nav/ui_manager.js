// Path: web/assets/modules/ui/components/magic_nav/ui_manager.js
export const UIManager = {
    elements: {},
    _autoCollapseTimer: null,
    _COLLAPSE_DELAY: 2000, 

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
                if (this.elements.wrapper.classList.contains("collapsed")) {
                    this.openWrapper();
                    e.stopPropagation();
                } 
                else if (e.target === this.elements.dot || e.target === this.elements.wrapper) {
                    this.closeAll();
                    e.stopPropagation();
                }
                this.resetAutoCollapse();
            });

            // Reset timer trên PC
            this.elements.wrapper.addEventListener("mouseenter", () => this.clearAutoCollapse());
            this.elements.wrapper.addEventListener("mouseleave", () => this.startAutoCollapse());
            
            // [UPDATED] Reset timer trên Mobile khi chạm vào wrapper chung
            this.elements.wrapper.addEventListener("touchstart", () => this.resetAutoCollapse());
            
            // [UPDATED] Xử lý riêng cho thanh Breadcrumb để vuốt mượt mà không bị đóng
            if (this.elements.bar) {
                // Lắng nghe mọi cử động vuốt, lăn chuột trên thanh bar
                ['scroll', 'touchstart', 'touchmove', 'touchend', 'mousedown'].forEach(evt => {
                    this.elements.bar.addEventListener(evt, () => this.resetAutoCollapse());
                });
            }
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

    startAutoCollapse() {
        if (this.elements.drawer && this.elements.drawer.classList.contains("open")) return;
        this.clearAutoCollapse();
        this._autoCollapseTimer = setTimeout(() => {
            this.closeAll();
        }, this._COLLAPSE_DELAY);
    },

    clearAutoCollapse() {
        if (this._autoCollapseTimer) {
            clearTimeout(this._autoCollapseTimer);
            this._autoCollapseTimer = null;
        }
    },

    resetAutoCollapse() {
        this.clearAutoCollapse();
        this.startAutoCollapse();
    },

    openWrapper() {
        this.elements.wrapper.classList.remove("collapsed");
        this.startAutoCollapse();
        
        if (this.elements.bar && this.elements.bar.innerHTML) {
             this._scrollBreadcrumbToEnd();
        }
    },

    closeAll() {
        this.clearAutoCollapse();
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
        this.resetAutoCollapse(); 

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
        this.clearAutoCollapse(); 

        if (!isOpen) {
            drawer.classList.add("open");
            backdrop.classList.remove("hidden");
            btnToc.classList.add("active");
            this._scrollToActive();
            return true;
        }
        this.startAutoCollapse(); 
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
                // Scroll tới tận cùng bên phải (bao gồm cả padding)
                bar.scrollTo({
                    left: bar.scrollWidth,
                    behavior: 'instant'
                });
            }
        }, 0);
    }
};