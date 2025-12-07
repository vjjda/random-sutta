// Path: web/assets/modules/data/repositories/index_repository.js
import { IODriver } from '../io_driver.js';
import { getLogger } from '../../utils/logger.js';
import { PRIMARY_BOOKS } from '../constants.js';

const logger = getLogger("IndexRepo");

export const IndexRepository = {
    index: null,

    async ensureLoaded() {
        if (this.index) return;
        
        if (window.__DB_INDEX__) {
            this.index = window.__DB_INDEX__;
            return;
        }

        try {
            this.index = await IODriver.fetchResource('assets/db/uid_index.json', 'uid_index');
        } catch (e) {
            logger.error("ensureLoaded", "Failed to load index", e);
            throw e;
        }
    },

    getLocator(uid) {
        return this.index?.locator?.[uid] || null;
    },

    getPool(bookId) {
        if (!this.index) return [];
        
        if (bookId === 'primary') {
            return PRIMARY_BOOKS.flatMap(bid => this.index.pools.books[bid] || []);
        }
        return this.index.pools.books[bookId] || [];
    },
    
    getAllLocators() {
        if (!this.index?.locator) return [];
        return Object.values(this.index.locator);
    }
};