// Path: web/assets/modules/ui/components/magic_nav/ui_manager.js
export const UIManager = {
    elements: {},

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
            });
            
            if (this.elements.bar) {
                // [FIX 1] Nhóm Passive: Cho phép trình duyệt xử lý cuộn mượt mà không cần chờ JS
                const passiveEvents = ['touchstart', 'touchmove', 'touchend', 'scroll'];
                passiveEvents.forEach(evt => {
                    this.elements.bar.addEventListener(evt, () => {
                        // Logic reset timer đã bị bỏ ở bước trước theo yêu cầu, 
                        // nhưng nếu sau này cần dùng lại thì phải để passive: true
                    }, { passive: true });
                });

                // [FIX 2] Nhóm Non-Passive: Dành riêng cho Wheel để chặn cuộn dọc, ép sang cuộn ngang
                this.elements.bar.addEventListener("wheel", (e) => {
                    // Ưu tiên 1: Shift + Lăn chuột (Chuẩn UX)
                    if (e.shiftKey) {
                        e.preventDefault();
                        this.elements.bar.scrollLeft += e.deltaY;
                    } 
                    // Ưu tiên 2: Lăn chuột dọc thông thường (Tiện lợi)
                    // Chỉ chặn nếu thanh bar thực sự có thể cuộn được
                    else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                        if (this.elements.bar.scrollWidth > this.elements.bar.clientWidth) {
                            e.preventDefault();
                            this.elements.bar.scrollLeft += e.deltaY;
                        }
                    }
                }, { passive: false });
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

    openWrapper() {
        this.elements.wrapper.classList.remove("collapsed");
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
        const endMarker = document.getElementById("magic-bc-end");
        if (endMarker) {
            endMarker.scrollIntoView({ behavior: "instant", inline: "end" });
        } else {
            setTimeout(() => {
                const bar = this.elements.bar;
                if (bar) bar.scrollLeft = bar.scrollWidth;
            }, 0);
        }
    }
};