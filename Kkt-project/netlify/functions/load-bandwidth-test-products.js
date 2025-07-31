
/**
 * Netlify Function: Load Bandwidth Test Products
 * 
 * Loads products from Firebase Storage for bandwidth testing using direct CDN URLs
 * Handles GET requests to /.netlify/functions/load-bandwidth-test-products?category=CATEGORY
 * 
 * This function uses direct Firebase Storage URLs with alt=media to ensure proper CDN caching,
 * avoiding the bandwidth consumption issues that occur with signed URLs.
 */

exports.handler = async (event, context) => {
  // Set CORS headers with proper cache support
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, If-None-Match, If-Modified-Since',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Expose-Headers': 'ETag, Cache-Control, Last-Modified',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
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
    // Get category from query parameters
    const category = event.queryStringParameters?.category;
    
    if (!category) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          products: [],
          error: 'Category parameter is required',
          message: 'Please provide a category parameter: ?category=bandwidth-test-1'
        })
      };
    }

    console.log(`Loading bandwidth test products for category: ${category}`);

    // Use direct Firebase Storage URL with alt=media for CDN caching
    // This bypasses signed URLs and allows Firebase Storage CDN to work properly
    const storageUrl = `https://firebasestorage.googleapis.com/v0/b/auric-a0c92.firebasestorage.app/o/bandwidthTest%2F${category}-products.json?alt=media`;

    console.log(`Fetching from Firebase Storage CDN: ${storageUrl}`);

    // Use fetch to get the file from Firebase Storage CDN
    const response = await fetch(storageUrl);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`No ${category} bandwidth test products found in Firebase Storage`);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            products: [],
            message: `No ${category} test products found - add some through the uploader`
          })
        };
      }
      throw new Error(`Failed to fetch from Firebase Storage: ${response.status}`);
    }

    const products = await response.json();
    
    // Get cache headers from Firebase Storage response to pass through
    const cacheControl = response.headers.get('cache-control') || response.headers.get('Cache-Control');
    const etag = response.headers.get('etag') || response.headers.get('ETag');
    
    console.log(`Fetched ${products.length} products from Firebase Storage CDN`);
    console.log(`Cache-Control: ${cacheControl}, ETag: ${etag}`);

    console.log(`Successfully loaded ${products.length} ${category} bandwidth test products`);

    // Pass through Firebase Storage cache headers for proper CDN behavior
    const responseHeaders = {
      ...headers
    };
    
    if (cacheControl) responseHeaders['Cache-Control'] = cacheControl;
    if (etag) responseHeaders['ETag'] = etag;

    return {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify({
        success: true,
        products: Array.isArray(products) ? products : [],
        category: category,
        testType: 'bandwidth-test',
        message: `Loaded ${products.length} test products from Firebase Storage CDN`
      })
    };

  } catch (error) {
    console.error(`Error loading ${category || 'unknown'} bandwidth test products:`, error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        products: [],
        error: `Failed to load test products: ${error.message}`,
        message: 'Please check Firebase configuration and try again'
      })
    };
  }
};
