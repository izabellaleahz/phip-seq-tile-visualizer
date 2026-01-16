import type { Virus, Protein, SharedTilesIndex, SearchIndex, LibraryStatistics, ProteinIndex } from '../types';

const BASE_URL = import.meta.env.BASE_URL + 'data';

// Cache for loaded data
const cache: Record<string, unknown> = {};

async function fetchJson<T>(path: string): Promise<T> {
  if (cache[path]) {
    return cache[path] as T;
  }

  const response = await fetch(`${BASE_URL}/${path}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }

  const data = await response.json();
  cache[path] = data;
  return data as T;
}

export async function fetchViruses(): Promise<Virus[]> {
  return fetchJson<Virus[]>('viruses.json');
}

export async function fetchVirusProteins(virusId: string): Promise<Protein[]> {
  return fetchJson<Protein[]>(`proteins/${virusId}.json`);
}

export async function fetchProteinIndex(): Promise<Record<string, ProteinIndex>> {
  return fetchJson<Record<string, ProteinIndex>>('proteins/index.json');
}

export async function fetchSharedTiles(): Promise<SharedTilesIndex> {
  return fetchJson<SharedTilesIndex>('tiles/shared.json');
}

export async function fetchSearchIndex(): Promise<SearchIndex> {
  return fetchJson<SearchIndex>('search-index.json');
}

export async function fetchStatistics(): Promise<LibraryStatistics> {
  return fetchJson<LibraryStatistics>('statistics.json');
}

// Helper to find a protein by ID (needs to load the virus file)
export async function findProteinById(proteinId: string): Promise<{ protein: Protein; virusId: string } | null> {
  const index = await fetchProteinIndex();
  const proteinInfo = index[proteinId];

  if (!proteinInfo) {
    return null;
  }

  const proteins = await fetchVirusProteins(proteinInfo.virusId);
  const protein = proteins.find(p => p.id === proteinId);

  if (!protein) {
    return null;
  }

  return { protein, virusId: proteinInfo.virusId };
}
