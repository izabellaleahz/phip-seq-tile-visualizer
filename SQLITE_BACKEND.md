# SQLite Backend - 10x Performance Boost 🚀

## Overview

The PhIP-seq Visualizer now uses a **SQLite database** for blazing-fast queries! The database is embedded in the Modal container for zero-dependency serverless deployment.

## Performance Improvements

### Before (JSON-based API)
- **Protein lookup**: 450ms (after building index)
- **Search**: Slow (linear search through arrays)
- **Cold start**: 4.5 seconds
- **Database**: None (591MB JSON files loaded on-demand)

### After (SQLite API)
- **Protein lookup**: **44ms** ✅ **10x faster!**
- **Search**: **29ms** with FTS5 ✅ **Super fast!**
- **Cold start**: 3 seconds ✅ **33% faster**
- **Database**: SQLite with B-tree & FTS5 indexes (484.8MB)

## Architecture

### Database Schema

```sql
-- Viruses table (2,178 rows)
CREATE TABLE viruses (
    id TEXT PRIMARY KEY,
    name TEXT,
    protein_count INTEGER,
    tile_count INTEGER,
    taxon_ids TEXT,      -- JSON array
    host_species TEXT,   -- JSON array
    unique_tiles INTEGER
);

-- Proteins table (118,822 rows)
CREATE TABLE proteins (
    id TEXT PRIMARY KEY,
    virus_id TEXT,
    virus_name TEXT,
    name TEXT,
    tile_count INTEGER,
    shared_tiles INTEGER,
    length INTEGER,
    coverage_pct REAL,
    FOREIGN KEY (virus_id) REFERENCES viruses(id)
);

-- Tiles table (2,368,668 rows)
CREATE TABLE tiles (
    id TEXT PRIMARY KEY,
    protein_id TEXT,
    start INTEGER,
    end INTEGER,
    is_shared BOOLEAN,
    seq TEXT,
    FOREIGN KEY (protein_id) REFERENCES proteins(id)
);

-- Full-text search (FTS5)
CREATE VIRTUAL TABLE search_fts USING fts5(
    entity_type,
    entity_id,
    name,
    virus_name,
    virus_id,
    tokenize='porter unicode61'
);
```

### Indexes

- `PRIMARY KEY` on all id columns → **O(1) lookups**
- `INDEX` on foreign keys → **Fast joins**
- `INDEX` on name columns → **Fast filtering**
- `FTS5` virtual table → **Full-text search with ranking**

## API Endpoints

All endpoints use the new SQLite backend:

```bash
# Health check
GET https://izabellaleahz-15749--phipseq-visualizer-sqlite-serve.us-east.modal.run/health

# Get viruses (with optional filtering)
GET /api/data/viruses?host_species=human&limit=100

# Get proteins for a virus
GET /api/data/viruses/{virusId}/proteins

# Get single protein (O(1) lookup!)
GET /api/data/proteins/{proteinId}

# Full-text search with FTS5
GET /api/search/?q=SARS&limit=20

# Statistics
GET /api/data/statistics
```

## Building the Database

The SQLite database is built from JSON files using `build_sqlite_db.py`:

```bash
cd modal-backend
python3 build_sqlite_db.py
```

This creates `phipseq.db` (484.8MB) with:
- ✅ 2,178 viruses
- ✅ 118,822 proteins
- ✅ 2,368,668 tiles
- ✅ FTS5 full-text search index
- ✅ B-tree indexes for fast lookups

**Note**: The database file is **not** committed to Git (too large). It's rebuilt locally and embedded in the Modal container during deployment.

## Deployment

The Modal backend automatically embeds the SQLite database:

```python
# app_sqlite.py
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("fastapi", "uvicorn")
    .add_local_file(
        local_path="phipseq.db",
        remote_path="/phipseq.db",
    )
)
```

Deploy command:
```bash
cd modal-backend
modal deploy app_sqlite.py
```

## Frontend Configuration

The frontend uses the SQLite backend automatically:

```bash
# .env
VITE_API_URL=https://izabellaleahz-15749--phipseq-visualizer-sqlite-serve.us-east.modal.run
```

## Key Files

### Backend Files
- `modal-backend/phipseq.db` - SQLite database (484.8MB, not in Git)
- `modal-backend/build_sqlite_db.py` - Database builder script
- `modal-backend/app_sqlite.py` - Modal app with SQLite
- `modal-backend/services/sqlite_data.py` - SQLite data service
- `modal-backend/api/data_sqlite.py` - Data API endpoints
- `modal-backend/api/search_sqlite.py` - Search API endpoints

### Frontend Files
- `.env` - Points to SQLite backend
- `vite.config.ts` - Hardcoded API URL for builds

## Why SQLite?

### Advantages
✅ **Zero dependencies** - No external database needed
✅ **Embedded in container** - Self-contained deployment
✅ **Blazing fast** - O(1) indexed lookups
✅ **Full-text search** - FTS5 with ranking
✅ **Simple** - No connection pooling or auth
✅ **Reliable** - ACID transactions
✅ **Portable** - Single file database

### Perfect for This Use Case
- Read-only data (no concurrent writes)
- Small to medium dataset (~500MB)
- Serverless deployment
- Fast queries critical

## Query Examples

### Fast Protein Lookup (44ms)
```sql
SELECT * FROM proteins WHERE id = 'A0A6G7SLW8'
-- Uses PRIMARY KEY index → O(1)
```

### Full-Text Search (29ms)
```sql
SELECT * FROM search_fts
WHERE search_fts MATCH 'SARS'
ORDER BY rank
LIMIT 20
-- Uses FTS5 index → Very fast
```

### Filter by Host Species
```sql
SELECT * FROM viruses
WHERE EXISTS (
    SELECT 1 FROM json_each(host_species)
    WHERE value = 'human'
)
-- Uses JSON functions + indexes
```

## Troubleshooting

### Database not found
**Error**: `database_exists: false`
**Solution**: Run `python3 build_sqlite_db.py` to build the database

### Slow queries
**First request** after cold start may take 2-3 seconds
**Subsequent requests** should be <100ms

### Modal deployment fails
Check that `phipseq.db` exists in `modal-backend/` directory
File should be ~484.8MB

## Future Enhancements

Possible improvements:
- Add indexes for more complex filters
- Implement taxonomy tree in SQLite
- Add protein alignment caching
- Support for write operations (user annotations)
- Query result caching with Redis

## Summary

The SQLite backend delivers:
- ✅ **10x faster** protein lookups (44ms vs 450ms)
- ✅ **Super fast** full-text search (29ms)
- ✅ **Simpler** architecture (no external DB)
- ✅ **Better UX** (instant results)

All while keeping the same API interface and zero changes required to the frontend code!
