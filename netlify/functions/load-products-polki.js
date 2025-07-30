
/**
 * Netlify Function: Load Polki Products
 * 
 * Loads polki products from Firebase Storage
 * Handles GET requests to /.netlify/functions/load-products-polki
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

function initializeFirebase() {
  if (!firebaseInitialized && admin.apps.length === 0) {
    try {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID || "auric-a0c92",
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        client_id: process.env.FIREBASE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: process.env.FIREBASE_CERT_URL
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "auric-a0c92.appspot.com"
      });

      firebaseInitialized = true;
      console.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error);
      throw error;
    }
  }
}

// In-memory cache for products
let cachedProducts = null;
let cacheTimestamp = 0;
let cachedETag = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, If-None-Match',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        message: 'Method not allowed'
      })
    };
  }

  try {
    const now = Date.now();

    // Check if we should use cached data
    if (cachedProducts && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('Returning cached polki products');
      
      // Check if client has cached version
      const clientETag = event.headers['if-none-match'];
      if (clientETag && clientETag === cachedETag) {
        return {
          statusCode: 304,
          headers: {
            ...headers,
            'ETag': cachedETag,
            'Cache-Control': 'public, max-age=300'
          }
        };
      }

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'ETag': cachedETag,
          'Cache-Control': 'public, max-age=1800'
        },
        body: JSON.stringify({
          success: true,
          products: cachedProducts,
          message: `Loaded ${cachedProducts.length} products from cache`,
          cached: true
        })
      };
    }

    // Initialize Firebase if needed
    initializeFirebase();

    // Get Firebase Storage bucket
    const bucket = admin.storage().bucket();
    const file = bucket.file('products-polki.json');

    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      console.log('products-polki.json does not exist, returning empty array');
      
      // Cache empty result
      cachedProducts = [];
      cacheTimestamp = now;
      cachedETag = 'empty-' + now;

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'ETag': cachedETag,
          'Cache-Control': 'public, max-age=300'
        },
        body: JSON.stringify({
          success: true,
          products: [],
          message: 'No polki products file found in Firebase Storage',
          cached: false
        })
      };
    }

    // Get file metadata for ETag
    const [metadata] = await file.getMetadata();
    const etag = metadata.etag || metadata.md5Hash;
    
    // Check if client has cached version
    const clientETag = event.headers['if-none-match'];
    if (clientETag && clientETag === etag) {
      return {
        statusCode: 304,
        headers: {
          ...headers,
          'ETag': etag,
          'Cache-Control': 'public, max-age=300'
        }
      };
    }

    // Download and parse the file
    const [fileContents] = await file.download();
    const products = JSON.parse(fileContents.toString());
    
    // Cache the results in memory
    cachedProducts = Array.isArray(products) ? products : [];
    cacheTimestamp = now;
    cachedETag = etag;

    console.log(`Successfully loaded and cached ${products.length} polki products from Firebase Storage`);

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'ETag': etag,
        'Cache-Control': 'public, max-age=1800'
      },
      body: JSON.stringify({
        success: true,
        products: cachedProducts,
        message: `Loaded ${cachedProducts.length} products from Firebase Storage`,
        cached: false
      })
    };

  } catch (error) {
    console.error('Error loading polki products:', error);
    
    // Return cached data if available, even if stale
    if (cachedProducts) {
      console.log('Returning stale cached data due to error');
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'ETag': cachedETag || 'error-fallback',
          'Cache-Control': 'public, max-age=60'
        },
        body: JSON.stringify({
          success: true,
          products: cachedProducts,
          message: 'Loaded from stale cache due to error',
          error: error.message,
          cached: true
        })
      };
    }

    // Check if this is a Firebase configuration error
    if (error.message && error.message.includes('credential')) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          products: [],
          message: 'Firebase Admin not configured - please set up environment variables',
          error: 'Firebase Admin not configured'
        })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        products: [],
        message: 'Failed to load polki products',
        error: error.message
      })
    };
  }
};
