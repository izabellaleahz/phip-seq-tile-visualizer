import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { search as sqlSearch, getDb } from '../utils/searchDb';
import type { SearchResult } from '../utils/searchDb';

export default function Search() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload DB on mount
  useEffect(() => {
    getDb()
      .then(() => setLoading(false))
      .catch((err) => {
        console.error('Failed to load search DB:', err);
        setLoading(false);
      });
  }, []);

  // Search when query changes (debounced)
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const hits = await sqlSearch(q, 15);
      setResults(hits);
      setSelectedIndex(0);
    } catch (e) {
      console.error('Search failed:', e);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);

    if (query.length < 2) {
      setResults([]);
      return;
    }

    searchRef.current = setTimeout(() => doSearch(query), 150);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [query, doSearch]);

  // Click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
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
      navigate(`/virus/${result.refId || result.id}`);
    } else if (result.type === 'collapsed') {
      // Navigate to organism page to show the collapsed protein and its representative
      navigate(`/organism/${encodeURIComponent(result.name)}`);
    } else if (result.type === 'protein') {
      navigate(`/protein/${result.id}`);
    } else if (result.type === 'virushostdb') {
      // Navigate to organism page to show coverage status
      navigate(`/organism/${encodeURIComponent(result.name)}`);
    }
  };

  const typeColors: Record<string, { bg: string; text: string; label: string }> = {
    virus: {
      bg: 'bg-purple-100 dark:bg-purple-900',
      text: 'text-purple-700 dark:text-purple-300',
      label: 'Virus',
    },
    protein: {
      bg: 'bg-green-100 dark:bg-green-900',
      text: 'text-green-700 dark:text-green-300',
      label: 'Protein',
    },
    collapsed: {
      bg: 'bg-purple-100 dark:bg-purple-900',
      text: 'text-purple-700 dark:text-purple-300',
      label: 'Virus',
    },
    virushostdb: {
      bg: 'bg-purple-100 dark:bg-purple-900',
      text: 'text-purple-700 dark:text-purple-300',
      label: 'Virus',
    },
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? 'Loading search...' : 'Search viruses, proteins, taxon IDs...'}
          disabled={loading}
          className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border border-transparent rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors disabled:opacity-50"
        />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-50 max-h-96 overflow-y-auto">
          {results.map((result, index) => {
            const colors = typeColors[result.type] || typeColors.virus;
            return (
              <button
                key={`${result.type}-${result.id}-${index}`}
                onClick={() => selectResult(result)}
                className={`w-full px-4 py-2.5 text-left flex items-start gap-3 transition-colors ${
                  index === selectedIndex
                    ? 'bg-blue-50 dark:bg-blue-900/30'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}>
                  {colors.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {result.name}
                  </div>
                  {result.proteinName && (
                    <div className="text-xs text-gray-600 dark:text-gray-300 truncate">
                      {result.proteinName}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    {result.id && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
                        {result.id}
                      </span>
                    )}
                    {result.taxonId && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        taxid:{result.taxonId}
                      </span>
                    )}
                  </div>
                  {result.type === 'collapsed' && result.refId && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      via {result.refId}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* No results */}
      {isOpen && query.length >= 2 && results.length === 0 && !loading && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-center text-sm text-gray-500 dark:text-gray-400">
          No results found for &ldquo;{query}&rdquo;
        </div>
      )}
    </div>
  );
}
