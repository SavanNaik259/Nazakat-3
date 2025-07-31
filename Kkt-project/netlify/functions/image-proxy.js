/**
 * Netlify Function Image Proxy with CDN Caching
 * 
 * This function serves as a proxy between Firebase Storage and your users,
 * implementing proper CDN caching to reduce Firebase Storage bandwidth costs.
 * 
 * Features:
 * - Fetches images from Firebase Storage
 * - Implements long-term CDN caching with Cache-Control headers
 * - Uses Netlify's durable cache for persistence across deploys
 * - Handles binary content correctly with base64 encoding
 * - Provides proper error handling for missing images
 * 
 * Usage: /.netlify/functions/image-proxy?path=productImages/image.jpg
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseApp;
try {
  // Try to use environment variables first (production)
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };
    
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  } else {
    // Fallback to service account file (development)
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert('./firebase-service-account.json'),
      storageBucket: 'auric-a0c92.firebasestorage.app'
    });
  }
} catch (error) {
  console.error('Firebase Admin initialization error:', error);
  firebaseApp = null;
}

const bucket = firebaseApp ? admin.storage().bucket() : null;

/**
 * Netlify Function Handler
 */
exports.handler = async (event, context) => {
  // Enable CORS for all origins
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Check if Firebase is properly initialized
  if (!firebaseApp || !bucket) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Firebase Storage not properly configured',
        details: 'Please check Firebase Admin SDK environment variables'
      })
    };
  }

  // Get the image path from query parameters
  const imagePath = event.queryStringParameters?.path;
  
  if (!imagePath) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Missing image path',
        usage: '/.netlify/functions/image-proxy?path=productImages/image.jpg'
      })
    };
  }

  try {
    // Get file reference
    const file = bucket.file(imagePath);
    
    // Check if file exists
    const [exists] = await file.exists();
    if (!exists) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ 
          error: 'Image not found',
          path: imagePath
        })
      };
    }

    // Download file content
    const [fileBuffer] = await file.download();
    const [metadata] = await file.getMetadata();
    
    // Determine content type
    const contentType = metadata.contentType || 'application/octet-stream';
    
    // Generate cache key based on file metadata
    const lastModified = metadata.updated || metadata.timeCreated;
    const etag = metadata.etag || metadata.md5Hash;

    // Check if client has cached version (ETag validation)
    const clientETag = event.headers['if-none-match'];
    if (clientETag && clientETag === etag) {
      return {
        statusCode: 304,
        headers: {
          ...corsHeaders,
          'ETag': etag,
          'Cache-Control': 'public, max-age=0, must-revalidate',
          'Netlify-CDN-Cache-Control': 'public, max-age=31536000, durable, must-revalidate'
        },
        body: ''
      };
    }

    // Return image with proper caching headers
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Content-Length': fileBuffer.length.toString(),
        'ETag': etag,
        'Last-Modified': new Date(lastModified).toUTCString(),
        
        // Browser cache: Always revalidate to check for updates
        'Cache-Control': 'public, max-age=0, must-revalidate',
        
        // CDN cache: Long-term caching with durable storage
        // This is the key to bandwidth savings - CDN serves cached images
        'Netlify-CDN-Cache-Control': 'public, max-age=31536000, durable, must-revalidate',
        
        // Cache tags for selective invalidation
        'Netlify-Cache-Tag': 'images,firebase-storage',
        
        // Additional performance headers
        'Vary': 'Accept-Encoding'
      },
      body: fileBuffer.toString('base64'),
      isBase64Encoded: true
    };

  } catch (error) {
    console.error('Error fetching image from Firebase Storage:', error);
    
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        error: 'Failed to retrieve image',
        details: error.message
      })
    };
  }
};