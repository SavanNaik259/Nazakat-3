
/**
 * New Arrivals Products Loader
 * Dynamically loads products EXCLUSIVELY from Firebase Cloud Storage
 * Uses exact same approach as Kkt-project bridal section
 */

const NewArrivalsProductsLoader = (function() {
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
            console.log('Initializing New Arrivals Products Loader...');
            console.log('Firebase available:', typeof firebase !== 'undefined');

            if (typeof firebase !== 'undefined') {
                console.log('Firebase object:', firebase);
                console.log('Firebase apps:', firebase.apps);

                storage = firebase.storage();
                console.log('Storage instance:', storage);

                isInitialized = true;
                console.log('New Arrivals Products Loader initialized successfully');
                return true;
            } else {
                console.error('Firebase not available - make sure Firebase scripts are loaded');
                return false;
            }
        } catch (error) {
            console.error('Error initializing New Arrivals Products Loader:', error);
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
        console.log('Clearing new arrivals products cache...');
        cachedProducts = null;
        lastFetchTime = 0;
        try {
            localStorage.removeItem('newArrivalsProducts');
            localStorage.removeItem('newArrivalsProductsTime');
            localStorage.removeItem('newArrivalsProductsETag');
        } catch (e) {
            console.warn('Error clearing localStorage cache:', e);
        }
    }

    /**
     * Load new arrivals products EXCLUSIVELY from Firebase Cloud Storage
     */
    async function loadNewArrivalsProducts(forceRefresh = false) {
        if (!isInitialized) {
            console.error('New Arrivals Products Loader not initialized - Firebase connection failed');
            return [];
        }

        // Check if admin panel has invalidated cache by setting lastProductUpdate
        const lastProductUpdate = localStorage.getItem('lastProductUpdate');
        let cacheInvalidated = false;
        
        if (lastProductUpdate) {
            const updateTime = parseInt(lastProductUpdate);
            const cacheTime = parseInt(localStorage.getItem('newArrivalsProductsTime') || '0');
            
            if (updateTime > cacheTime) {
                console.log('🚨 Cache invalidated by admin panel update:', new Date(updateTime));
                cacheInvalidated = true;
                forceRefresh = true;
                // Clear the invalidation flag immediately to prevent continuous cache busting
                localStorage.removeItem('lastProductUpdate');
                console.log('✅ Cleared cache invalidation flag to restore CDN caching');
            }
        }

        // Check memory cache first
        const now = Date.now();
        
        if (!forceRefresh && !cacheInvalidated && cachedProducts && (now - lastFetchTime) < CACHE_DURATION) {
            console.log('Using memory cached new arrivals products');
            return cachedProducts;
        }

        // Check localStorage cache with ETag validation
        if (!forceRefresh && !cacheInvalidated) {
            try {
                const stored = localStorage.getItem('newArrivalsProducts');
                const storedTime = localStorage.getItem('newArrivalsProductsTime');
                const storedETag = localStorage.getItem('newArrivalsProductsETag');
                
                if (stored && storedTime && (now - parseInt(storedTime)) < SHORT_CACHE_DURATION) {
                    console.log('Using localStorage cached new arrivals products (ETag:', storedETag?.substring(0, 8) + ')');
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
            // Load products EXCLUSIVELY from Firebase Cloud Storage
            console.log('Loading new arrivals products from Cloud Storage...');
            
            let response;
            
            // Use Netlify function for proper CDN caching (works on both deployed and development)
            if (true) { // Always use Netlify function for CDN optimization
                console.log('Deployed site detected - using Netlify function endpoint');
                
                // Use Netlify function endpoint for proper cache control
                let netlifyEndpoint = '/.netlify/functions/load-products?category=new-arrivals';
                
                // Add cache busting parameter if force refresh or cache invalidated
                if (forceRefresh || cacheInvalidated) {
                    const timestamp = Date.now();
                    netlifyEndpoint += `&cacheBust=${timestamp}`;
                    console.log('Added cache busting parameter:', timestamp);
                }
                
                // Prepare headers for cache control
                const netlifyHeaders = {
                    'Content-Type': 'application/json'
                };
                
                // Add cache control headers for force refresh
                if (forceRefresh || cacheInvalidated) {
                    netlifyHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                    netlifyHeaders['Pragma'] = 'no-cache';
                    netlifyHeaders['Expires'] = '0';
                }
                
                // Add ETag for cache validation (only if not forcing refresh and cache not invalidated)
                const storedETag = localStorage.getItem('newArrivalsProductsETag');
                if (!forceRefresh && !cacheInvalidated && storedETag) {
                    netlifyHeaders['If-None-Match'] = storedETag;
                    console.log('Adding If-None-Match header:', storedETag.substring(0, 12) + '...');
                }
                
                console.log('Netlify endpoint:', netlifyEndpoint);
                console.log('Request headers:', netlifyHeaders);
                
                response = await fetch(netlifyEndpoint, {
                    method: 'GET',
                    headers: netlifyHeaders,
                    cache: (forceRefresh || cacheInvalidated) ? 'no-store' : 'default'
                });
                
                // Handle 304 Not Modified (only if we weren't forcing refresh)
                if (response.status === 304 && !forceRefresh && !cacheInvalidated) {
                    console.log('304 Not Modified - using cached products');
                    const stored = localStorage.getItem('newArrivalsProducts');
                    if (stored) {
                        try {
                            cachedProducts = JSON.parse(stored);
                            lastFetchTime = now;
                            console.log('Returning cached products from 304:', cachedProducts.length);
                            return cachedProducts;
                        } catch (e) {
                            console.warn('Error parsing cached products, forcing fresh load');
                            return await loadNewArrivalsProducts(true); // Force refresh
                        }
                    } else {
                        console.warn('304 received but no cached products available, forcing fresh load');
                        return await loadNewArrivalsProducts(true); // Force refresh
                    }
                }
                
                if (!response.ok) {
                    throw new Error(`Netlify function error: ${response.status} ${response.statusText}`);
                }
                
                // Store new ETag for next request
                const newETag = response.headers.get('etag');
                if (newETag) {
                    cachedETag = newETag;
                    console.log('Stored new ETag:', newETag.substring(0, 12) + '...');
                }
                
                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.message || 'Failed to load new arrivals products from Netlify function');
                }
                
                products = data.products || [];
                console.log('Successfully loaded products via Netlify function:', products.length);
            } else {
                // Local development - use server endpoint
                console.log('Local development detected - using server endpoint');
                
                const apiEndpoint = '/api/load-products/new-arrivals';
                
                // Prepare headers for cache validation
                const requestHeaders = {
                    'Content-Type': 'application/json'
                };
                
                // Add ETag for cache validation if we have one
                const storedETag = localStorage.getItem('newArrivalsProductsETag');
                if (storedETag && !forceRefresh) {
                    requestHeaders['If-None-Match'] = storedETag;
                }
                
                response = await fetch(apiEndpoint, {
                    method: 'GET',
                    headers: requestHeaders,
                    cache: 'default'
                });
                
                // Handle 304 Not Modified responses
                if (response.status === 304) {
                    console.log('Products not modified, using local cache');
                    const stored = localStorage.getItem('newArrivalsProducts');
                    if (stored) {
                        cachedProducts = JSON.parse(stored);
                        lastFetchTime = now;
                        return cachedProducts;
                    }
                }
                
                if (!response.ok) {
                    throw new Error(`Server error: ${response.status} ${response.statusText}`);
                }
                
                // Store ETag for future requests
                const responseETag = response.headers.get('ETag') || response.headers.get('etag');
                if (responseETag) {
                    localStorage.setItem('newArrivalsProductsETag', responseETag);
                    cachedETag = responseETag;
                    console.log('Stored new ETag:', responseETag.substring(0, 12) + '...');
                }
                
                const data = await response.json();
                if (!data.success) {
                    console.error('Server returned error:', data.error);
                    console.error('Error message:', data.message);
                    
                    // Check if this is a Firebase configuration error on Netlify
                    if (data.error && data.error.includes('Firebase Admin not configured')) {
                        console.error('NETLIFY DEPLOYMENT ISSUE: Firebase Admin credentials not set up');
                        console.error('Please check NETLIFY_DEPLOYMENT_FIX.md for setup instructions');
                    }
                    
                    products = data.products || [];
                    
                    // If no products and there's an error, show a helpful message
                    if (products.length === 0 && data.error) {
                        console.error('No products loaded due to error:', data.error);
                    }
                } else {
                    products = data.products || [];
                }
                console.log('Successfully loaded products via server:', products.length);
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
                localStorage.setItem('newArrivalsProducts', JSON.stringify(products));
                localStorage.setItem('newArrivalsProductsTime', now.toString());
                if (cachedETag) {
                    localStorage.setItem('newArrivalsProductsETag', cachedETag);
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
            console.error('Error loading new arrivals products:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            return [];
        }
    }

    /**
     * Generate HTML for a product item (matching you-may-also-like section design)
     */
    function generateProductHTML(product) {
        const formattedPrice = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(product.price);

        return `
            <div class="product-item" data-product-id="${product.id}" style="background: none;">
                <a href="#" style="text-decoration: none; color: inherit;">
                    <div class="product-image">
                        <img src="${product.image}" alt="${product.name}" loading="lazy">
                        <button class="add-to-wishlist" data-product-id="${product.id}" data-product-name="${product.name}" data-product-price="${product.price}" data-product-image="${product.image}">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                    <div class="product-details" style="text-align: center;">
                        <h3 class="product-name">${product.name}</h3>
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
        console.log('Setting up wishlist event listeners for new arrivals products...');
        
        // Find all wishlist buttons in the new arrivals section
        const newArrivalsSection = document.querySelector('.new-arrivals-edit, .new-arrivals');
        if (!newArrivalsSection) {
            console.warn('New arrivals section not found for wishlist setup');
            return;
        }
        
        const wishlistButtons = newArrivalsSection.querySelectorAll('.add-to-wishlist');
        console.log('Found', wishlistButtons.length, 'wishlist buttons in new arrivals section');
        
        wishlistButtons.forEach(button => {
            // Remove any existing listeners to prevent duplicates
            button.removeEventListener('click', handleWishlistButtonClick);
            
            // Add new listener
            button.addEventListener('click', handleWishlistButtonClick);
            console.log('Added wishlist listener to button for product:', button.dataset.productId);
        });
    }

    /**
     * Handle wishlist button clicks for new arrivals products
     */
    function handleWishlistButtonClick(event) {
        event.preventDefault();
        event.stopPropagation();
        
        console.log('New arrivals product wishlist button clicked');
        
        const button = event.target.closest('.add-to-wishlist');
        if (!button) {
            console.error('Wishlist button not found');
            return;
        }
        
        // Get the parent product container
        const productItem = button.closest('.product-item');
        if (!productItem) {
            console.error('Product container not found');
            return;
        }
        
        // Extract product data from the product container elements
        const productId = productItem.dataset.productId || button.dataset.productId;
        const productNameEl = productItem.querySelector('.product-name');
        const productName = productNameEl ? productNameEl.textContent.trim() : (button.dataset.productName || 'Unknown Product');
        
        // Get price from the price element in the product container
        const priceElement = productItem.querySelector('.current-price');
        let productPrice = 0;
        if (priceElement) {
            // Extract price from the formatted text (₹15,500.00 format)
            const priceText = priceElement.textContent.trim();
            console.log('Raw price text from new arrivals product:', priceText);
            
            // Remove currency symbols and commas, then parse
            const cleanedPrice = priceText.replace(/[₹,]/g, '').trim();
            productPrice = parseFloat(cleanedPrice);
            console.log('Extracted price for new arrivals product:', productPrice);
        } else {
            // Fallback to button data attribute
            productPrice = parseFloat(button.dataset.productPrice) || 0;
        }
        
        // Get image from the product container
        const imageElement = productItem.querySelector('.product-image img');
        const productImage = imageElement ? imageElement.src : (button.dataset.productImage || '');
        
        const productData = {
            id: productId,
            name: productName,
            price: productPrice,
            image: productImage
        };
        
        console.log('New arrivals product data extracted:', productData);
        
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
     * Update the New Arrivals section with loaded products using horizontal scroll layout
     */
    async function updateNewArrivalsSection() {
        // Look for the new arrivals section with horizontal scroll container
        const newArrivalsSection = document.querySelector('.new-arrivals-edit');
        let newArrivalsGrid = null;
        
        if (newArrivalsSection) {
            newArrivalsGrid = newArrivalsSection.querySelector('.arrivals-grid');
        }
        
        // Fallback to original selector
        if (!newArrivalsGrid) {
            newArrivalsGrid = document.querySelector('.new-arrivals .arrivals-grid, .new-arrivals-edit .arrivals-grid');
        }

        if (!newArrivalsGrid) {
            console.warn('New arrivals grid element not found');
            return;
        }

        try {
            // Show loading state
            const existingLoadingMsg = newArrivalsGrid.querySelector('.loading-products');
            if (!existingLoadingMsg) {
                const loadingDiv = document.createElement('div');
                loadingDiv.className = 'loading-products';
                loadingDiv.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 60px 20px;
                    text-align: center;
                    color: #5a3f2a;
                    font-family: 'Lato', sans-serif;
                    width: 100%;
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
                newArrivalsGrid.appendChild(loadingDiv);
            }

            // Load products from Firebase
            const products = await loadNewArrivalsProducts();

            // Remove loading indicator
            const loadingElements = newArrivalsGrid.querySelectorAll('.loading-products');
            loadingElements.forEach(el => el.remove());

            if (products.length > 0) {
                // Firebase products found - show in horizontal scroll layout like product categories
                console.log('Firebase products found, showing only Firebase products');
                
                // Clear existing content and set up horizontal scroll layout
                newArrivalsGrid.innerHTML = '';
                newArrivalsGrid.className = 'product-scroll-container';
                newArrivalsGrid.style.cssText = `
                    display: flex;
                    gap: 30px;
                    overflow-x: auto;
                    overflow-y: hidden;
                    scroll-behavior: smooth;
                    padding: 0 20px 20px 20px;
                    margin-bottom: 30px;
                    width: 100%;
                `;
                
                // Generate product HTML using product category design
                const firebaseProductsHTML = products.map(product => generateProductCategoryHTML(product)).join('');
                newArrivalsGrid.innerHTML = firebaseProductsHTML;
                
            } else {
                // No Firebase products found - show message
                console.log('No products found in Firebase');
                
                // Check if we're on Netlify and show appropriate message
                const isNetlify = window.location.hostname.includes('netlify') || window.location.hostname.includes('.app');
                const messageText = isNetlify 
                    ? 'If you recently deployed to Netlify, please ensure Firebase Admin credentials are configured in your Netlify environment variables.'
                    : 'Products will appear here once they are added through the admin panel.';
                
                newArrivalsGrid.innerHTML = `
                    <div class="no-products-message" style="text-align: center; padding: 40px 20px; width: 100%;">
                        <i class="fas fa-star" style="font-size: 48px; color: #5a3f2a; margin-bottom: 20px;"></i>
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

            console.log('New arrivals section updated with', products.length, 'products');
        } catch (error) {
            console.error('Error updating new arrivals section:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });

            // Show detailed error message
            const loadingElements = newArrivalsGrid.querySelectorAll('.loading-products');
            loadingElements.forEach(el => el.remove());

            const existingErrorMsg = newArrivalsGrid.querySelector('.loading-error');
            if (!existingErrorMsg) {
                const errorDiv = document.createElement('div');
                errorDiv.className = 'loading-error';
                errorDiv.style.cssText = 'color: red; padding: 10px; margin: 10px; border: 1px solid red; background: #ffe6e6;';
                errorDiv.innerHTML = `
                    <strong>Error loading new arrivals products:</strong><br>
                    ${error.message}<br>
                    <small>Check console for details. Showing default collection.</small>
                `;
                newArrivalsGrid.appendChild(errorDiv);
            }
        }
    }

    /**
     * Generate HTML for a product item using product category section design
     */
    function generateProductCategoryHTML(product) {
        const formattedPrice = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0
        }).format(product.price);

        return `
            <div class="product-item" data-product-id="${product.id}" style="background: none;">
                <a href="#" style="text-decoration: none; color: inherit;">
                    <div class="product-image">
                        <img src="${product.image}" alt="${product.name}" loading="lazy">
                        <button class="add-to-wishlist" data-product-id="${product.id}" data-product-name="${product.name}" data-product-price="${product.price}" data-product-image="${product.image}">
                            <i class="far fa-heart"></i>
                        </button>
                    </div>
                    <div class="product-details" style="text-align: center;">
                        <h3 class="product-name">${product.name}</h3>
                        <div class="product-pricing">
                            <span class="current-price">${formattedPrice}</span>
                        </div>
                    </div>
                </a>
            </div>
        `;
    }

    /**
     * Clear cached products (useful after adding/editing products)
     */
    function clearCache() {
        console.log('Clearing all new arrivals products cache...');
        cachedProducts = null;
        lastFetchTime = 0;
        cachedETag = null;
        try {
            localStorage.removeItem('newArrivalsProducts');
            localStorage.removeItem('newArrivalsProductsTime');
            localStorage.removeItem('newArrivalsProductsETag');
            console.log('localStorage cache cleared');
        } catch (e) {
            console.warn('Error clearing localStorage cache:', e);
        }
        console.log('All new arrivals products cache cleared');
    }

    // Public API
    return {
        init,
        loadNewArrivalsProducts,
        updateNewArrivalsSection,
        clearCache
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for Firebase to initialize
    setTimeout(() => {
        if (NewArrivalsProductsLoader.init()) {
            // Force refresh to bypass any cache issues
            NewArrivalsProductsLoader.loadNewArrivalsProducts(true).then(products => {
                console.log('Initial load completed with', products.length, 'products');
                NewArrivalsProductsLoader.updateNewArrivalsSection();
            }).catch(error => {
                console.error('Initial load failed:', error);
                NewArrivalsProductsLoader.updateNewArrivalsSection();
            });
        }
    }, 1000);
});

// Make available globally for debugging
window.NewArrivalsProductsLoader = NewArrivalsProductsLoader;
