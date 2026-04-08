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

function parseRow(row: (string | number | null | Uint8Array)[]): SearchResult {
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

  return {
    type,
    id: accession || refId || taxonId,
    name,
    proteinName: proteinName || undefined,
    taxonId: taxonId || undefined,
    refId: refId || undefined,
  };
}

/**
 * FTS5 prefix-match search (fast, exact token prefix).
 */
function ftsSearch(database: Database, terms: string[], limit: number): SearchResult[] {
  // Try AND first: all terms must match
  const andQuery = terms.map(t => `"${t}"*`).join(' ');
  const stmt = database.prepare(`
    SELECT entry_type, name, accession, protein_name, taxon_id, ref_id, rank
    FROM search_fts WHERE search_fts MATCH ? ORDER BY rank LIMIT ?
  `);
  stmt.bind([andQuery, limit]);

  const results: SearchResult[] = [];
  while (stmt.step()) results.push(parseRow(stmt.get()));
  stmt.free();

  // If AND gave no results and we have multiple terms, try OR
  if (results.length === 0 && terms.length > 1) {
    const orQuery = terms.map(t => `"${t}"*`).join(' OR ');
    const stmt2 = database.prepare(`
      SELECT entry_type, name, accession, protein_name, taxon_id, ref_id, rank
      FROM search_fts WHERE search_fts MATCH ? ORDER BY rank LIMIT ?
    `);
    stmt2.bind([orQuery, limit]);
    while (stmt2.step()) results.push(parseRow(stmt2.get()));
    stmt2.free();
  }

  return results;
}

/**
 * LIKE-based substring search. Matches each term independently so
 * "enterovirus 109" finds "Enterovirus C109" (both substrings present).
 */
function likeSearch(database: Database, query: string, limit: number): SearchResult[] {
  const terms = query.split(/\s+/).filter(t => t.length >= 2);
  if (terms.length === 0) return [];

  // Build WHERE: name must contain ALL terms (as substrings)
  const conditions = terms.map(() => '(name LIKE ? OR accession LIKE ? OR protein_name LIKE ?)').join(' AND ');
  const params: (string | number)[] = [];
  for (const t of terms) {
    const p = `%${t}%`;
    params.push(p, p, p);
  }
  params.push(limit);

  const sql = `
    SELECT entry_type, name, accession, protein_name, taxon_id, ref_id
    FROM search_fts
    WHERE ${conditions}
    LIMIT ?
  `;
  const stmt = database.prepare(sql);
  stmt.bind(params);

  const results: SearchResult[] = [];
  while (stmt.step()) results.push(parseRow(stmt.get()));
  stmt.free();

  return results;
}

/**
 * Search using FTS5 with LIKE fallback. Returns results across viruses,
 * proteins, collapsed proteins, and virushostdb entries.
 */
export async function search(query: string, limit = 20): Promise<SearchResult[]> {
  const database = await getDb();

  // Sanitize query: keep alphanumeric, spaces, hyphens
  const sanitized = query.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  if (!sanitized) return [];

  const terms = sanitized.split(/\s+/).filter(t => t.length > 0);
  if (terms.length === 0) return [];

  try {
    // Run both FTS and LIKE in parallel, merge results
    // FTS is fast for exact prefix matches; LIKE catches substrings like "109" in "C109"
    const ftsResults = ftsSearch(database, terms, limit);
    const likeResults = likeSearch(database, sanitized, limit);

    // Merge: LIKE results first (more relevant for substring matches),
    // then FTS results, deduped
    const seen = new Set<string>();
    const merged: SearchResult[] = [];

    // LIKE results tend to be more precise for multi-term queries
    for (const r of likeResults) {
      const key = `${r.type}-${r.id}`;
      if (!seen.has(key)) { seen.add(key); merged.push(r); }
    }
    // Then FTS results
    for (const r of ftsResults) {
      const key = `${r.type}-${r.id}`;
      if (!seen.has(key)) { seen.add(key); merged.push(r); }
    }

    return merged.slice(0, limit);
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
