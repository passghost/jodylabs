# Cloudinary Setup Instructions for Jody'sList

## Your Cloudinary Details:
- **Cloud Name:** 232855656455444

## Steps to Complete Setup:

### 1. Create an Upload Preset
1. Go to your Cloudinary Dashboard: https://cloudinary.com/console
2. Navigate to **Settings** → **Upload**
3. Scroll down to **Upload presets**
4. Click **Add upload preset**
5. Configure the preset:
   - **Preset name:** `jodys_list_uploads`
   - **Signing Mode:** Unsigned (important for frontend uploads)
   - **Folder:** `jodys_list` (optional, keeps images organized)
   - **Format:** Auto (Cloudinary will optimize format)
   - **Quality:** Auto (Cloudinary will optimize quality)
   - **Max file size:** 10MB
   - **Image and video transformations:** Leave default or add:
     - **Width:** 800 (resizes large images)
     - **Quality:** auto:good (good compression)
     - **Fetch format:** auto (serves WebP to supported browsers)

6. Click **Save**

### 2. Your Integration is Ready!
Once you create the upload preset, your Jody'sList will automatically:
- ✅ Upload images to Cloudinary
- ✅ Automatically optimize images for web
- ✅ Serve images from Cloudinary's global CDN
- ✅ Support up to 10MB image files
- ✅ Convert images to modern formats (WebP) when possible

### 3. Test It Out
1. Go to your Jody'sList posting page
2. Try uploading an image
3. You should see "Uploading image..." progress
4. The image will be stored on Cloudinary and displayed in your listing

### 4. Benefits You Get:
- **Fast Loading:** Images served from global CDN
- **Automatic Optimization:** Smaller file sizes, better quality
- **Large File Support:** Up to 10MB images
- **Modern Formats:** Automatic WebP conversion
- **Reliable Storage:** Images won't disappear

## Troubleshooting:
If uploads fail, check:
1. Upload preset name is exactly: `jodys_list_uploads`
2. Signing mode is set to "Unsigned"
3. Your cloud name is correct: `232855656455444`

## Free Tier Limits:
- 25 GB storage
- 25 GB bandwidth per month
- More than enough for a community trading site!
