// Path: web/assets/modules/ui/components/magic_nav/ui_manager.js
export const UIManager = {
    elements: {},
    _autoCollapseTimer: null,
    _COLLAPSE_DELAY: 2000, // 2 giây

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
            // Sự kiện Click Wrapper
            this.elements.wrapper.addEventListener("click", (e) => {
                // Nếu click vào chính cái Dot hoặc Wrapper khi đang collapsed -> Toggle
                if (this.elements.wrapper.classList.contains("collapsed")) {
                    this.openWrapper();
                    e.stopPropagation();
                } else if (e.target === this.elements.dot || e.target === this.elements.wrapper) {
                    // Nếu đang mở mà click vào dot/vùng trống wrapper -> Đóng
                    this.closeAll();
                    e.stopPropagation();
                }
                // Nếu click vào các nút con (btnToc...) thì để sự kiện lan truyền (bubble)
                this.resetAutoCollapse();
            });

            // Sự kiện Mouse Enter/Leave (cho Desktop)
            this.elements.wrapper.addEventListener("mouseenter", () => this.clearAutoCollapse());
            this.elements.wrapper.addEventListener("mouseleave", () => this.startAutoCollapse());
            
            // Sự kiện Touch/Scroll (cho Mobile) để reset timer
            this.elements.wrapper.addEventListener("touchstart", () => this.resetAutoCollapse());
            if (this.elements.bar) {
                this.elements.bar.addEventListener("scroll", () => this.resetAutoCollapse());
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

    // --- LOGIC AUTO COLLAPSE ---
    startAutoCollapse() {
        // Chỉ auto collapse khi không có Drawer (TOC) đang mở
        // Nếu đang đọc TOC thì không nên đóng
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

    // --- OPEN / CLOSE ---
    openWrapper() {
        this.elements.wrapper.classList.remove("collapsed");
        this.startAutoCollapse(); // Bắt đầu đếm ngược ngay khi mở
        
        // Mặc định expand breadcrumb luôn cho tiện (theo yêu cầu cũ)
        // Hoặc giữ nguyên logic cũ là click nút mới hiện. 
        // Ở đây ta giữ logic hiển thị nút, người dùng bấm nút mới xem
        
        // Tuy nhiên, nếu breadcrumb đang hiển thị sẵn (do state cũ), cần scroll
        if (this.elements.bar && this.elements.bar.innerHTML) {
             this._scrollBreadcrumbToEnd();
        }
    },

    closeAll() {
        this.clearAutoCollapse();
        
        const { bar, drawer, backdrop, btnToc, btnBreadcrumb, wrapper } = this.elements;
        bar?.classList.remove("expanded"); // Có thể bỏ dòng này nếu muốn giữ state breadcrumb bar
        drawer?.classList.remove("open");
        backdrop?.classList.add("hidden");
        
        btnToc?.classList.remove("active");
        btnBreadcrumb?.classList.remove("active");
        btnBreadcrumb?.classList.remove("open");
        
        // Thu gọn về Dot
        wrapper?.classList.add("collapsed");
    },

    // --- FEATURE LOGIC ---
    toggleBreadcrumb() {
        const { bar, btnBreadcrumb } = this.elements;
        const isExpanded = bar.classList.contains("expanded");

        this._closePopupsOnly(); 
        this.resetAutoCollapse(); // Reset timer khi tương tác

        if (!isExpanded) {
            bar.classList.add("expanded");
            btnBreadcrumb.classList.add("active");
            btnBreadcrumb.classList.add("open");
            this.elements.backdrop.classList.remove("hidden");
            
            // [NEW] Auto scroll to end
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
        this.clearAutoCollapse(); // Khi mở TOC thì dừng auto collapse để người dùng đọc

        if (!isOpen) {
            drawer.classList.add("open");
            backdrop.classList.remove("hidden");
            btnToc.classList.add("active");
            this._scrollToActive();
            return true;
        }
        
        // Nếu đóng TOC thì bắt đầu đếm ngược lại
        this.startAutoCollapse(); 
        backdrop.classList.remove("hidden");
        return false;
    },

    _closePopupsOnly() {
        const { bar, drawer, btnToc, btnBreadcrumb } = this.elements;
        // Chú ý: Ở logic này ta giữ bar expanded hay không tùy ý thích
        // Nếu muốn behavior "Switch tab":
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
        }, 50);
    },

    // [NEW] Scroll Breadcrumb
    _scrollBreadcrumbToEnd() {
        setTimeout(() => {
            const bar = this.elements.bar;
            if (bar) {
                // Scroll mượt sang phải cùng
                bar.scrollTo({
                    left: bar.scrollWidth,
                    behavior: 'smooth'
                });
            }
        }, 100); // Delay nhỏ để DOM render xong chiều rộng
    }
};