/**
 * Auric Combined Server
 * 
 * This server combines both static file serving and API endpoints for:
 * 1. Serving static website files
 * 2. Handling order confirmation emails using Nodemailer
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');
const admin = require('firebase-admin');
const crypto = require('crypto');
const multer = require('multer');

// In-memory cache for products
const productCache = {};
const PRODUCT_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

// Load environment variables
dotenv.config();

// Import email service
const emailService = require('./server/email/service');

// Port configuration
const PORT = process.env.PORT || 5000;

// Initialize Express app
const app = express();

// Apply middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Add cache headers based on endpoint type
app.use((req, res, next) => {
  // Allow caching for product data to improve performance
  if (req.url.startsWith('/api/load-products/')) {
    // Cache product data for 5 minutes (browser cache)
    res.setHeader('Cache-Control', 'public, max-age=300');
    // Use a stable ETag based on URL (will be updated with actual data hash later)
    res.setHeader('ETag', `"products-${req.url.replace(/[^a-zA-Z0-9]/g, '-')}"`);
  } else {
    // No cache for other API endpoints and dynamic content
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// API Endpoints
// =============

/**
 * Send order confirmation emails
 * Sends emails to both the customer and store owner
 */
app.post('/api/send-order-email', async (req, res) => {
  try {
    // Get order data from request body
    const orderData = req.body;

    // Validate required data
    if (!orderData || !orderData.customer || !orderData.products) {
      return res.status(400).json({
        success: false,
        message: 'Missing required order data'
      });
    }

    console.log('Received order email request for:', orderData.orderReference);

    // Send emails
    const result = await emailService.sendOrderEmails(orderData);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Order emails sent successfully',
        result
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to send order emails',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error in send-order-email endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while sending order emails',
      error: error.message
    });
  }
});

/**
 * Create a Razorpay order
 */
app.post('/api/create-razorpay-order', async (req, res) => {
  try {
    // Import Razorpay
    const Razorpay = require('razorpay');

    // Create a Razorpay instance
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    // Get order details from request body
    const { amount, currency = 'INR', receipt, notes } = req.body;

    // Validate required data
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'Missing required order data (amount)'
      });
    }

    console.log('Creating Razorpay order for amount:', amount);

    // Convert amount to paise (Razorpay uses smallest currency unit)
    const amountInPaise = Math.round(amount * 100);

    // Create order
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency,
      receipt,
      notes
    });

    // Return order details
    return res.status(200).json({
      success: true,
      order,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order',
      error: error.message
    });
  }
});

/**
 * Verify Razorpay payment
 */
app.post('/api/verify-razorpay-payment', async (req, res) => {
  try {
    // Get payment details from request body
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    // Validate required data
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification data'
      });
    }

    console.log('Verifying Razorpay payment:', razorpay_payment_id);

    // Create the signature verification data
    const crypto = require('crypto');
    const secret = process.env.RAZORPAY_KEY_SECRET;
    const generated_signature = crypto
      .createHmac('sha256', secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest('hex');

    // Verify the signature
    if (generated_signature === razorpay_signature) {
      return res.status(200).json({
        success: true,
        message: 'Payment verified successfully'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }
  } catch (error) {
    console.error('Error verifying Razorpay payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while verifying payment',
      error: error.message
    });
  }
});

/**
 * Load products from Firebase Cloud Storage with ETag optimization
 * Implements must-revalidate caching for immediate updates with long-term caching
 */
app.get('/api/load-products/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const cacheBust = req.query.cacheBust;
    
    // Detect if this is a cache-busting request from admin panel
    const isCacheBust = !!cacheBust;
    if (isCacheBust) {
      console.log(`Loading ${category} products with cache busting (${cacheBust}) for admin panel...`);
    } else {
      console.log(`Loading ${category} products from Firebase Storage CDN...`);
    }

    // Simple fetch from Firebase Storage - their CDN handles all caching automatically
    // Check if this is a bandwidth test category
    const isBandwidthTest = category.startsWith('bandwidth-test-');
    let storageUrl = isBandwidthTest 
      ? `https://firebasestorage.googleapis.com/v0/b/auric-a0c92.firebasestorage.app/o/bandwidthTest%2F${category}-products.json?alt=media`
      : `https://firebasestorage.googleapis.com/v0/b/auric-a0c92.firebasestorage.app/o/productData%2F${category}-products.json?alt=media&token=c6a2eb63-56e3-4fc0-96ac-66773cf45f96`;

    // Add cache busting to Firebase Storage URL for admin panel requests
    if (isCacheBust) {
      storageUrl += `&fbCacheBust=${cacheBust}`;
    }

    const fetchOptions = isCacheBust ? {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    } : {};

    const response = await fetch(storageUrl, fetchOptions);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No ${category} products found in Firebase Storage`);
        return res.json({
          success: true,
          products: [],
          count: 0,
          category: category,
          message: `No ${category} products found - add some through the admin panel`
        });
      }
      throw new Error(`Failed to fetch from storage: ${response.status}`);
    }

    const products = await response.json();
    const content = JSON.stringify(products);

    // Generate content-based ETag for optimal caching
    const crypto = require('crypto');
    const contentHash = crypto.createHash('md5').update(content).digest('hex');
    const serverETag = `"products-${category}-${contentHash.substring(0, 8)}"`;

    console.log(`Generated ETag for ${category}:`, serverETag);

    // Check if client has current version (ETag validation) - but skip for cache busting
    const clientETag = req.headers['if-none-match'];
    if (!isCacheBust && clientETag && clientETag === serverETag) {
      console.log(`ETag match for ${category} - returning 304 Not Modified (zero bandwidth)`);
      res.status(304).end();
      return;
    }

    console.log(`ETag mismatch or no client ETag - returning fresh data`);
    console.log(`Successfully loaded ${products.length} ${category} products`);

    // Set cache headers based on request type
    if (isCacheBust) {
      // Cache-busting request from admin panel - no caching
      res.set({
        'ETag': serverETag,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Last-Modified': new Date().toUTCString()
      });
    } else {
      // Normal request - optimal caching (match Netlify function exactly)
      res.set({
        'ETag': serverETag,
        'Cache-Control': 'public, max-age=31536000, must-revalidate', // 1 year cache with must-revalidate
        'Netlify-CDN-Cache-Control': 'public, max-age=31536000, durable', // Netlify CDN specific
        'Last-Modified': new Date().toUTCString()
      });
    }

    res.json({
      success: true,
      products: products,
      count: products.length,
      category: category,
      cached: false,
      etag: serverETag,
      message: `Loaded ${products.length} ${category} products from Firebase Storage`
    });

  } catch (error) {
    console.error('Error loading products:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      products: []
    });
  }
});

/**
 * Local Netlify function proxy for load-products (for CDN testing)
 * Mimics the Netlify function behavior for local testing with proper CDN headers
 */
app.get('/.netlify/functions/load-products', async (req, res) => {
  try {
    const category = req.query.category;
    const cacheBust = req.query.cacheBust;
    
    if (!category) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing category parameter',
        usage: '/.netlify/functions/load-products?category=bridal'
      });
    }
    
    console.log(`Netlify function proxy: Loading ${category} products${cacheBust ? ' with cache bust' : ''}...`);
    
    // Detect if this is a cache-busting request from admin panel
    const isCacheBust = !!cacheBust;
    
    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/auric-a0c92.firebasestorage.app/o/productData%2F${category}-products.json?alt=media&token=c6a2eb63-56e3-4fc0-96ac-66773cf45f96`;
    
    // Use fetch to get the file from Firebase Storage
    const fetchOptions = isCacheBust ? {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'X-Cache-Bust': `${Date.now()}`  // Force cache invalidation
      }
    } : {};
    
    const response = await fetch(storageUrl, fetchOptions);

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No ${category} products file found in Firebase Storage`);
        return res.status(200).json({
          success: true,
          products: [],
          message: `No ${category} products found - add some through the admin panel`
        });
      }
      throw new Error(`Failed to fetch from Firebase Storage: ${response.status}`);
    }

    const products = await response.json();

    // Get cache headers from Firebase Storage response to pass through
    const cacheControl = response.headers.get('cache-control') || response.headers.get('Cache-Control');
    const etag = response.headers.get('etag') || response.headers.get('ETag');

    console.log(`Cache-Control: ${cacheControl}, ETag: ${etag}`);
    console.log(`Successfully loaded ${products.length} ${category} products from Firebase Storage CDN`);

    // Set proper CDN cache headers for Netlify CDN caching
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, If-None-Match, Cache-Control',
      'Content-Type': 'application/json'
    };

    // For cache-busting requests, prevent all caching
    if (isCacheBust) {
      responseHeaders['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      responseHeaders['Pragma'] = 'no-cache';
      responseHeaders['Expires'] = '0';
    } else {
      // For normal requests, set long-term CDN caching with ETag validation
      responseHeaders['Cache-Control'] = 'public, max-age=31536000, must-revalidate'; // 1 year cache with must-revalidate
      responseHeaders['Netlify-CDN-Cache-Control'] = 'public, max-age=31536000, durable'; // Netlify CDN specific
      
      // Pass through Firebase Storage ETag for validation
      if (etag) {
        responseHeaders['ETag'] = etag;
      }
    }

    res.set(responseHeaders);
    return res.status(200).json({
      success: true,
      products: Array.isArray(products) ? products : [],
      message: `Loaded ${products.length} ${category} products from Firebase Storage CDN`
    });

  } catch (error) {
    console.error(`Error in Netlify function proxy:`, error);

    return res.status(500).json({
      success: false,
      products: [],
      error: `Failed to load products: ${error.message}`,
      message: 'Please check Firebase configuration and try again'
    });
  }
});

/**
 * Local image proxy endpoint for development
 * Mimics the Netlify function behavior for local testing
 */
app.get('/.netlify/functions/image-proxy', async (req, res) => {
  try {
    const imagePath = req.query.path;

    if (!imagePath) {
      return res.status(400).json({ 
        error: 'Missing image path',
        usage: '/.netlify/functions/image-proxy?path=productImages/image.jpg'
      });
    }

    console.log('Image proxy request for:', imagePath);

    // Check if Firebase Admin is initialized
    if (!admin.apps.length) {
      return res.status(500).json({ 
        error: 'Firebase Storage not configured',
        details: 'Firebase Admin SDK not initialized'
      });
    }

    const bucket = admin.storage().bucket();
    const file = bucket.file(imagePath);

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.log('Image not found:', imagePath);
      return res.status(404).json({ 
        error: 'Image not found',
        path: imagePath
      });
    }

    // Download file content
    const [fileBuffer] = await file.download();
    const [metadata] = await file.getMetadata();

    // Determine content type
    const contentType = metadata.contentType || 'image/jpeg';

    // Set cache headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=2592000'); // 30 days
    res.setHeader('Content-Length', fileBuffer.length);

    if (metadata.etag) {
      res.setHeader('ETag', metadata.etag);
    }

    console.log('Serving image:', imagePath, `(${fileBuffer.length} bytes)`);
    res.send(fileBuffer);

  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({
      error: 'Failed to fetch image',
      details: error.message
    });
  }
});

/**
 * Health check endpoint
 * Used to verify server is running properly
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    emailConfig: {
      service: process.env.EMAIL_SERVICE || 'Not set',
      user: process.env.EMAIL_USER ? 'Set' : 'Not set',
      pass: process.env.EMAIL_PASS ? 'Set' : 'Not set'
    },
    razorpayConfig: {
      key_id: process.env.RAZORPAY_KEY_ID ? 'Set' : 'Not set',
      key_secret: process.env.RAZORPAY_KEY_SECRET ? 'Set' : 'Not set'
    }
  });
});

/**
 * Test Firebase Storage access
 * Helps diagnose connectivity issues
 */
app.get('/api/test-firebase-access', async (req, res) => {
  try {
    // Try to access Firebase Storage directly
    const testUrl = 'https://firebasestorage.googleapis.com/v0/b/auric-a0c92.firebasestorage.app/o/bandwidthTest%2Fbandwidth-test-1-products.json?alt=media';

    const response = await fetch(testUrl);

    if (response.ok) {
      const data = await response.json();

      res.json({
        success: true,
        message: `Successfully accessed Firebase Storage - found ${data.length} products`,
        url: testUrl,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries())
      });
    } else {
      res.json({
        success: false,
        message: `Failed to access Firebase Storage - Status ${response.status}: ${response.statusText}`,
        url: testUrl,
        status: response.status
      });
    }
  } catch (error) {
    res.json({
      success: false,
      message: `Error accessing Firebase Storage: ${error.message}`,
      error: error.toString()
    });
  }
});

// Serve static files from the current directory
app.use(express.static('.', {
  // Set a standard Content-Type based on file extension
  setHeaders: (res, filePath) => {
    const extname = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.ttf': 'font/ttf',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.eot': 'application/vnd.ms-fontobject',
      '.otf': 'font/otf'
    };
    const contentType = mimeTypes[extname] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
  }
}));

// Simpler catch-all route to handle missing files
app.use((req, res) => {
  // For root path, always send index.html
  if (req.path === '/') {
    return res.sendFile(path.join(__dirname, 'index.html'));
  }

  // For API requests that don't match a route, return 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      success: false,
      message: 'API endpoint not found'
    });
  }

  // For all other requests, try the exact file or fall back to index.html
  const filePath = path.join(__dirname, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  } else {
    // For client-side routing, send index.html
    return res.sendFile(path.join(__dirname, 'index.html'));
  }
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╭───────────────────────────────────────────────╮
│                                               │
│        Auric Jewelry E-Commerce Server        │
│                                               │
╰───────────────────────────────────────────────╯

✅ Server running at http://0.0.0.0:${PORT}/
📧 Email service ready using Nodemailer (${process.env.EMAIL_SERVICE || 'Not configured'})
🔒 Using secure authentication: ${process.env.EMAIL_USER ? 'Yes' : 'No'}

Available Routes:
- Static files: Serving from current directory
- POST /api/send-order-email : Send order confirmation emails
- POST /api/create-razorpay-order : Create a new Razorpay payment order
- POST /api/verify-razorpay-payment : Verify a Razorpay payment signature
- GET  /api/load-products/:category : Load products from Firebase Cloud Storage
- GET  /api/health : Health check endpoint

Press Ctrl+C to stop the server
`);
});


// Multer configuration for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  try {
    // Use service account from environment or file
    let serviceAccount;

    if (process.env.FIREBASE_PRIVATE_KEY) {
      serviceAccount = {
        type: 'service_account',
        project_id: 'auric-a0c92',
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
        client_x509_cert_url: process.env.FIREBASE_CERT_URL
      };
    } else {
      // Fallback to service account file (you'll need to add this)
      console.log('Using default Firebase setup - environment variables not found');
      serviceAccount = require('./firebase-service-account.json');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: 'auric-a0c92.firebasestorage.app'
    });

    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
  }
}

// Bandwidth test product upload endpoint
app.post('/upload-bandwidth-test-product', upload.single('productImage'), async (req, res) => {
  try {
    const { category, productName, productPrice, productDescription } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const bucket = admin.storage().bucket();
    const productId = `TEST-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Upload image with CDN headers
    const imageFileName = `${category}_${productId}_${Date.now()}.jpg`;
    const imageFile = bucket.file(`bandwidthTest/${imageFileName}`);

    const metadata = {
      cacheControl: 'public, max-age=2592000',
      contentType: file.mimetype,
      metadata: {
        testCategory: category,
        productId: productId,
        uploadedAt: new Date().toISOString()
      }
    };

    await imageFile.save(file.buffer, { metadata });
    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/auric-a0c92.firebasestorage.app/o/bandwidthTest%2F${imageFileName}?alt=media`;

    // Create product data
    const productData = {
      id: productId,
      name: productName,
      price: parseFloat(productPrice),
      description: productDescription,
      image: imageUrl,
      category: category,
      createdAt: new Date().toISOString(),
      testNote: 'CDN bandwidth test product'
    };

    // Load existing products
    let existingProducts = [];
    try {
      const jsonFile = bucket.file(`bandwidthTest/${category}-products.json`);
      const [exists] = await jsonFile.exists();

      if (exists) {
        const [fileContents] = await jsonFile.download();
        const data = JSON.parse(fileContents.toString());
        if (Array.isArray(data)) {
          existingProducts = data;
        }
      }
    } catch (error) {
      console.log('Creating new product file for category:', category);
    }

    // Add new product
    existingProducts.push(productData);

    // Save updated products JSON with CDN headers
    const jsonData = JSON.stringify(existingProducts, null, 2);
    const jsonFile = bucket.file(`bandwidthTest/${category}-products.json`);

    const jsonMetadata = {
      contentType: 'application/json',
      cacheControl: 'public, max-age=2592000',
      metadata: {
        testCategory: category,
        productsCount: existingProducts.length.toString(),
        lastUpdated: new Date().toISOString()
      }
    };

    await jsonFile.save(jsonData, { metadata: jsonMetadata });

    res.json({
      success: true,
      message: `Product "${productName}" uploaded successfully!`,
      productId: productId,
      category: category,
      totalProducts: existingProducts.length,
      imageUrl: imageUrl
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: `Upload failed: ${error.message}`
    });
  }
});

// Load bandwidth test products endpoint
app.get('/load-bandwidth-test-products', async (req, res) => {
  try {
    const category = req.query.category || 'bandwidth-test-1';
    const bucket = admin.storage().bucket();
    const jsonFile = bucket.file(`bandwidthTest/${category}-products.json`);

    const [exists] = await jsonFile.exists();

    if (!exists) {
      return res.json({ 
        success: true, 
        products: [],
        message: `No products found for category: ${category}`,
        fromCache: false
      });
    }

    const [fileContents] = await jsonFile.download();
    const products = JSON.parse(fileContents.toString());

    res.set({
      'Cache-Control': 'public, max-age=3600',
      'X-Data-Source': 'firebase-storage'
    });

    res.json({
      success: true,
      products: Array.isArray(products) ? products : [],
      category: category,
      fromCache: false,
      loadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error loading bandwidth test products:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      products: []
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    firebase: admin.apps.length > 0 ? 'Connected' : 'Not Connected'
  });
});

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`Firebase Admin: ${admin.apps.length > 0 ? 'Connected' : 'Not Connected'}`);
});