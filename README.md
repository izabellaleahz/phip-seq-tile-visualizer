# PhIP-seq Tile Library Visualizer

An interactive web application for exploring PhIP-seq peptide tile libraries. This visualizer allows you to browse viruses, proteins, and tiles, with special emphasis on showing tile sharing/reuse across homologous proteins.

## Features

- **Virus Browser**: Searchable, sortable list of all viruses in the library
- **Virus Detail View**: View all proteins for a virus with tile coverage tracks
- **Protein Detail View**: Detailed view of tiles covering a protein with coverage depth visualization
- **Tile Detail Modal**: View tile sequence and all proteins that share a tile
- **Global Search**: Fuzzy search across viruses and proteins
- **Statistics Dashboard**: Library-wide statistics and top viruses
- **Dark Mode**: Toggle between light and dark themes
- **URL Routing**: Shareable links to specific viruses/proteins

## Quick Start

### Prerequisites

- Node.js 18+ and npm

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`

### Production Build

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Updating Data Files

The visualizer loads data from JSON files in `public/data/`. To update with new library data:

1. Run the data transformation script from the parent directory:

```bash
cd ..
python transform_data.py
```

This reads from the `analysis_output/` directory and generates optimized JSON files.

2. Rebuild the app:

```bash
npm run build
```

## Data Structure

The app expects the following files in `public/data/`:

- `viruses.json` - List of all viruses with summary stats
- `proteins/[virusId].json` - Per-virus protein details with tile positions
- `proteins/index.json` - Protein lookup index
- `tiles/shared.json` - Index of shared tiles and their protein mappings
- `search-index.json` - Pre-built search index
- `statistics.json` - Library-wide statistics

## Deployment to GitHub Pages

### Option 1: GitHub Actions (Recommended)

1. Push your code to GitHub
2. Go to Settings > Pages
3. Under "Build and deployment", select "GitHub Actions"
4. Create `.github/workflows/deploy.yml` with the content below
5. Push the workflow file - it will auto-deploy on each push to main

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: tile-visualizer/frontend/package-lock.json

      - name: Install dependencies
        working-directory: tile-visualizer/frontend
        run: npm ci

      - name: Build
        working-directory: tile-visualizer/frontend
        run: npm run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: tile-visualizer/frontend/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### Option 2: Manual Deploy with gh-pages

```bash
# Install gh-pages globally
npm install -g gh-pages

# Build and deploy
npm run build
gh-pages -d dist
```

## Project Structure

```
frontend/
├── public/
│   └── data/           # JSON data files
├── src/
│   ├── components/     # Reusable UI components
│   ├── pages/          # Page components
│   ├── hooks/          # React hooks for data fetching
│   ├── types/          # TypeScript type definitions
│   └── utils/          # Utility functions
├── index.html
└── vite.config.ts
```

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Fuse.js (fuzzy search)

## Color Legend

| Color | Meaning |
|-------|---------|
| Green | Unique tile (only on this protein) |
| Amber | Shared tile (appears on multiple proteins) |

Click on any shared tile to see which proteins share it.
