/**
 * SQLite-based search using sql.js (WebAssembly SQLite).
 *
 * Replaces Fuse.js with FTS5 full-text search over viruses, proteins,
 * collapsed proteins, and virushostdb entries.
 */
import initSqlJs, { type Database } from 'sql.js';

export interface SearchResult {
  type: 'virus' | 'protein' | 'collapsed' | 'virushostdb';
  id: string;           // accession or virus_id
  name: string;         // organism or virus name
  proteinName?: string;
  taxonId?: string;
  refId?: string;       // representative accession (for collapsed) or virus_id
  virusName?: string;   // for protein/collapsed results
}

export interface CollapsedProtein {
  memberAccession: string;
  representativeAccession: string;
  clusterId: number;
  identityPct: number;
  memberLength: number;
  memberOrganism: string;
  memberProteinName: string;
  memberTaxonId: number | null;
  memberDatabase: string;
}

let db: Database | null = null;
let dbPromise: Promise<Database> | null = null;

const BASE_URL = import.meta.env.BASE_URL;

/**
 * Initialize the SQLite database (loaded once, cached).
 */
export async function getDb(): Promise<Database> {
  if (db) return db;
  if (dbPromise) return dbPromise;

  dbPromise = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => `${BASE_URL}sql-wasm.wasm`,
    });

    const response = await fetch(`${BASE_URL}data/search.db`);
    if (!response.ok) {
      throw new Error(`Failed to fetch search.db: ${response.statusText}`);
    }
    const buf = await response.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buf));
    return db;
  })();

  return dbPromise;
}

/**
 * Search using FTS5. Returns results across viruses, proteins,
 * collapsed proteins, and virushostdb entries.
 */
export async function search(query: string, limit = 20): Promise<SearchResult[]> {
  const database = await getDb();

  // Sanitize query for FTS5: remove special characters, add prefix matching
  const sanitized = query.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  if (!sanitized) return [];

  // FTS5 query: add * for prefix matching on each term
  const ftsQuery = sanitized
    .split(/\s+/)
    .filter(t => t.length > 0)
    .map(t => `"${t}"*`)
    .join(' ');

  if (!ftsQuery) return [];

  try {
    const stmt = database.prepare(`
      SELECT entry_type, name, accession, protein_name, taxon_id, ref_id,
             rank
      FROM search_fts
      WHERE search_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    stmt.bind([ftsQuery, limit]);

    const results: SearchResult[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      const entryType = (row[0] as string) || '';
      const name = (row[1] as string) || '';
      const accession = (row[2] as string) || '';
      const proteinName = (row[3] as string) || '';
      const taxonId = (row[4] as string) || '';
      const refId = (row[5] as string) || '';

      let type: SearchResult['type'] = 'virus';
      if (entryType === 'protein') type = 'protein';
      else if (entryType === 'collapsed') type = 'collapsed';
      else if (entryType === 'virushostdb') type = 'virushostdb';

      results.push({
        type,
        id: accession || refId || taxonId,
        name,
        proteinName: proteinName || undefined,
        taxonId: taxonId || undefined,
        refId: refId || undefined,
      });
    }
    stmt.free();

    return results;
  } catch (e) {
    console.error('Search error:', e);
    return [];
  }
}

/**
 * Get collapsed proteins for a given representative accession.
 */
export async function getCollapsedProteins(representativeAccession: string): Promise<CollapsedProtein[]> {
  const database = await getDb();

  const stmt = database.prepare(`
    SELECT member_accession, representative_accession, cluster_id,
           identity_pct, member_length, member_organism,
           member_protein_name, member_taxon_id, member_database
    FROM collapsed_proteins
    WHERE representative_accession = ?
    ORDER BY member_organism, member_accession
  `);

  stmt.bind([representativeAccession]);

  const results: CollapsedProtein[] = [];
  while (stmt.step()) {
    const row = stmt.get();
    results.push({
      memberAccession: (row[0] as string) || '',
      representativeAccession: (row[1] as string) || '',
      clusterId: (row[2] as number) || 0,
      identityPct: (row[3] as number) || 0,
      memberLength: (row[4] as number) || 0,
      memberOrganism: (row[5] as string) || '',
      memberProteinName: (row[6] as string) || '',
      memberTaxonId: row[7] as number | null,
      memberDatabase: (row[8] as string) || '',
    });
  }
  stmt.free();

  return results;
}

/**
 * Get library summary stats from the search DB.
 */
export async function getLibrarySummary(): Promise<{
  totalViruses: number;
  totalProteins: number;
  totalCollapsed: number;
  totalRepresented: number;
}> {
  const database = await getDb();

  const viruses = (database.exec("SELECT COUNT(*) FROM viruses")[0]?.values[0]?.[0] as number) || 0;
  const proteins = (database.exec("SELECT COUNT(*) FROM proteins")[0]?.values[0]?.[0] as number) || 0;
  const collapsed = (database.exec("SELECT COUNT(*) FROM collapsed_proteins")[0]?.values[0]?.[0] as number) || 0;

  return {
    totalViruses: viruses,
    totalProteins: proteins,
    totalCollapsed: collapsed,
    totalRepresented: proteins + collapsed,
  };
}
