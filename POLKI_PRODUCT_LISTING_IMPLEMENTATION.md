
# Polki Product Listing Implementation Guide

This document explains how to implement dynamic product listing functionality for the Polki Collection section, based on the existing implementation for Bridal and New Arrivals sections.

## Overview

The current Polki section only shows static hardcoded products. We need to make it dynamic like the Bridal and New Arrivals sections that load products from Firebase Storage via Netlify functions.

## Current Status

- ✅ **Bridal Section**: Working with dynamic Firebase loading (3 products)
- ✅ **New Arrivals Section**: Working with dynamic Firebase loading (2 products) 
- ❌ **Polki Section**: Static hardcoded products (needs to be dynamic)

## Implementation Requirements

### 1. HTML Structure Update

The Polki section in `index.html` currently has this structure:
```html
<!-- Polki Product Categories Section -->
<section class="polki-products full-width-section" style="margin-bottom: 20px;">
    <div class="product-scroll-container">
        <!-- Static hardcoded products here -->
    </div>
</section>
```

**CHANGE NEEDED**: Update to use the same structure as Bridal/New Arrivals:
```html
<!-- Polki Collection Section -->
<section class="polki-edit">
    <div class="polki-edit-container">
        <div class="polki-edit-header">
            <h2 class="section-title">Polki Collection</h2>
            <p class="section-subtitle">Exquisite Polki jewelry crafted with traditional artistry</p>
        </div>
        <div class="arrivals-grid">
            <!-- Products will be loaded here dynamically -->
        </div>
        <div class="polki-edit-cta">
            <a href="polki-collection.html" class="view-all-button">View All</a>
        </div>
    </div>
</section>
```

### 2. CSS Styling

Add CSS for the new Polki section structure in `css/styles.css`:

```css
/* Polki Edit Section */
.polki-edit {
    padding: 80px 0;
    background-color: #f8f8f5;
}

.polki-edit-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 20px;
}

.polki-edit-header {
    text-align: center;
    margin-bottom: 60px;
}

.polki-edit-header .section-title {
    font-family: 'Playfair Display', serif;
    font-size: 2.5rem;
    color: #333;
    margin-bottom: 15px;
    font-weight: 400;
}

.polki-edit-header .section-subtitle {
    font-size: 1.1rem;
    color: #666;
    margin: 0 0 0 0;
    font-weight: 300;
}

.polki-edit .arrivals-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 30px;
    margin-bottom: 50px;
}

.polki-edit-cta {
    text-align: center;
}

.polki-edit .view-all-button {
    display: inline-block;
    padding: 15px 30px;
    background: linear-gradient(135deg, #d4af37, #b8941f);
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: all 0.3s ease;
}

.polki-edit .view-all-button:hover {
    background: linear-gradient(135deg, #b8941f, #9a7b1a);
    transform: translateY(-2px);
}

/* Responsive Design */
@media (max-width: 768px) {
    .polki-edit {
        padding: 60px 0;
    }
    
    .polki-edit-header .section-title {
        font-size: 2rem;
    }
    
    .polki-edit .arrivals-grid {
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 20px;
    }
}
```

### 3. JavaScript Loader Implementation

The `js/polki-products-loader.js` file already exists and follows the correct pattern. Key features:

#### A. Firebase Integration
- Uses Firebase Storage to load products from `products-polki.json`
- Implements proper caching with ETag validation
- Falls back to Firestore if Storage fails

#### B. Product Loading Function
```javascript
async function loadPolkiProducts(forceRefresh = false) {
    // Loads products from Firebase Storage via Netlify function
    // Implements proper caching and error handling
    // Returns array of product objects
}
```

#### C. HTML Generation
```javascript
function generateProductHTML(product) {
    // Generates HTML for individual product cards
    // Uses same structure as Bridal/New Arrivals sections
    // Includes wishlist functionality
}
```

#### D. Section Update Function
```javascript
async function updatePolkiSection() {
    // Finds the .polki-edit .arrivals-grid container
    // Loads products and displays them
    // Sets up event listeners for wishlist buttons
}
```

### 4. Netlify Function

The Netlify function at `netlify/functions/load-products-polki.js` exists and handles:
- Loading `products-polki.json` from Firebase Storage
- Proper caching with ETag headers
- CORS headers for cross-origin requests
- Error handling and fallbacks

### 5. Firebase Storage Structure

Products are stored as JSON file: `products-polki.json`

Expected structure:
```json
[
    {
        "id": "PKN-01",
        "name": "Polki Necklace Collection",
        "price": 245000,
        "image": "productImages/polki-necklace-image.jpg",
        "description": "Exquisite polki necklace with traditional craftsmanship",
        "category": "polki",
        "stock": 5,
        "createdAt": "2024-01-15T10:30:00Z"
    }
]
```

### 6. Script Loading Order

In `index.html`, ensure proper script loading order:
```html
<!-- Firebase SDKs first -->
<script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-storage-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore-compat.js"></script>

<!-- Product loaders -->
<script src="js/polki-products-loader.js?v=1.0.0"></script>

<!-- Other scripts -->
<script src="js/wishlist-manager.js?v=1.0.0"></script>
```

## Implementation Steps

1. **Update HTML Structure**: Replace static Polki section with dynamic structure
2. **Add CSS Styling**: Add the Polki edit section styles to `css/styles.css`
3. **Verify Script Loading**: Ensure `js/polki-products-loader.js` is loaded after Firebase
4. **Test Firebase Connection**: Check that Firebase is properly initialized
5. **Upload Test Products**: Add some products to Firebase Storage as `products-polki.json`

## Expected Behavior After Implementation

1. **Loading State**: Shows spinner while loading products
2. **Product Display**: Shows products in grid layout with images, names, and prices
3. **Empty State**: Shows appropriate message if no products found
4. **Error Handling**: Shows error message if loading fails
5. **Wishlist Integration**: Allows adding products to wishlist
6. **Responsive Design**: Works on mobile and desktop

## Key Files to Modify

1. `index.html` - Update Polki section HTML structure
2. `css/styles.css` - Add Polki edit section styles

## Key Files Already Implemented

1. `js/polki-products-loader.js` - Product loading logic ✅
2. `netlify/functions/load-products-polki.js` - Backend function ✅
3. `data/polki-products.json` - Local fallback data ✅

## Testing Checklist

- [ ] Polki section shows loading spinner initially
- [ ] Products load from Firebase Storage
- [ ] Product cards display correctly
- [ ] Wishlist buttons work
- [ ] "View All" button links correctly
- [ ] Responsive design works on mobile
- [ ] Error states display properly
- [ ] Cache invalidation works when products are updated

## Notes

- The current `data/polki-products.json` is empty (`[]`), so you'll need to add products to Firebase Storage
- The loader is already configured to work with both local development and Netlify deployment
- Wishlist functionality is already integrated and will work automatically
- The implementation follows the exact same pattern as the working Bridal and New Arrivals sections
