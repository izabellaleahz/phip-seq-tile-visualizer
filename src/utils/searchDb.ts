/**
 * Search implementation using Modal API only.
 */

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

export interface CollapsedOrganism {
  collapsedOrganism: string;
  proteinCount: number;
  taxonIds: string;
}

export interface CollapsedOnlyOrganism {
  organism: string;
  proteinCount: number;
  taxonIds: string[];
  representativeVirus: string;
  representativeTileCount: number;
}

export interface CollapsedTreeEntry {
  organism: string;
  proteinCount: number;
  taxonIds: string[];
  representativeVirusName: string;
  tileCount: number;
}

export interface OrganismProtein {
  accession: string;
  proteinName: string;
  length: number;
  database: string;
  taxonId: number | null;
  status: 'representative' | 'collapsed';
  representativeAccession: string;
  representativeOrganism: string;
  representativeTileCount: number;
  virusName: string;
  virusId: number | null;
}

const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.error('VITE_API_URL not set! Search will not work.');
}

/**
 * Dummy getDb for backward compatibility (not used with API)
 */
export async function getDb(): Promise<any> {
  console.warn('getDb() called but using API - this should not be needed');
  return {};
}

/**
 * Search using Modal API
 */
export async function search(query: string, limit = 20): Promise<SearchResult[]> {
  if (!API_URL) {
    console.error('Cannot search: VITE_API_URL not configured');
    return [];
  }

  try {
    const response = await fetch(`${API_URL}/api/search/?q=${encodeURIComponent(query)}&limit=${limit}`);
    if (!response.ok) {
      throw new Error(`API search failed: ${response.statusText}`);
    }

    const results = await response.json();

    // Transform API results to match our SearchResult interface
    return results.map((r: any) => ({
      type: r.type || 'virus',
      id: r.id,
      name: r.name,
      proteinName: r.proteinName,
      taxonId: r.taxonId,
      refId: r.refId,
      virusName: r.virusName,
    }));
  } catch (e) {
    console.error('API search error:', e);
    return [];
  }
}

// All database-dependent functions return empty results for now
// TODO: Implement these via API endpoints

export async function getCollapsedProteins(_representativeAccession: string): Promise<CollapsedProtein[]> {
  return [];
}

export async function getCollapsedOrganismsForVirus(_virusName: string): Promise<CollapsedOrganism[]> {
  return [];
}

export async function getCollapsedOnlyOrganisms(): Promise<CollapsedOnlyOrganism[]> {
  return [];
}

export async function getCollapsedOrganismsForTree(): Promise<CollapsedTreeEntry[]> {
  return [];
}

export async function getAllCollapsedOrganismCounts(): Promise<Map<string, number>> {
  return new Map();
}

export async function getProteinsForOrganism(_organism: string): Promise<OrganismProtein[]> {
  return [];
}

export async function getRepresentativesForVirus(_virusName: string): Promise<Set<string>> {
  return new Set();
}

export async function getLibrarySummary(): Promise<{
  totalViruses: number;
  totalProteins: number;
  totalCollapsed: number;
  totalRepresented: number;
  totalOrganisms: number;
  collapsedOrganisms: number;
}> {
  return {
    totalViruses: 0,
    totalProteins: 0,
    totalCollapsed: 0,
    totalRepresented: 0,
    totalOrganisms: 0,
    collapsedOrganisms: 0,
  };
}
