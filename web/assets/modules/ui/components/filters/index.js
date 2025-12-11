// Path: web/assets/modules/ui/components/filters/index.js
import { Router } from '../../../core/router.js';
import { FilterState } from './filter_state.js';
import { FilterView } from './filter_view.js';
import { FilterGestures } from './filter_gestures.js';

export const FilterComponent = {
    init() {
        // 1. Khởi tạo State từ URL
        const params = Router.getParams();
        FilterState.initFromUrl(params.b);

        // 2. Định nghĩa các hành động (Callbacks)
        
        // Action: Toggle 1 nút (Visual change only)
        const handleToggleVisual = (bookId, forcedState) => {
            if (forcedState) FilterState.add(bookId);
            else FilterState.delete(bookId);
            
            FilterView.updateBtnState(bookId, forcedState);
        };

        // Action: Kết thúc Drag (Update URL)
        const handleDragEnd = () => {
            const newParam = FilterState.generateParam();
            Router.updateURL(null, newParam);
        };

        // Action: Solo Mode (Long Press)
        const handleSolo = (bookId) => {
            FilterState.setSolo(bookId);
            FilterView.updateAllStates(FilterState); // Cập nhật lại toàn bộ nút
            
            const newParam = FilterState.generateParam();
            Router.updateURL(null, newParam);
            
            if (navigator.vibrate) navigator.vibrate(50);
        };

        // 3. Khởi tạo Global Gestures
        FilterGestures.initGlobalHandlers(handleToggleVisual, handleDragEnd);

        // 4. Render UI và gắn kết logic vào từng nút
        FilterView.render(
            {
                primary: "primary-filters",
                secondary: "secondary-filters",
                moreBtn: "btn-more-filters"
            },
            FilterState,
            {
                attachGestures: (btn, bookId) => {
                    FilterGestures.attachToButton(
                        btn, 
                        bookId, 
                        (bid) => FilterState.has(bid), // Hàm check state hiện tại
                        handleToggleVisual,            // Hàm toggle
                        handleSolo                     // Hàm solo
                    );
                }
            }
        );
    },

    // Export hàm helper để bên ngoài (SuttaController) dùng nếu cần
    getActiveFilters: () => FilterState.getActiveList(),
    generateBookParam: () => FilterState.generateParam()
};