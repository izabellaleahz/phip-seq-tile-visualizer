import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useViruses } from '../hooks/useData';
import Loading from '../components/Loading';
import HostBadge from '../components/HostBadge';
import { getLibrarySummary, getAllCollapsedOrganismCounts, getCollapsedOnlyOrganisms } from '../utils/searchDb';
import type { Virus } from '../types';

type SortKey = 'name' | 'proteinCount' | 'tileCount' | 'uniqueTiles';
type SortOrder = 'asc' | 'desc';
type HostFilter = 'all' | 'human' | 'bat' | 'bird' | 'control';

const validHosts: HostFilter[] = ['all', 'human', 'bat', 'bird', 'control'];

export default function VirusBrowser() {
  const { viruses, loading, error } = useViruses();
  const [searchParams] = useSearchParams();
  const hostParam = searchParams.get('host') as HostFilter | null;
  const initialHost = hostParam && validHosts.includes(hostParam) ? hostParam : 'all';
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('uniqueTiles');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [hostFilter, setHostFilter] = useState<HostFilter>(initialHost);
  const [libSummary, setLibSummary] = useState<{ totalOrganisms: number; collapsedOrganisms: number } | null>(null);
  const [collapsedCounts, setCollapsedCounts] = useState<Map<string, number>>(new Map());
  const [collapsedViruses, setCollapsedViruses] = useState<Virus[]>([]);
  useEffect(() => {
    getLibrarySummary().then(s => setLibSummary({ totalOrganisms: s.totalOrganisms, collapsedOrganisms: s.collapsedOrganisms })).catch(console.error);
    getAllCollapsedOrganismCounts().then(setCollapsedCounts).catch(console.error);
    getCollapsedOnlyOrganisms().then(orgs => {
      setCollapsedViruses(orgs.map(o => ({
        id: `collapsed:${o.organism}`,
        name: o.organism,
        proteinCount: o.proteinCount,
        tileCount: o.representativeTileCount,
        uniqueTiles: 0,
        taxonIds: o.taxonIds,
        hostSpecies: ['human'],
      })));
    }).catch(console.error);
  }, []);

  // Compute per-host counts
  const hostCounts = useMemo(() => {
    const counts = { all: viruses.length, human: 0, bat: 0, bird: 0, control: 0 };
    for (const v of viruses) {
      const hosts = v.hostSpecies || ['human'];
      if (hosts.includes('human')) counts.human++;
      if (hosts.includes('bat')) counts.bat++;
      if (hosts.includes('bird')) counts.bird++;
      if (hosts.includes('control')) counts.control++;
    }
    return counts;
  }, [viruses]);

  // Merge direct + collapsed-only viruses
  const allViruses = useMemo(() => {
    return [...viruses, ...collapsedViruses];
  }, [viruses, collapsedViruses]);

  // Filter and sort viruses
  const filteredViruses = useMemo(() => {
    let result = allViruses;

    // Host filter
    if (hostFilter !== 'all') {
      result = result.filter(v => {
        const hosts = v.hostSpecies || ['human'];
        return hosts.includes(hostFilter);
      });
    }

    // Text filter
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      result = result.filter(
        v =>
          v.name.toLowerCase().includes(lowerFilter) ||
          v.id.toLowerCase().includes(lowerFilter)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === 'uniqueTiles') {
        cmp = (a.uniqueTiles || 0) - (b.uniqueTiles || 0);
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [allViruses, filter, sortKey, sortOrder, hostFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder(key === 'name' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return null;
    return (
      <svg
        className={`w-4 h-4 ml-1 inline transition-transform ${sortOrder === 'desc' ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Loading message="Loading virus library..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg">
          Error loading data: {error.message}
        </div>
      </div>
    );
  }

  const hostFilterOptions: { key: HostFilter; label: string; color: string; activeColor: string }[] = [
    { key: 'all', label: 'All', color: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300', activeColor: 'bg-gray-800 dark:bg-white text-white dark:text-gray-900' },
    { key: 'human', label: 'Human', color: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400', activeColor: 'bg-blue-600 dark:bg-blue-500 text-white' },
    { key: 'bat', label: 'Bat', color: 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400', activeColor: 'bg-purple-600 dark:bg-purple-500 text-white' },
    { key: 'bird', label: 'Bird', color: 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400', activeColor: 'bg-green-600 dark:bg-green-500 text-white' },
    { key: 'control', label: 'Controls', color: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400', activeColor: 'bg-amber-600 dark:bg-amber-500 text-white' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Virus Library</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {viruses.length.toLocaleString()} viruses in the PhIP-seq tile library
          {libSummary && libSummary.collapsedOrganisms > 0 && (
            <span className="text-amber-600 dark:text-amber-400 ml-1">
              (covers {libSummary.totalOrganisms.toLocaleString()} total organisms incl. {libSummary.collapsedOrganisms} via collapse)
            </span>
          )}
        </p>
      </div>

      {/* Host species filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {hostFilterOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setHostFilter(opt.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              hostFilter === opt.key ? opt.activeColor : opt.color + ' hover:opacity-80'
            }`}
          >
            {opt.label}
            <span className="ml-1.5 opacity-75">
              {hostCounts[opt.key].toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* Filter and sort controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by name or ID..."
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 self-center">
          {filteredViruses.length.toLocaleString()} results
        </div>
      </div>

      {/* Table header */}
      <div className="bg-white dark:bg-gray-800 rounded-t-lg border border-gray-200 dark:border-gray-700 border-b-0">
        <div className="flex items-center px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-t-lg text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <button
            onClick={() => handleSort('name')}
            className="flex-1 text-left hover:text-gray-700 dark:hover:text-gray-200"
          >
            Virus Name
            <SortIcon column="name" />
          </button>
          <button
            onClick={() => handleSort('proteinCount')}
            className="w-20 text-right hover:text-gray-700 dark:hover:text-gray-200"
          >
            Proteins
            <SortIcon column="proteinCount" />
          </button>
          <button
            onClick={() => handleSort('uniqueTiles')}
            className="w-24 text-right hover:text-gray-700 dark:hover:text-gray-200"
            title="Distinct peptide sequences"
          >
            Unique
            <SortIcon column="uniqueTiles" />
          </button>
          <button
            onClick={() => handleSort('tileCount')}
            className="w-24 text-right hover:text-gray-700 dark:hover:text-gray-200"
            title="Total tile-protein mappings"
          >
            Mappings
            <SortIcon column="tileCount" />
          </button>
          <div className="w-8" />
        </div>
      </div>

      {/* Virus list */}
      <div className="bg-white dark:bg-gray-800 rounded-b-lg border border-gray-200 dark:border-gray-700 border-t-0 overflow-hidden max-h-[600px] overflow-y-auto">
        {filteredViruses.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            No viruses match your filter
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredViruses.map(virus => {
              const inflation = virus.uniqueTiles ? (virus.tileCount / virus.uniqueTiles) : 1;
              const isCollapsed = virus.id.startsWith('collapsed:');
              return (
                <Link
                  key={virus.id}
                  to={isCollapsed ? `/organism/${encodeURIComponent(virus.name)}` : `/virus/${virus.id}`}
                  className="flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {virus.name}
                      </span>
                      {isCollapsed && (
                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs rounded shrink-0">
                          via collapse
                        </span>
                      )}
                      {!isCollapsed && (collapsedCounts.get(virus.name) ?? 0) > 0 && (
                        <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs rounded shrink-0">
                          +{collapsedCounts.get(virus.name)} org
                        </span>
                      )}
                      {(virus.hostSpecies || ['human']).map(host => (
                        <HostBadge key={host} host={host} />
                      ))}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {isCollapsed ? virus.taxonIds.join(', ') : virus.id}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right w-16">
                      <div className="text-gray-900 dark:text-white font-medium">
                        {virus.proteinCount.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right w-20">
                      <div className="text-blue-600 dark:text-blue-400 font-medium">
                        {(virus.uniqueTiles || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right w-20">
                      <div className="text-gray-600 dark:text-gray-400">
                        {virus.tileCount.toLocaleString()}
                      </div>
                      {inflation > 5 && (
                        <div className={`text-xs ${inflation > 10 ? 'text-red-500' : 'text-amber-500'}`}>
                          {inflation.toFixed(0)}x
                        </div>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
