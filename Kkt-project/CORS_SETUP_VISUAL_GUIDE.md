# Visual Guide: Finding CORS Settings in Google Cloud

## Method 1: Google Cloud Console (Primary)

### Step-by-Step Navigation:

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Select Your Project**
   - At the top of the page, click the project dropdown
   - Find and select: `auric-a0c92`

3. **Navigate to Cloud Storage**
   - In the left sidebar menu, scroll down to find **"Storage"**
   - Click on **"Cloud Storage"** → **"Buckets"**
   - OR use the search bar at top: type "Cloud Storage" and select "Buckets"

4. **Find Your Bucket**
   - Look for bucket named: `auric-a0c92.firebasestorage.app`
   - Click on the bucket name (NOT the checkbox, click the actual name)

5. **Access Bucket Configuration**
   - You should now be inside the bucket
   - Look for tabs at the top: **Objects**, **Configuration**, **Permissions**, etc.
   - Click the **"Configuration"** tab

6. **Find CORS Section**
   - Scroll down in the Configuration tab
   - Look for section titled **"Cross-origin resource sharing (CORS)"**
   - Click **"Edit CORS configuration"** button

7. **Add CORS Rules**
   - Paste this JSON configuration:
   ```json
   [
     {
       "origin": ["*"],
       "method": ["GET", "HEAD"],
       "maxAgeSeconds": 3600,
       "responseHeader": ["Content-Type", "Cache-Control", "ETag"]
     }
   ]
   ```
   - Click **"Save"**

## Method 2: Alternative Path

If you can't find "Cloud Storage" in the sidebar:

1. **Use the Navigation Menu**
   - Click the ☰ hamburger menu (top-left)
   - Look for **"Storage"** section
   - Click **"Cloud Storage"**

2. **Use Search**
   - At the very top of Google Cloud Console
   - Use the search bar and type: "Cloud Storage Buckets"
   - Select the result

## Method 3: Direct URL

Try this direct link (replace with your project):
```
https://console.cloud.google.com/storage/browser/auric-a0c92.firebasestorage.app?project=auric-a0c92
```

## Method 4: Using Firebase Console (Alternative)

1. Go to: https://console.firebase.google.com/
2. Select project: `auric-a0c92`
3. Click **"Storage"** in left sidebar
4. You'll see a message about using Google Cloud Console for CORS
5. Click the link to go directly to Google Cloud Storage

## Method 5: Command Line (If You Have Google Cloud SDK)

```bash
# Create cors-config.json file
echo '[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD"],
    "maxAgeSeconds": 3600,
    "responseHeader": ["Content-Type", "Cache-Control", "ETag"]
  }
]' > cors-config.json

# Apply CORS configuration
gsutil cors set cors-config.json gs://auric-a0c92.firebasestorage.app
```

## Troubleshooting

**Can't find the bucket?**
- Make sure you're in the correct project (`auric-a0c92`)
- The bucket name should be: `auric-a0c92.firebasestorage.app`

**Don't see Configuration tab?**
- Make sure you clicked on the bucket NAME, not just selected it
- You need to be INSIDE the bucket, not just viewing the list

**No CORS section in Configuration?**
- Scroll down - it might be at the bottom
- Look for "Cross-origin resource sharing" or just "CORS"

**Access denied?**
- Make sure you have Storage Admin or Storage Object Admin permissions
- You might need to ask the project owner to give you access

## After Configuration

1. Wait 5-10 minutes for changes to propagate globally
2. Go back to your `cdn-bandwidth-test-with-fallback.html`
3. Click **"Test Direct CDN Access"** button
4. If successful, you should see green "Direct CDN" method instead of red "Proxy"

## Expected Result

After CORS is configured:
- ✅ "Test Direct CDN Access" should work
- ✅ Page should show "Using Direct CDN Access (Optimal)"
- ✅ Only first user per region will consume Firebase bandwidth
- ✅ Subsequent users get cached responses with no bandwidth cost