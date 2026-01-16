import { useState, useEffect } from 'react';
import type { Virus, Protein, SharedTilesIndex, SearchIndex, LibraryStatistics, ProteinIndex } from '../types';
import * as api from '../utils/api';

export function useViruses() {
  const [viruses, setViruses] = useState<Virus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.fetchViruses()
      .then(setViruses)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { viruses, loading, error };
}

export function useVirusProteins(virusId: string | undefined) {
  const [proteins, setProteins] = useState<Protein[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!virusId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    api.fetchVirusProteins(virusId)
      .then(setProteins)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [virusId]);

  return { proteins, loading, error };
}

export function useProteinIndex() {
  const [index, setIndex] = useState<Record<string, ProteinIndex>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.fetchProteinIndex()
      .then(setIndex)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { index, loading, error };
}

export function useSharedTiles() {
  const [tiles, setTiles] = useState<SharedTilesIndex>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.fetchSharedTiles()
      .then(setTiles)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { tiles, loading, error };
}

export function useSearchIndex() {
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.fetchSearchIndex()
      .then(setSearchIndex)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { searchIndex, loading, error };
}

export function useStatistics() {
  const [statistics, setStatistics] = useState<LibraryStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    api.fetchStatistics()
      .then(setStatistics)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { statistics, loading, error };
}

export function useProtein(proteinId: string | undefined) {
  const [protein, setProtein] = useState<Protein | null>(null);
  const [virusId, setVirusId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!proteinId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    api.findProteinById(proteinId)
      .then(result => {
        if (result) {
          setProtein(result.protein);
          setVirusId(result.virusId);
        }
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [proteinId]);

  return { protein, virusId, loading, error };
}
