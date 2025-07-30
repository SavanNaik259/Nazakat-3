/**
 * Global Cache Invalidation System
 * Handles cache invalidation across all product loading systems
 */

window.CacheInvalidator = (function() {
    'use strict';

    // Cache keys to manage
    const CACHE_KEYS = [
        'bridalProducts',
        'bridalProductsTime', 
        'bridalProductsETag',
        'lastProductUpdate'
    ];

    /**
     * Detect current environment
     */
    function getEnvironment() {
        const hostname = window.location.hostname;
        const isNetlify = hostname.includes('netlify') || hostname.includes('.app');
        return {
            isNetlify,
            hostname,
            environment: isNetlify ? 'netlify' : 'local'
        };
    }

    /**
     * Get appropriate API endpoint for current environment
     */
    function getApiEndpoint(category = 'bridal') {
        const env = getEnvironment();
        return env.isNetlify 
            ? `/.netlify/functions/load-products?category=${category}`
            : `/api/load-products/${category}`;
    }

    /**
     * Clear all cache keys from localStorage
     */
    function clearLocalStorageCache() {
        console.log('🧹 Clearing localStorage cache...');
        let clearedCount = 0;

        CACHE_KEYS.forEach(key => {
            try {
                if (localStorage.getItem(key)) {
                    localStorage.removeItem(key);
                    clearedCount++;
                    console.log(`✅ Cleared: ${key}`);
                }
            } catch (e) {
                console.warn(`❌ Failed to clear ${key}:`, e);
            }
        });

        console.log(`🎯 Cleared ${clearedCount} cache entries from localStorage`);
        return clearedCount > 0;
    }

    /**
     * Clear module-specific caches
     */
    function clearModuleCaches() {
        console.log('🔄 Clearing module caches...');
        let modulesCleared = 0;

        // Clear BridalProductsLoader cache
        if (window.BridalProductsLoader && typeof window.BridalProductsLoader.clearCache === 'function') {
            try {
                window.BridalProductsLoader.clearCache();
                modulesCleared++;
                console.log('✅ BridalProductsLoader cache cleared');
            } catch (e) {
                console.warn('❌ Failed to clear BridalProductsLoader cache:', e);
            }
        }

        // Clear any other product loader caches here
        // Add more module cache clearing logic as needed

        console.log(`🎯 Cleared ${modulesCleared} module caches`);
        return modulesCleared > 0;
    }

    /**
     * Set cache invalidation flag
     */
    function setCacheInvalidationFlag() {
        const timestamp = Date.now();
        try {
            localStorage.setItem('lastProductUpdate', timestamp.toString());
            console.log('🚨 Set cache invalidation flag:', new Date(timestamp));
            return timestamp;
        } catch (e) {
            console.warn('❌ Failed to set cache invalidation flag:', e);
            return null;
        }
    }

    /**
     * Force cache invalidation by making a cache-busting request
     */
    async function forceCacheInvalidation(category = 'bridal') {
        const timestamp = Date.now();
        const endpoint = getApiEndpoint(category);
        const cacheBustEndpoint = `${endpoint}${endpoint.includes('?') ? '&' : '?'}cacheBust=${timestamp}`;

        console.log('🌐 Forcing cache invalidation via:', cacheBustEndpoint);

        try {
            const response = await fetch(cacheBustEndpoint, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

            console.log('📡 Cache invalidation response:', response.status, response.statusText);
            return response.ok;
        } catch (error) {
            console.warn('❌ Cache invalidation request failed:', error);
            return false;
        }
    }

    /**
     * Trigger fresh reload of product loaders
     */
    async function triggerFreshReload() {
        console.log('🔄 Triggering aggressive fresh reload of product loaders...');

        // Trigger BridalProductsLoader refresh if available
        if (window.BridalProductsLoader && typeof window.BridalProductsLoader.loadBridalProducts === 'function') {
            try {
                console.log('🔄 Force refreshing BridalProductsLoader with cache bypass...');

                // First clear the loader's internal cache
                if (typeof window.BridalProductsLoader.clearCache === 'function') {
                    window.BridalProductsLoader.clearCache();
                    console.log('🧹 Cleared BridalProductsLoader internal cache');
                }

                // Force refresh with forceRefresh=true
                await window.BridalProductsLoader.loadBridalProducts(true);
                console.log('✅ BridalProductsLoader force refreshed');

                // Update bridal section if available
                if (typeof window.BridalProductsLoader.updateBridalSection === 'function') {
                    window.BridalProductsLoader.updateBridalSection();
                    console.log('✅ Bridal section updated with fresh data');
                }

                // Double-check by doing another refresh after a short delay
                setTimeout(async () => {
                    try {
                        console.log('🔄 Double-checking with secondary refresh...');
                        await window.BridalProductsLoader.loadBridalProducts(true);
                        window.BridalProductsLoader.updateBridalSection();
                        console.log('✅ Secondary refresh completed');
                    } catch (e) {
                        console.warn('⚠️ Secondary refresh failed:', e);
                    }
                }, 1000);

            } catch (e) {
                console.warn('❌ Failed to refresh BridalProductsLoader:', e);
            }
        } else {
            console.warn('⚠️ BridalProductsLoader not available for fresh reload');
        }

        // Trigger PolkiProductsLoader refresh if available
        if (window.PolkiProductsLoader && typeof window.PolkiProductsLoader.loadPolkiProducts === 'function') {
            try {
                console.log('🔄 Force refreshing PolkiProductsLoader with cache bypass...');

                // First clear the loader's internal cache
                if (typeof window.PolkiProductsLoader.clearCache === 'function') {
                    window.PolkiProductsLoader.clearCache();
                    console.log('🧹 Cleared PolkiProductsLoader internal cache');
                }

                // Force refresh with forceRefresh=true
                await window.PolkiProductsLoader.loadPolkiProducts(true);
                console.log('✅ PolkiProductsLoader force refreshed');

                // Update polki section if available
                if (typeof window.PolkiProductsLoader.updatePolkiSection === 'function') {
                    window.PolkiProductsLoader.updatePolkiSection();
                    console.log('✅ Polki section updated with fresh data');
                }

                // Double-check by doing another refresh after a short delay
                setTimeout(async () => {
                    try {
                        console.log('🔄 Double-checking with secondary refresh...');
                        await window.PolkiProductsLoader.loadPolkiProducts(true);
                        window.PolkiProductsLoader.updatePolkiSection();
                        console.log('✅ Secondary refresh completed');
                    } catch (e) {
                        console.warn('⚠️ Secondary refresh failed:', e);
                    }
                }, 1000);

            } catch (e) {
                console.warn('❌ Failed to refresh PolkiProductsLoader:', e);
            }
        } else {
            console.warn('⚠️ PolkiProductsLoader not available for fresh reload');
        }
    }

    /**
     * Complete cache invalidation process
     * This is the main function to call when products are updated
     */
    async function invalidateAllCaches(category = 'bridal') {
        console.log('🚨 Starting complete cache invalidation process...');
        const startTime = Date.now();

        try {
            // Step 1: Clear all localStorage caches
            const localStorageCleared = clearLocalStorageCache();

            // Step 2: Clear module caches
            const moduleCachesCleared = clearModuleCaches();

            // Step 3: Set cache invalidation flag for future loads
            const invalidationFlag = setCacheInvalidationFlag();

            // Step 4: Force aggressive browser cache clearing
            await clearBrowserHttpCache();

            // Step 5: Force server cache invalidation
            const serverInvalidated = await forceCacheInvalidation(category);

            // Step 6: Trigger fresh reload of loaders with force refresh
            await triggerFreshReload();

            const duration = Date.now() - startTime;

            console.log('✅ Complete cache invalidation finished in', duration, 'ms');
            console.log('📊 Results:', {
                localStorageCleared,
                moduleCachesCleared,
                invalidationFlag: !!invalidationFlag,
                serverInvalidated,
                duration: duration + 'ms'
            });

            return {
                success: true,
                localStorageCleared,
                moduleCachesCleared,
                serverInvalidated,
                duration
            };

        } catch (error) {
            console.error('❌ Cache invalidation process failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Clear browser HTTP cache aggressively
     */
    async function clearBrowserHttpCache() {
        console.log('🌐 Clearing browser HTTP cache...');

        const env = getEnvironment();
        const timestamp = Date.now();

        // Create multiple cache-busting requests to flush browser cache
        const urls = [
            env.isNetlify ? `/.netlify/functions/load-products?category=bridal&flush=${timestamp}` : `/api/load-products/bridal?flush=${timestamp}`,
            env.isNetlify ? `/.netlify/functions/load-products?category=bridal&bust=${timestamp}` : `/api/load-products/bridal?bust=${timestamp}`,
        ];

        const promises = urls.map(url => {
            return fetch(url, {
                method: 'GET',
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            }).then(response => {
                console.log(`🗑️ Browser cache bust request: ${url} - ${response.status}`);
                return response.ok;
            }).catch(error => {
                console.warn(`⚠️ Browser cache bust failed for ${url}:`, error);
                return false;
            });
        });

        await Promise.all(promises);
        console.log('✅ Browser HTTP cache clearing completed');
    }

    /**
     * Simple cache clear for manual testing
     */
    function clearAllCaches() {
        console.log('🧹 Manual cache clear requested...');
        clearLocalStorageCache();
        clearModuleCaches();
        console.log('✅ Manual cache clear completed');
    }

    /**
     * Nuclear option: Force page reload if cache invalidation isn't working
     */
    function forcePageReload(delay = 2000) {
        console.log('💥 Nuclear cache clear: forcing page reload in', delay, 'ms');
        setTimeout(() => {
            window.location.reload(true); // Force reload from server
        }, delay);
    }

    /**
     * Check if cache invalidation is working properly
     */
    function isCacheInvalidationWorking() {
        const flag = localStorage.getItem('lastProductUpdate');
        const cacheTime = localStorage.getItem('bridalProductsTime');

        if (!flag) return true; // No invalidation needed

        const flagTime = parseInt(flag);
        const cache = parseInt(cacheTime || '0');

        // If flag is newer than cache, invalidation is pending
        return flagTime <= cache;
    }

    // Public API
    return {
        invalidateAllCaches,
        clearAllCaches,
        getEnvironment,
        getApiEndpoint,
        setCacheInvalidationFlag,
        forceCacheInvalidation,
        triggerFreshReload,
        forcePageReload,
        isCacheInvalidationWorking,
        clearBrowserHttpCache
    };
})();

// Auto-initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    const env = window.CacheInvalidator.getEnvironment();
    console.log('🌍 Cache Invalidator initialized for', env.environment, 'environment');
});