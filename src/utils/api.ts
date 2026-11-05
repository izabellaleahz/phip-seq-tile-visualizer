import type { Virus, Protein, SharedTilesIndex, SearchIndex, LibraryStatistics, ProteinIndex } from '../types';

// Use Modal API - no fallbacks
const API_URL = import.meta.env.VITE_API_URL;

if (!API_URL) {
  console.error('VITE_API_URL not set! Please configure .env file');
}

// Cache for loaded data
const cache: Record<string, unknown> = {};

async function apiGet<T>(endpoint: string): Promise<T> {
  const cacheKey = `api:${endpoint}`;
  if (cache[cacheKey]) {
    return cache[cacheKey] as T;
  }

  const response = await fetch(`${API_URL}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  const data = await response.json();
  cache[cacheKey] = data;
  return data as T;
}

export async function fetchViruses(): Promise<Virus[]> {
  return apiGet<Virus[]>('/api/data/viruses?limit=10000');
}

export async function fetchVirusProteins(virusId: string): Promise<Protein[]> {
  return apiGet<Protein[]>(`/api/data/viruses/${virusId}/proteins`);
}

export async function fetchProteinIndex(): Promise<Record<string, ProteinIndex>> {
  // Protein index not available via API - return empty for now
  console.warn('fetchProteinIndex called but not available via API');
  return {};
}

export async function fetchSharedTiles(): Promise<SharedTilesIndex> {
  // Shared tiles not available via API - return empty for now
  console.warn('fetchSharedTiles called but not available via API');
  return {};
}

export async function fetchSearchIndex(): Promise<SearchIndex> {
  // Search index not needed with API - return empty
  return { viruses: [], proteins: [] };
}

export async function fetchStatistics(): Promise<LibraryStatistics> {
  return apiGet<LibraryStatistics>('/api/data/statistics');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchTaxonomy(): Promise<any> {
  return apiGet<any>('/api/data/taxonomy');
}

// Helper to find a protein by ID
export async function findProteinById(proteinId: string): Promise<{ protein: Protein; virusId: string } | null> {
  try {
    const protein = await apiGet<Protein>(`/api/data/proteins/${proteinId}`);
    return { protein, virusId: protein.virusId };
  } catch {
    return null;
  }
}
