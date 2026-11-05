# Supabase + Modal Setup Guide

Your Supabase project ID: `upbmuioaecgartxtvhcx`

## Step 1: Get Your Database Connection String

1. Go to https://supabase.com/dashboard/project/upbmuioaecgartxtvhcx
2. Click "Settings" in the left sidebar
3. Click "Database"
4. Scroll to "Connection string"
5. Select **"URI"** tab (not Session mode)
6. Copy the connection string - it looks like:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```

**Important**: Replace `[YOUR-PASSWORD]` with your actual database password

## Step 2: Convert to Async Format

The connection string needs to use `asyncpg` driver for SQLAlchemy async:

**Change:**
```
postgresql://postgres...
```

**To:**
```
postgresql+asyncpg://postgres...
```

**Final format:**
```
postgresql+asyncpg://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

## Step 3: Create Modal Secret

Store your database URL in Modal:

```bash
modal secret create postgres-url \
  POSTGRES_URL="postgresql+asyncpg://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
```

Make sure to:
- Use quotes around the URL
- Replace `[PROJECT-REF]` with actual value
- Replace `[YOUR-PASSWORD]` with your password
- Use `postgresql+asyncpg://` (not just `postgresql://`)

## Step 4: Initialize Database

Run the migration script to create tables and import data:

```bash
cd modal-backend

# First, test database connection
modal run app.py::init_database

# Then run migration (this will take a while - 2,800+ files)
python scripts/migrate_data.py \
  --data-dir ../public/data \
  --db-url "postgresql+asyncpg://..."
```

## Step 5: Deploy to Modal

```bash
modal deploy app.py
```

You'll get a URL like:
```
https://yourname--phipseq-visualizer-serve.modal.run
```

## Step 6: Test Your API

```bash
# Health check
curl https://yourname--phipseq-visualizer-serve.modal.run/health

# Test search (once data is migrated)
curl "https://yourname--phipseq-visualizer-serve.modal.run/api/search?q=influenza"

# Test viruses endpoint
curl https://yourname--phipseq-visualizer-serve.modal.run/api/data/viruses
```

## Troubleshooting

**Error: "no password supplied"**
- Make sure you replaced `[YOUR-PASSWORD]` with actual password
- Check that password doesn't have special characters that need URL encoding

**Error: "connection refused"**
- Verify you're using the pooler connection string (port 6543)
- Check that Supabase project is active

**Error: "asyncpg not found"**
- Make sure connection string uses `postgresql+asyncpg://`
- Check that `asyncpg` is in requirements.txt

**Slow migration**
- This is normal! 2,800 protein files takes time
- Consider running migration in batches
- Or use `modal run` for server-side migration (faster)

## Quick Commands

```bash
# Check if Modal is configured
modal token check

# List Modal secrets
modal secret list

# View Modal logs
modal app logs phipseq-visualizer

# Re-deploy after changes
modal deploy app.py
```

## Next: Frontend Integration

Once backend is deployed, update your frontend `.env.production`:

```env
VITE_API_URL=https://yourname--phipseq-visualizer-serve.modal.run
```

Then rebuild and deploy frontend to GitHub Pages!
