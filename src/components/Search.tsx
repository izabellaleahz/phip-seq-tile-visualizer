import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';

interface SearchResult {
  type: 'virus' | 'protein';
  id: string;
  name: string;
  virusId?: string;
  virusName?: string;
}

interface VirusIndex {
  id: string;
  name: string;
}

interface ProteinSearchItem {
  id: string;
  name: string;
  virusId: string;
  virusName: string;
}

const BASE_URL = import.meta.env.BASE_URL + 'data';

export default function Search() {
  const navigate = useNavigate();
  const [virusIndex, setVirusIndex] = useState<VirusIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const deepSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load light virus index on mount
  useEffect(() => {
    fetch(`${BASE_URL}/search-viruses.json`)
      .then(res => res.json())
      .then(setVirusIndex)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Build Fuse search index for viruses
  const virusFuse = useMemo(() => {
    if (!virusIndex.length) return null;
    return new Fuse(virusIndex, {
      keys: ['name', 'id'],
      threshold: 0.3,
      includeScore: true,
    });
  }, [virusIndex]);

  // Deep search for proteins (debounced)
  const deepSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) return;

    setIsDeepSearching(true);
    try {
      const response = await fetch(`${BASE_URL}/search-index.json`);
      const fullIndex = await response.json();

      const proteinFuse = new Fuse<ProteinSearchItem>(fullIndex.proteins as ProteinSearchItem[], {
        keys: ['name', 'id', 'virusName'],
        threshold: 0.3,
        includeScore: true,
      });

      const proteinResults = proteinFuse.search(searchQuery, { limit: 8 });

      setResults(prev => {
        // Keep existing virus results, add protein results
        const virusResults = prev.filter(r => r.type === 'virus');
        const newProteinResults: SearchResult[] = proteinResults.map(r => ({
          type: 'protein' as const,
          id: r.item.id,
          name: r.item.name,
          virusId: r.item.virusId,
          virusName: r.item.virusName,
        }));
        return [...virusResults.slice(0, 4), ...newProteinResults];
      });
    } catch (error) {
      console.error('Deep search failed:', error);
    } finally {
      setIsDeepSearching(false);
    }
  }, []);

  // Search when query changes
  useEffect(() => {
    if (!virusFuse || query.length < 2) {
      setResults([]);
      return;
    }

    // Clear any pending deep search
    if (deepSearchRef.current) {
      clearTimeout(deepSearchRef.current);
    }

    // Immediate virus search
    const virusResults = virusFuse.search(query, { limit: 5 });
    const results: SearchResult[] = virusResults.map(r => ({
      type: 'virus' as const,
      id: r.item.id,
      name: r.item.name,
    }));

    setResults(results);
    setSelectedIndex(0);

    // Debounced protein search (only for 3+ chars)
    if (query.length >= 3) {
      deepSearchRef.current = setTimeout(() => {
        deepSearch(query);
      }, 300);
    }

    return () => {
      if (deepSearchRef.current) {
        clearTimeout(deepSearchRef.current);
      }
    };
  }, [query, virusFuse, deepSearch]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        selectResult(results[selectedIndex]);
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const selectResult = (result: SearchResult) => {
    setQuery('');
    setIsOpen(false);

    if (result.type === 'virus') {
      navigate(`/virus/${result.id}`);
    } else {
      navigate(`/protein/${result.id}`);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Loading...' : 'Search viruses, proteins...'}
          disabled={loading}
          className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50"
        />
        {isDeepSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-80 overflow-y-auto">
          {results.map((result, index) => (
            <button
              key={`${result.type}-${result.id}`}
              onClick={() => selectResult(result)}
              className={`w-full px-4 py-2.5 text-left flex items-start gap-3 transition-colors ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span
                className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${
                  result.type === 'virus'
                    ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                    : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                }`}
              >
                {result.type === 'virus' ? 'Virus' : 'Protein'}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {result.name}
                </div>
                {result.type === 'protein' && result.virusName && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {result.virusName}
                  </div>
                )}
                <div className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                  {result.id}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && query.length >= 2 && results.length === 0 && !loading && !isDeepSearching && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No results found for "{query}"
        </div>
      )}
    </div>
  );
}
