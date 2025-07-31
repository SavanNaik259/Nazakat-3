# CORS Setup Using Command Line

Since the CORS section isn't visible in the Google Cloud Console UI, we'll use the command line method.

## Option 1: Using Google Cloud Shell (Recommended)

1. **Open Google Cloud Shell**
   - Go to: https://console.cloud.google.com/
   - Click the Cloud Shell icon (>_) in the top toolbar
   - This opens a terminal in your browser

2. **Run these commands in Cloud Shell:**
   ```bash
   # Create the CORS configuration file
   cat > cors-config.json << 'EOF'
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "Cache-Control", "ETag", "Access-Control-Allow-Origin"]
     }
   ]
   EOF
   
   # Apply CORS configuration to your bucket
   gsutil cors set cors-config.json gs://auric-a0c92.firebasestorage.app
   
   # Verify the configuration was applied
   gsutil cors get gs://auric-a0c92.firebasestorage.app
   ```

3. **Expected output after running the commands:**
   ```
   Setting CORS on gs://auric-a0c92.firebasestorage.app/...
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "Cache-Control", "ETag", "Access-Control-Allow-Origin"]
     }
   ]
   ```

## Option 2: Alternative UI Method

Try looking for CORS in a different location:

1. **Go back to the bucket list**
2. **Right-click on the bucket name** `auric-a0c92.firebasestorage.app`
3. **Look for "Edit bucket" or "Bucket configuration"**
4. **In the popup/modal, look for CORS settings**

## Option 3: Firebase Console Method

1. Go to: https://console.firebase.google.com/project/auric-a0c92/storage
2. Click on "Rules" tab
3. Make sure the rules allow public read access:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read: if true;
       }
     }
   }
   ```

## After CORS Configuration

1. **Wait 5-10 minutes** for changes to propagate globally
2. **Test using your `test-cors-setup.html` page**
3. **If successful, go back to `cdn-bandwidth-test-with-fallback.html`**
4. **Click "Test Direct CDN Access"** - should work now

## Verification

After applying CORS, this command should show your configuration:
```bash
curl -H "Origin: https://ksa12.netlify.app" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     "https://firebasestorage.googleapis.com/v0/b/auric-a0c92.firebasestorage.app/o/bandwidthTest%2Fbandwidth-test-1-products.json?alt=media"
```

The response should include CORS headers like:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, HEAD`