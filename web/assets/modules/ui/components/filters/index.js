// Path: web/assets/modules/ui/components/filters/index.js
// Giữ nguyên file này, đường dẫn import Router đã đúng
import { Router } from '../../../core/router.js';
import { FilterState } from './filter_state.js';
import { FilterView } from './filter_view.js';
import { FilterGestures } from './filter_gestures.js';

export const FilterComponent = {
    init() {
        const params = Router.getParams();
        FilterState.initFromUrl(params.b);

        const handleToggleVisual = (bookId, forcedState) => {
            if (forcedState) FilterState.add(bookId);
            else FilterState.delete(bookId);
            
            FilterView.updateBtnState(bookId, forcedState);
        };

        const handleDragEnd = () => {
            const newParam = FilterState.generateParam();
            Router.updateURL(null, newParam);
        };

        const handleSolo = (bookId) => {
            FilterState.setSolo(bookId);
            FilterView.updateAllStates(FilterState); 
            
            const newParam = FilterState.generateParam();
            Router.updateURL(null, newParam);
            
            if (navigator.vibrate) navigator.vibrate(50);
        };

        FilterGestures.initGlobalHandlers(handleToggleVisual, handleDragEnd);

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
                        (bid) => FilterState.has(bid),
                        handleToggleVisual,
                        handleSolo
                    );
                }
            }
        );
    },

    getActiveFilters: () => FilterState.getActiveList(),
    generateBookParam: () => FilterState.generateParam()
};