# PhIP-seq Visualizer Modal Backend

Serverless API backend for the PhIP-seq tile library visualizer, replacing static JSON files with fast database queries.

## Architecture

- **Framework**: FastAPI (async Python web framework)
- **Database**: PostgreSQL (full-text search + structured queries)
- **Caching**: In-memory (will upgrade to Redis)
- **Deployment**: Modal serverless platform

## Project Structure

```
modal-backend/
├── app.py                 # Main Modal app + FastAPI setup
├── api/
│   ├── search.py         # Search endpoints (replaces searchDb.ts)
│   └── data.py           # Data endpoints (viruses, proteins, tiles)
├── models/
│   ├── database.py       # SQLAlchemy ORM models
│   └── schemas.py        # Pydantic validation schemas
├── services/
│   └── cache.py          # Caching service
├── scripts/
│   └── migrate_data.py   # Data migration script
└── requirements.txt
```

## Setup

### 1. Install Modal CLI

```bash
pip install modal
modal token new
```

### 2. Create PostgreSQL Database

You'll need a PostgreSQL database. Options:

**Option A: Neon (Free tier)**
```bash
# Sign up at neon.tech
# Get connection string: postgresql://user:pass@host/dbname
```

**Option B: Supabase (Free tier)**
```bash
# Sign up at supabase.com
# Get connection string from project settings
```

**Option C: Modal's managed Postgres** (if available)

### 3. Create Modal Secrets

```bash
# Store database URL
modal secret create postgres-url \
  POSTGRES_URL=postgresql://user:pass@host/dbname
```

### 4. Deploy

```bash
modal deploy app.py
```

This will deploy the API and give you a URL like:
`https://yourname--phipseq-visualizer-serve.modal.run`

## API Endpoints

### Search

- `GET /api/search?q={query}&limit=20` - Full-text search
- `GET /api/search/autocomplete?q={query}` - Autocomplete suggestions

### Data

- `GET /api/data/viruses` - List all viruses
- `GET /api/data/viruses/{virusId}/proteins` - Get virus proteins
- `GET /api/data/proteins/{proteinId}` - Get single protein
- `GET /api/data/proteins/{proteinId}/tiles` - Get protein tiles
- `GET /api/data/statistics` - Library statistics
- `GET /api/data/taxonomy` - Taxonomy tree

### Health

- `GET /` - API health check
- `GET /health` - Detailed health status

## Data Migration

To migrate your current JSON data to PostgreSQL:

```bash
cd scripts
python migrate_data.py --data-dir ../../public/data --db-url postgresql://...
```

This will:
1. Create database tables
2. Import viruses.json
3. Import all protein JSON files (2,800+)
4. Import search.db SQLite data
5. Create indexes for performance

## Development

### Run Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run FastAPI locally (without Modal)
uvicorn app:web_app --reload --port 8000
```

### Test Endpoints

```bash
# Health check
curl https://yourname--phipseq-visualizer-serve.modal.run/health

# Search
curl "https://yourname--phipseq-visualizer-serve.modal.run/api/search?q=influenza"

# Get viruses
curl https://yourname--phipseq-visualizer-serve.modal.run/api/data/viruses
```

## Frontend Integration

Update your React app's environment variables:

```bash
# .env.production
VITE_API_URL=https://yourname--phipseq-visualizer-serve.modal.run
```

Then update `src/utils/api.ts` to use this API URL instead of static files.

## Performance

**Current (static files):**
- search.db: 256MB download (5-30s on slow connections)
- Large JSON files: 100+ KB per protein

**With Modal backend:**
- Search: <100ms API call (no download)
- Data: Paginated, cached responses
- 95%+ reduction in client-side data transfer

## Cost

Modal serverless pricing:
- Free tier: Generous for development
- Production: Pay per request (typically $20-50/month for moderate traffic)

## Next Steps

1. ✅ Basic API structure created
2. 🔄 Complete database implementation (TODO: actual queries)
3. 🔄 Run data migration
4. 🔄 Deploy to Modal
5. 🔄 Integrate with frontend
6. ⏳ Add Redis caching
7. ⏳ Add monitoring/logging
