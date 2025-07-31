/**
 * Cache Optimizer for Bridal Products
 * Handles cache clearing and ETag validation
 */

const CacheOptimizer = (function() {
    
    /**
     * Clear all product caches
     */
    function clearAllCaches() {
        console.log('🧹 Clearing all product caches...');
        
        // Clear memory cache
        if (window.BridalProductsLoader) {
            window.BridalProductsLoader.clearCache();
        }
        
        // Clear localStorage
        try {
            localStorage.removeItem('bridalProducts');
            localStorage.removeItem('bridalProductsTime');
            localStorage.removeItem('bridalProductsETag');
            localStorage.removeItem('auric_bridal_products_cache');
            localStorage.removeItem('auric_bridal_products_cache_time');
        } catch (e) {
            console.warn('Error clearing localStorage:', e);
        }
        
        // Clear sessionStorage
        try {
            sessionStorage.removeItem('bridalProducts');
            sessionStorage.removeItem('bridalProductsTime');
            sessionStorage.removeItem('bridalProductsETag');
        } catch (e) {
            console.warn('Error clearing sessionStorage:', e);
        }
        
        console.log('✅ All caches cleared successfully');
    }
    
    /**
     * Force reload products from server
     */
    async function forceReloadProducts() {
        console.log('🔄 Force reloading products from server...');
        
        // Clear all caches first
        clearAllCaches();
        
        // Force reload from server
        try {
            const response = await fetch('/api/load-products/bridal', {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Force reload successful - got', data.products.length, 'products');
                return data.products;
            } else {
                console.error('❌ Force reload failed:', response.status);
                return [];
            }
        } catch (error) {
            console.error('❌ Force reload error:', error);
            return [];
        }
    }
    
    /**
     * Check if cache is stale and needs refresh
     */
    function isCacheStale() {
        try {
            const cacheTime = localStorage.getItem('bridalProductsTime');
            if (!cacheTime) return true;
            
            const now = Date.now();
            const cacheAge = now - parseInt(cacheTime);
            const maxAge = 5 * 60 * 1000; // 5 minutes
            
            return cacheAge > maxAge;
        } catch (e) {
            return true;
        }
    }
    
    /**
     * Update cache timestamp
     */
    function updateCacheTimestamp() {
        try {
            localStorage.setItem('bridalProductsTime', Date.now().toString());
        } catch (e) {
            console.warn('Error updating cache timestamp:', e);
        }
    }
    
    /**
     * Clear cache after product upload
     */
    function clearCacheAfterUpload() {
        console.log('🚀 Product uploaded - clearing cache for fresh data...');
        clearAllCaches();
        
        // Also clear any browser cache for the API endpoint
        if ('caches' in window) {
            caches.delete('bridal-products-cache').then(() => {
                console.log('✅ Browser cache cleared');
            });
        }
    }
    
    // Public API
    return {
        clearAllCaches,
        forceReloadProducts,
        isCacheStale,
        updateCacheTimestamp,
        clearCacheAfterUpload
    };
})();

// Make globally available
window.CacheOptimizer = CacheOptimizer;