# Modal Backend Integration Guide

## Overview

Your PhIP-seq Visualizer now has a Modal serverless backend that eliminates the need for the 256MB search.db download!

## What Changed

### Backend (New)
- **Modal API**: Deployed at `https://izabellaleahz-15749--phipseq-visualizer-simple-serve.us-east.modal.run`
- **Data Source**: Reads from JSON files embedded in the container image
- **No Database**: Simple file-based approach, no PostgreSQL needed
- **Fast Search**: Server-side search via `/api/search/`

### Frontend (Updated)
- **Smart Fallback**: Automatically uses Modal API when `VITE_API_URL` is set in `.env`
- **Backward Compatible**: Still works with static files if API URL is not set
- **No Search.db**: When using API, the 256MB search.db is no longer needed
- **Same UI**: No visible changes to user experience

## API Endpoints

All endpoints are available at the Modal URL:

```bash
# Health check
GET /health

# Get all viruses
GET /api/data/viruses?limit=10000

# Get proteins for a virus
GET /api/data/viruses/{virusId}/proteins

# Get a single protein
GET /api/data/proteins/{proteinId}

# Get library statistics
GET /api/data/statistics

# Search
GET /api/search/?q={query}&limit=20
```

## Environment Setup

The `.env` file has been created with:

```env
VITE_API_URL=https://izabellaleahz-15749--phipseq-visualizer-simple-serve.us-east.modal.run
```

## Testing Locally

1. **Install dependencies** (if needed):
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Test the app**:
   - Open http://localhost:5173
   - Search should work immediately (no 256MB download!)
   - Browse viruses and proteins
   - All data loaded from Modal API

4. **Verify API usage**:
   - Open browser DevTools → Network tab
   - Search for something (e.g., "SARS")
   - You should see requests to `izabellaleahz-15749--phipseq-visualizer-simple-serve.us-east.modal.run`

## Benefits

✅ **No more 256MB download** - Search works instantly
✅ **Faster initial load** - Data fetched on-demand from API
✅ **Serverless** - Modal handles scaling automatically
✅ **Free tier** - Modal's free tier is generous
✅ **Backward compatible** - Remove `.env` to use static files

## Deploying to GitHub Pages

When you deploy to GitHub Pages, the frontend will automatically use the Modal API:

```bash
npm run build
npm run deploy  # or: npx gh-pages -d dist
```

The `.env` file with `VITE_API_URL` will be baked into the build, so the deployed site will use the Modal backend.

## Updating the Backend

If you need to update the backend (e.g., after changing data files):

1. **Navigate to backend directory**:
   ```bash
   cd modal-backend
   ```

2. **Deploy updated version**:
   ```bash
   modal deploy app_simple.py
   ```

The Modal API will automatically reload with the new container image.

## File Structure

### Backend Files
```
modal-backend/
├── app_simple.py              # Main Modal app
├── api/
│   ├── data_simple.py         # Data endpoints
│   └── search_simple.py       # Search endpoints
├── services/
│   └── json_data.py           # JSON data service
└── requirements.txt
```

### Frontend Files (Updated)
```
src/
├── utils/
│   ├── api.ts                 # Updated to use Modal API
│   └── searchDb.ts            # Updated to use Modal API search
├── components/
│   └── Search.tsx             # Updated for instant search
└── .env                       # Modal API URL
```

## Troubleshooting

### Search returns no results
- Check that the Modal API is running: `curl https://izabellaleahz-15749--phipseq-visualizer-simple-serve.us-east.modal.run/health`
- Verify `.env` has the correct `VITE_API_URL`

### Data not loading
- Open browser console for errors
- Check Network tab to see if API requests are failing
- Verify the Modal deployment is active

### Want to use static files instead
- Remove or rename the `.env` file
- The app will fall back to static JSON files and search.db

## Next Steps

You can now:
1. Test the app locally with `npm run dev`
2. Deploy to GitHub Pages with `npm run deploy`
3. Enjoy instant search and faster performance!

---

**Modal Backend URL**: https://izabellaleahz-15749--phipseq-visualizer-simple-serve.us-east.modal.run

**Deployment Status**: ✅ Active and deployed
