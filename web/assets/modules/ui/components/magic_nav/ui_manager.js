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
            
            // [NEW] Kích hoạt chế độ kéo thả thủ công
            if (this.elements.bar) {
                this._enableDragScroll(this.elements.bar);
            }
        }

        if (this.elements.backdrop) {
            this.elements.backdrop.addEventListener("click", () => this.closeAll());
        }

        return this.elements;
    },

    // ... (Giữ nguyên setHidden, updateContent) ...
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

    // [NEW] Logic Kéo Thả (Drag-to-Scroll) Siêu Mượt
    _enableDragScroll(slider) {
        let isDown = false;
        let startX;
        let scrollLeft;

        // 1. Mouse Events (Desktop)
        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            slider.classList.add('active');
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });
        slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('active'); });
        slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('active'); });
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2; // Tốc độ cuộn (nhân 2 cho nhanh)
            slider.scrollLeft = scrollLeft - walk;
        });

        // 2. Touch Events (Mobile) - "Manual Override"
        slider.addEventListener('touchstart', (e) => {
            isDown = true;
            startX = e.touches[0].pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        }, { passive: true });

        slider.addEventListener('touchend', () => { isDown = false; });

        slider.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            // Không dùng preventDefault ở đây để giữ passive, 
            // nhưng ta sẽ tự tính toán scroll
            const x = e.touches[0].pageX - slider.offsetLeft;
            const walk = (x - startX) * 1.5; // Tinh chỉnh tốc độ vuốt cho mobile
            
            // Trực tiếp cập nhật vị trí scroll
            slider.scrollLeft = scrollLeft - walk;
        }, { passive: true });

        // 3. Wheel Event (Shift + Scroll)
        slider.addEventListener("wheel", (e) => {
            if (e.shiftKey || Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                if (slider.scrollWidth > slider.clientWidth) {
                    e.preventDefault();
                    slider.scrollLeft += e.deltaY;
                }
            }
        }, { passive: false });
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
            // [UPDATED] Scroll tới marker với khoảng cách an toàn
            endMarker.scrollIntoView({ behavior: "instant", inline: "end" });
        } else {
            setTimeout(() => {
                const bar = this.elements.bar;
                if (bar) bar.scrollLeft = bar.scrollWidth;
            }, 0);
        }
    }
};