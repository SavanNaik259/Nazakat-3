# Firebase Storage CORS Configuration

## Problem
Direct browser access to Firebase Storage is failing with "Failed to fetch" error due to CORS (Cross-Origin Resource Sharing) restrictions.

## Root Cause
Firebase Storage requires CORS configuration to allow browser requests from your deployed domain.

## Solution: Configure Firebase Storage CORS

### Method 1: Using Google Cloud Console (Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: `auric-a0c92`
3. Navigate to **Cloud Storage** → **Browser**
4. Find your bucket: `auric-a0c92.firebasestorage.app`
5. Click on the bucket name
6. Go to **Configuration** tab
7. Scroll down to **CORS** section
8. Click **Edit CORS configuration**
9. Add this CORS configuration:

```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"]
  }
]
```

### Method 2: Using gsutil Command Line (Alternative)

If you have Google Cloud SDK installed:

1. Create a file called `cors-config.json`:
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin", "Cache-Control", "ETag"]
  }
]
```

2. Run this command:
```bash
gsutil cors set cors-config.json gs://auric-a0c92.firebasestorage.app
```

### Method 3: For Production (Domain-Specific)

For production, replace `"*"` with your specific domains:

```json
[
  {
    "origin": [
      "https://ksa12.netlify.app",
      "https://your-custom-domain.com",
      "http://localhost:3000",
      "http://localhost:5000"
    ],
    "method": ["GET", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin", "Cache-Control", "ETag"]
  }
]
```

## Verification

After configuring CORS, test with:

```bash
curl -H "Origin: https://ksa12.netlify.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     "https://firebasestorage.googleapis.com/v0/b/auric-a0c92.firebasestorage.app/o/bandwidthTest%2Fbandwidth-test-1-products.json?alt=media"
```

## Expected Response Headers

After CORS is configured, you should see these headers:
- `Access-Control-Allow-Origin: *` (or your domain)
- `Access-Control-Allow-Methods: GET, HEAD`
- `Access-Control-Max-Age: 3600`

## Testing

Once CORS is configured:
1. Wait 5-10 minutes for changes to propagate
2. Test `cdn-bandwidth-test-direct-final.html` again
3. Check browser Developer Tools → Network tab for CORS headers
4. Verify no more "Failed to fetch" errors

## Firebase Storage Rules

Ensure your Firebase Storage rules allow public read access (already configured):

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    match /bandwidthTest/{allPaths=**} {
      allow read: if true;
    }
    match /productData/{allPaths=**} {
      allow read: if true;
    }
    match /{allPaths=**} {
      allow read: if true;
    }
  }
}
```

## Next Steps

1. Configure CORS using Method 1 (Google Cloud Console)
2. Wait 5-10 minutes for propagation
3. Test direct access again
4. If still failing, check browser console for specific CORS error details