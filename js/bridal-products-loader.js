
/**
 * Bridal Products Loader
 * Dynamically loads products EXCLUSIVELY from Firebase Cloud Storage
 */

const BridalProductsLoader = (function() {
    let storage;
    let isInitialized = false;
    let cachedProducts = null;
    let lastFetchTime = 0;
    let cachedETag = null;
    const CACHE_DURATION = 30 * 1000; // 30 seconds cache for immediate updates
    const SHORT_CACHE_DURATION = 10 * 1000; // 10 seconds for localStorage
    const MAX_PRODUCTS_TO_FETCH = 6; // Limit products fetched

    /**
     * Initialize Firebase Storage connection
     */
    function init() {
        try {
            console.log('Initializing Bridal Products Loader...');
            console.log('Firebase available:', typeof firebase !== 'undefined');

            if (typeof firebase !== 'undefined') {
                console.log('Firebase object:', firebase);
                console.log('Firebase apps:', firebase.apps);

                storage = firebase.storage();
                console.log('Storage instance:', storage);

                isInitialized = true;
                console.log('Bridal Products Loader initialized successfully');
                return true;
            } else {
                console.error('Firebase not available - make sure Firebase scripts are loaded');
                return false;
            }
        } catch (error) {
            console.error('Error initializing Bridal Products Loader:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            return false;
        }
    }

    /**
     * Clear all caches - called when products are updated
     */
    function clearCache() {
        console.log('Clearing bridal products cache...');
        cachedProducts = null;
        lastFetchTime = 0;
        try {
            localStorage.removeItem('bridalProducts');
            localStorage.removeItem('bridalProductsTime');
            localStorage.removeItem('bridalProductsETag');
        } catch (e) {
            console.warn('Error clearing localStorage cache:', e);
        }
    }

    /**
     * Load bridal products EXCLUSIVELY from Firebase Cloud Storage
     */
    async function loadBridalProducts(forceRefresh = false) {
        if (!isInitialized) {
            console.error('Bridal Products Loader not initialized - Firebase connection failed');
            return [];
        }

        // Check if admin panel has invalidated cache by setting lastProductUpdate
        const lastProductUpdate = localStorage.getItem('lastProductUpdate');
        let cacheInvalidated = false;
        
        if (lastProductUpdate) {
            const updateTime = parseInt(lastProductUpdate);
            const cacheTime = parseInt(localStorage.getItem('bridalProductsTime') || '0');
            
            if (updateTime > cacheTime) {
                console.log('🚨 Cache invalidated by admin panel update:', new Date(updateTime));
                cacheInvalidated = true;
                forceRefresh = true;
            }
        }

        // Check memory cache first
        const now = Date.now();
        
        if (!forceRefresh && !cacheInvalidated && cachedProducts && (now - lastFetchTime) < CACHE_DURATION) {
            console.log('Using memory cached bridal products');
            return cachedProducts;
        }

        // Check localStorage cache with ETag validation
        if (!forceRefresh && !cacheInvalidated) {
            try {
                const stored = localStorage.getItem('bridalProducts');
                const storedTime = localStorage.getItem('bridalProductsTime');
                const storedETag = localStorage.getItem('bridalProductsETag');
                
                if (stored && storedTime && (now - parseInt(storedTime)) < SHORT_CACHE_DURATION) {
                    console.log('Using localStorage cached bridal products (ETag:', storedETag?.substring(0, 8) + ')');
                    cachedProducts = JSON.parse(stored);
                    cachedETag = storedETag;
                    lastFetchTime = parseInt(storedTime);
                    return cachedProducts;
                }
            } catch (e) {
                console.warn('Error reading from localStorage cache:', e);
            }
        }

        let products = [];

        try {
            // Load products DIRECTLY from Firebase Storage CDN - NO PROXY LAYERS
            console.log('Loading bridal products DIRECTLY from Firebase Storage CDN...');
            
            // DIRECT Firebase Storage CDN URL - NO PROXY LAYERS
            const directCDNUrl = `https://firebasestorage.googleapis.com/v0/b/auric-a0c92.firebasestorage.app/o/products%2Fbridal-products.json?alt=media`;
            
            console.log('🚀 DIRECT CDN ACCESS for Bridal:', directCDNUrl);
            console.log('🌐 This bypasses all proxy layers for true CDN caching!');
            
            // Add cache busting only if absolutely necessary
            let finalUrl = directCDNUrl;
            if (forceRefresh || cacheInvalidated) {
                const timestamp = Date.now();
                finalUrl += `&cacheBust=${timestamp}`;
                console.log('Added cache busting parameter:', timestamp);
            }
            
            // Fetch directly from Firebase Storage CDN
            const response = await fetch(finalUrl, {
                method: 'GET',
                cache: (forceRefresh || cacheInvalidated) ? 'no-store' : 'default' // Allow CDN caching
            });
            
            // Handle 404 - file doesn't exist yet
            if (response.status === 404) {
                console.log('Bridal products file not found - will show empty state');
                return [];
            }
            
            if (!response.ok) {
                throw new Error(`Firebase Storage error: ${response.status} ${response.statusText}`);
            }
            
            // Parse JSON response directly from Firebase Storage
            const responseText = await response.text();
            
            // Handle empty response
            if (!responseText.trim()) {
                console.log('Empty response from Firebase Storage');
                return [];
            }
            
            try {
                products = JSON.parse(responseText);
                console.log('Successfully loaded products directly from Firebase Storage CDN:', products.length);
                
                // Store ETag for future cache validation
                const newETag = response.headers.get('etag');
                if (newETag) {
                    cachedETag = newETag;
                    localStorage.setItem('bridalProductsETag', newETag);
                    console.log('Stored new ETag:', newETag.substring(0, 12) + '...');
                }
            } catch (parseError) {
                console.error('Error parsing JSON response:', parseError);
                console.log('Response text:', responseText.substring(0, 200) + '...');
                return [];
            }
            
            // Validate and filter products
            products = products.filter(product => {
                const isValid = product.name && product.price && product.image;
                if (!isValid) {
                    console.warn('Skipping invalid product from Storage:', product);
                }
                return isValid;
            });
            
            // Limit products if needed
            if (products.length > MAX_PRODUCTS_TO_FETCH) {
                products = products.slice(0, MAX_PRODUCTS_TO_FETCH);
            }

            // Cache the results in memory and localStorage
            cachedProducts = products;
            lastFetchTime = now;

            try {
                localStorage.setItem('bridalProducts', JSON.stringify(products));
                localStorage.setItem('bridalProductsTime', now.toString());
                if (cachedETag) {
                    localStorage.setItem('bridalProductsETag', cachedETag);
                }
                console.log('Cached', products.length, 'products with ETag:', cachedETag?.substring(0, 8) + '...');
                
                // Clear the product update flag since we've successfully loaded fresh data
                if (cacheInvalidated) {
                    localStorage.removeItem('lastProductUpdate');
                    console.log('✅ Cleared cache invalidation flag after successful fresh load');
                }
            } catch (e) {
                console.warn('Error saving to localStorage cache:', e);
            }

            console.log('Final product count loaded:', products.length);
            return products;
            
        } catch (error) {
            console.error('Error loading bridal products:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            return [];
        }
    }

    /**
     * Generate HTML for a product item
     */
    function generateProductHTML(product) {
        const formattedPrice = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(product.price);

        return `
            <div class="arrival-item bridal-card" data-product-id="${product.id}">
                <a href="#" style="text-decoration: none; color: inherit;">
                    <div class="arrival-image">
                        <img src="${product.image}" alt="${product.name}" loading="lazy">
                        <button class="add-to-wishlist" data-product-id="${product.id}" data-product-name="${product.name}" data-product-price="${product.price}" data-product-image="${product.image}">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                    <div class="arrival-details">
                        <h3 class="arrival-title">${product.name}</h3>
                        <div class="product-pricing">
                            <span class="current-price">${formattedPrice}</span>
                        </div>
                    </div>
                </a>
            </div>
        `;
    }

    /**
     * Set up event listeners for wishlist buttons in dynamically generated content
     */
    function setupWishlistEventListeners() {
        console.log('Setting up wishlist event listeners for bridal products...');
        
        // Find all wishlist buttons in the bridal section
        const bridalSection = document.querySelector('.bridal-edit');
        if (!bridalSection) {
            console.warn('Bridal section not found for wishlist setup');
            return;
        }
        
        const wishlistButtons = bridalSection.querySelectorAll('.add-to-wishlist');
        console.log('Found', wishlistButtons.length, 'wishlist buttons in bridal section');
        
        wishlistButtons.forEach(button => {
            // Remove any existing listeners to prevent duplicates
            button.removeEventListener('click', handleWishlistButtonClick);
            
            // Add new listener
            button.addEventListener('click', handleWishlistButtonClick);
            console.log('Added wishlist listener to button for product:', button.dataset.productId);
        });
    }

    /**
     * Handle wishlist button clicks for bridal products
     */
    function handleWishlistButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('Bridal product wishlist button clicked');
        
        const button = event.target.closest('.add-to-wishlist');
        if (!button) {
            console.error('Wishlist button not found');
            return;
        }
        
        // Get the parent product container
        const productItem = button.closest('.arrival-item') || button.closest('.bridal-card');
        if (!productItem) {
            console.error('Product container not found');
            return;
        }
        
        // Extract product data from the product container elements
        const productId = productItem.dataset.productId || button.dataset.productId;
        const productNameEl = productItem.querySelector('.arrival-title');
        const productName = productNameEl ? productNameEl.textContent.trim() : (button.dataset.productName || 'Unknown Product');
        
        // Get price from the price element in the product container
        const priceElement = productItem.querySelector('.current-price');
        let productPrice = 0;
        if (priceElement) {
            // Extract price from the formatted text (₹15,500.00 format)
            const priceText = priceElement.textContent.trim();
            console.log('Raw price text from bridal product:', priceText);
            
            // Remove currency symbols and commas, then parse
            const cleanedPrice = priceText.replace(/[₹,]/g, '').trim();
            productPrice = parseFloat(cleanedPrice);
            console.log('Extracted price for bridal product:', productPrice);
        } else {
            // Fallback to button data attribute
            productPrice = parseFloat(button.dataset.productPrice) || 0;
        }
        
        // Get image from the product container
        const imageElement = productItem.querySelector('.arrival-image img');
        const productImage = imageElement ? imageElement.src : (button.dataset.productImage || '');
        
        const productData = {
            id: productId,
            name: productName,
            price: productPrice,
            image: productImage
        };
        
        console.log('Bridal product data extracted:', productData);
        
        // Call the global wishlist manager if available
        if (typeof WishlistManager !== 'undefined') {
            // Check if item is already in wishlist and toggle accordingly
            if (WishlistManager.isInWishlist(productId)) {
                console.log('Removing from wishlist:', productName);
                WishlistManager.removeFromWishlist(productId);
                // Update icon to regular heart
                const icon = button.querySelector('i');
                if (icon) {
                    icon.classList.add('far');
                    icon.classList.remove('fas');
                }
            } else {
                console.log('Adding to wishlist:', productName);
                WishlistManager.addToWishlist(productData);
                // Update icon to solid heart
                const icon = button.querySelector('i');
                if (icon) {
                    icon.classList.remove('far');
                    icon.classList.add('fas');
                }
            }
        } else {
            console.error('WishlistManager not available');
            // Fallback: show a simple message
            alert(`${productData.name} added to wishlist!`);
        }
    }

    /**
     * Update the Bridal Edit section with loaded products
     */
    async function updateBridalSection() {
        const bridalGrid = document.querySelector('.bridal-edit .arrivals-grid');

        if (!bridalGrid) {
            console.warn('Bridal grid element not found');
            return;
        }

        try {
            // Show loading state without clearing existing products
            const existingLoadingMsg = bridalGrid.querySelector('.loading-products');
            if (!existingLoadingMsg) {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading-products';
                loadingDiv.style.cssText = `
                    grid-column: 1 / -1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 20px;
                    text-align: center;
                    color: #5a3f2a;
                    font-family: 'Lato', sans-serif;
                `;
                loadingDiv.innerHTML = `
                    <div class="loading-spinner" style="
                        width: 40px;
                        height: 40px;
                        border: 3px solid #f3f3f3;
                        border-top: 3px solid #5a3f2a;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin-bottom: 15px;
                    "></div>
                    <p style="margin: 0; font-size: 16px; font-weight: 500;">Loading Products...</p>
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                `;
                bridalGrid.insertBefore(loadingDiv, bridalGrid.firstChild);
            }

            // Load products from Firebase
            const products = await loadBridalProducts();

            // Remove loading indicator
            const loadingElements = bridalGrid.querySelectorAll('.loading-products');
            loadingElements.forEach(el => el.remove());

            if (products.length > 0) {
                // Firebase products found - show only these
                console.log('Firebase products found, showing only Firebase products');
                const firebaseProductsHTML = products.map(product => generateProductHTML(product)).join('');
                bridalGrid.innerHTML = firebaseProductsHTML;
            } else {
                // No Firebase products found - show message
                console.log('No products found in Firebase');
                
                // Check if we're on Netlify and show appropriate message
                const isNetlify = window.location.hostname.includes('netlify') || window.location.hostname.includes('.app');
                const messageText = isNetlify 
                    ? 'If you recently deployed to Netlify, please ensure Firebase Admin credentials are configured in your Netlify environment variables.'
                    : 'Products will appear here once they are added through the admin panel.';
                
                bridalGrid.innerHTML = `
                    <div class="no-products-message" style="grid-column: 1 / -1; text-align: center; padding: 40px 20px;">
                        <i class="fas fa-gem" style="font-size: 48px; color: #5a3f2a; margin-bottom: 20px;"></i>
                        <h3 style="color: #5a3f2a; margin-bottom: 10px;">No Products Available</h3>
                        <p style="color: #666;">${messageText}</p>
                    </div>
                `;
            }

            // Reinitialize event listeners for dynamically generated product cards
            setupWishlistEventListeners();
            
            // Reinitialize any other event listeners if needed
            if (window.reinitializeProductEvents) {
                window.reinitializeProductEvents();
            }

            console.log('Bridal section updated with', products.length, 'products');
        } catch (error) {
            console.error('Error updating bridal section:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });

            // Show detailed error message
            const loadingElements = bridalGrid.querySelectorAll('.loading-products');
            loadingElements.forEach(el => el.remove());

            const existingErrorMsg = bridalGrid.querySelector('.loading-error');
            if (!existingErrorMsg) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'loading-error';
                errorDiv.style.cssText = 'color: red; padding: 10px; margin: 10px; border: 1px solid red; background: #ffe6e6;';
                errorDiv.innerHTML = `
                    <strong>Error loading bridal products:</strong><br>
                    ${error.message}<br>
                    <small>Check console for details. Showing default collection.</small>
                `;
                bridalGrid.insertBefore(errorDiv, bridalGrid.firstChild);
            }
        }
    }

    /**
     * Clear cached products (useful after adding/editing products)
     */
    function clearCache() {
        console.log('Clearing all bridal products cache...');
        cachedProducts = null;
        lastFetchTime = 0;
        cachedETag = null;
        try {
            localStorage.removeItem('bridalProducts');
            localStorage.removeItem('bridalProductsTime');
            localStorage.removeItem('bridalProductsETag');
            console.log('localStorage cache cleared');
        } catch (e) {
            console.warn('Error clearing localStorage cache:', e);
        }
        console.log('All bridal products cache cleared');
    }

    // Public API
    return {
        init,
        loadBridalProducts,
        updateBridalSection,
        clearCache
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for Firebase to initialize
    setTimeout(() => {
        if (BridalProductsLoader.init()) {
            // Force refresh to bypass any cache issues
            BridalProductsLoader.loadBridalProducts(true).then(products => {
                console.log('Initial load completed with', products.length, 'products');
                BridalProductsLoader.updateBridalSection();
            }).catch(error => {
                console.error('Initial load failed:', error);
                BridalProductsLoader.updateBridalSection();
            });
        }
    }, 1000);
});
