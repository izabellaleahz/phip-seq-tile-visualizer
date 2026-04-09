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
 * Get collapsed organisms for a given virus (by name).
 */
export interface CollapsedOrganism {
  collapsedOrganism: string;
  proteinCount: number;
  taxonIds: string;
}

export async function getCollapsedOrganismsForVirus(virusName: string): Promise<CollapsedOrganism[]> {
  const database = await getDb();
  try {
    const stmt = database.prepare(`
      SELECT collapsed_organism, protein_count, taxon_ids
      FROM virus_collapsed_organisms
      WHERE virus_name = ?
      ORDER BY protein_count DESC
    `);
    stmt.bind([virusName]);
    const results: CollapsedOrganism[] = [];
    while (stmt.step()) {
      const row = stmt.get();
      results.push({
        collapsedOrganism: (row[0] as string) || '',
        proteinCount: (row[1] as number) || 0,
        taxonIds: (row[2] as string) || '',
      });
    }
    stmt.free();
    return results;
  } catch {
    return [];
  }
}

/**
 * Get all unique collapsed organisms with their protein counts and taxon IDs.
 * These are organisms with NO direct virus entry — only present via collapse.
 * Returns them as lightweight objects suitable for merging into the virus list.
 */
export interface CollapsedOnlyOrganism {
  organism: string;
  proteinCount: number;
  taxonIds: string[];
  representativeVirus: string;
  representativeTileCount: number;
}

export async function getCollapsedOnlyOrganisms(): Promise<CollapsedOnlyOrganism[]> {
  const database = await getDb();
  try {
    const result = database.exec(`
      SELECT cp.member_organism,
             COUNT(DISTINCT cp.member_accession) as prot_count,
             GROUP_CONCAT(DISTINCT cp.member_taxon_id) as taxids,
             p.virus_name,
             SUM(DISTINCT p.tile_count) as tiles
      FROM collapsed_proteins cp
      JOIN proteins p ON cp.representative_accession = p.accession
      WHERE cp.member_organism != ''
        AND cp.member_organism NOT IN (SELECT DISTINCT organism FROM proteins)
      GROUP BY cp.member_organism
      ORDER BY prot_count DESC
    `);
    if (!result[0]) return [];
    return result[0].values.map(row => ({
      organism: (row[0] as string) || '',
      proteinCount: (row[1] as number) || 0,
      taxonIds: ((row[2] as string) || '').split(',').filter(Boolean),
      representativeVirus: (row[3] as string) || '',
      representativeTileCount: (row[4] as number) || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Get collapsed-only organisms with their representative virus name
 * for taxonomy tree integration.
 */
export interface CollapsedTreeEntry {
  organism: string;
  proteinCount: number;
  taxonIds: string[];
  representativeVirusName: string;
  tileCount: number;
}

export async function getCollapsedOrganismsForTree(): Promise<CollapsedTreeEntry[]> {
  const database = await getDb();
  try {
    const result = database.exec(`
      SELECT vco.collapsed_organism,
             SUM(vco.protein_count) as prot_count,
             GROUP_CONCAT(DISTINCT vco.taxon_ids) as taxids,
             vco.virus_name,
             MAX(v.tile_count) as tiles
      FROM virus_collapsed_organisms vco
      JOIN viruses v ON vco.virus_id = v.virus_id
      GROUP BY vco.collapsed_organism
      ORDER BY prot_count DESC
    `);
    if (!result[0]) return [];
    return result[0].values.map(row => ({
      organism: (row[0] as string) || '',
      proteinCount: (row[1] as number) || 0,
      taxonIds: ((row[2] as string) || '').split(',').filter(Boolean),
      representativeVirusName: (row[3] as string) || '',
      tileCount: (row[4] as number) || 0,
    }));
  } catch {
    return [];
  }
}

/**
 * Get collapsed organism counts for ALL viruses (bulk, for badges).
 */
export async function getAllCollapsedOrganismCounts(): Promise<Map<string, number>> {
  const database = await getDb();
  try {
    const result = database.exec(`
      SELECT virus_name, COUNT(DISTINCT collapsed_organism) as cnt
      FROM virus_collapsed_organisms
      GROUP BY virus_name
    `);
    const map = new Map<string, number>();
    if (result[0]) {
      for (const row of result[0].values) {
        map.set(row[0] as string, row[1] as number);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Get all proteins for a given organism name (both representatives and collapsed).
 * Returns the protein info + its representative (for collapsed ones).
 */
export interface OrganismProtein {
  accession: string;
  proteinName: string;
  length: number;
  database: string;
  taxonId: number | null;
  status: 'representative' | 'collapsed';
  representativeAccession: string;  // same as accession for reps
  representativeOrganism: string;
  representativeTileCount: number;
  virusName: string;
  virusId: number | null;
}

export async function getProteinsForOrganism(organism: string): Promise<OrganismProtein[]> {
  const database = await getDb();
  const results: OrganismProtein[] = [];

  // 1. Direct representative proteins with this organism name
  try {
    const stmt = database.prepare(`
      SELECT p.accession, p.protein_name, p.length, p.database, p.taxon_id,
             p.accession, p.organism, p.tile_count, p.virus_name, p.virus_id
      FROM proteins p
      WHERE p.organism LIKE ?
    `);
    stmt.bind([`%${organism}%`]);
    while (stmt.step()) {
      const r = stmt.get();
      results.push({
        accession: (r[0] as string) || '',
        proteinName: (r[1] as string) || '',
        length: (r[2] as number) || 0,
        database: (r[3] as string) || '',
        taxonId: r[4] as number | null,
        status: 'representative',
        representativeAccession: (r[5] as string) || '',
        representativeOrganism: (r[6] as string) || '',
        representativeTileCount: (r[7] as number) || 0,
        virusName: (r[8] as string) || '',
        virusId: r[9] as number | null,
      });
    }
    stmt.free();
  } catch { /* ignore */ }

  // 2. Collapsed proteins with this organism name
  try {
    const stmt2 = database.prepare(`
      SELECT cp.member_accession, cp.member_protein_name, cp.member_length,
             cp.member_database, cp.member_taxon_id,
             cp.representative_accession, p.organism, p.tile_count, p.virus_name, p.virus_id
      FROM collapsed_proteins cp
      JOIN proteins p ON cp.representative_accession = p.accession
      WHERE cp.member_organism LIKE ?
    `);
    stmt2.bind([`%${organism}%`]);
    while (stmt2.step()) {
      const r = stmt2.get();
      results.push({
        accession: (r[0] as string) || '',
        proteinName: (r[1] as string) || '',
        length: (r[2] as number) || 0,
        database: (r[3] as string) || '',
        taxonId: r[4] as number | null,
        status: 'collapsed',
        representativeAccession: (r[5] as string) || '',
        representativeOrganism: (r[6] as string) || '',
        representativeTileCount: (r[7] as number) || 0,
        virusName: (r[8] as string) || '',
        virusId: r[9] as number | null,
      });
    }
    stmt2.free();
  } catch { /* ignore */ }

  return results;
}

/**
 * Get the set of representative protein accessions for a given virus name.
 * These are proteins that have collapsed members.
 */
export async function getRepresentativesForVirus(virusName: string): Promise<Set<string>> {
  const database = await getDb();
  try {
    const stmt = database.prepare(`
      SELECT DISTINCT cp.representative_accession
      FROM collapsed_proteins cp
      JOIN proteins p ON cp.representative_accession = p.accession
      WHERE p.virus_name = ?
    `);
    stmt.bind([virusName]);
    const reps = new Set<string>();
    while (stmt.step()) {
      reps.add(stmt.get()[0] as string);
    }
    stmt.free();
    return reps;
  } catch {
    return new Set();
  }
}

/**
 * Get library summary stats from the search DB.
 */
export async function getLibrarySummary(): Promise<{
  totalViruses: number;
  totalProteins: number;
  totalCollapsed: number;
  totalRepresented: number;
  totalOrganisms: number;
  collapsedOrganisms: number;
}> {
  const database = await getDb();

  const viruses = (database.exec("SELECT COUNT(*) FROM viruses")[0]?.values[0]?.[0] as number) || 0;
  const proteins = (database.exec("SELECT COUNT(*) FROM proteins")[0]?.values[0]?.[0] as number) || 0;
  const collapsed = (database.exec("SELECT COUNT(*) FROM collapsed_proteins")[0]?.values[0]?.[0] as number) || 0;

  let collapsedOrganisms = 0;
  try {
    collapsedOrganisms = (database.exec(
      "SELECT COUNT(DISTINCT collapsed_organism) FROM virus_collapsed_organisms"
    )[0]?.values[0]?.[0] as number) || 0;
  } catch { /* table may not exist in old DBs */ }

  return {
    totalViruses: viruses,
    totalProteins: proteins,
    totalCollapsed: collapsed,
    totalRepresented: proteins + collapsed,
    totalOrganisms: viruses + collapsedOrganisms,
    collapsedOrganisms,
  };
}
