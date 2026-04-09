import { useState, useMemo, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProteinsForOrganism, getCollapsedProteins } from '../utils/searchDb';
import type { OrganismProtein } from '../utils/searchDb';
import { findProteinById } from '../utils/api';
import Loading from '../components/Loading';
import TileTrack from '../components/TileTrack';
import type { Protein } from '../types';

type SortKey = 'name' | 'tileCount' | 'length' | 'sharedTiles';
type SortOrder = 'asc' | 'desc';

export default function OrganismDetail() {
  const { organism } = useParams<{ organism: string }>();
  const decodedOrganism = organism ? decodeURIComponent(organism) : '';

  const [orgProteins, setOrgProteins] = useState<OrganismProtein[]>([]);
  const [fullProteins, setFullProteins] = useState<Protein[]>([]);
  const [representativeIds, setRepresentativeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('tileCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showTrack, setShowTrack] = useState(true);

  // Load organism proteins from SQLite, then load full protein data with tiles
  useEffect(() => {
    if (!decodedOrganism) { setLoading(false); return; }
    setLoading(true);

    getProteinsForOrganism(decodedOrganism)
      .then(async (proteins) => {
        setOrgProteins(proteins);

        // Collect unique representative accessions — these are the proteins with tiles
        const repAccessions = new Set<string>();
        for (const p of proteins) {
          repAccessions.add(p.representativeAccession);
        }

        // Load full protein data (with tiles) for each representative
        const loaded: Protein[] = [];
        await Promise.all(
          Array.from(repAccessions).map(async (accession) => {
            try {
              const result = await findProteinById(accession);
              if (result) loaded.push(result.protein);
            } catch { /* skip proteins we can't load */ }
          })
        );

        setFullProteins(loaded);

        // Check which of these proteins have collapsed members
        const reps = new Set<string>();
        await Promise.all(
          loaded.map(async (p) => {
            try {
              const collapsed = await getCollapsedProteins(p.id);
              if (collapsed.length > 0) reps.add(p.id);
            } catch { /* ignore */ }
          })
        );
        setRepresentativeIds(reps);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [decodedOrganism]);

  // Filter and sort
  const filteredProteins = useMemo(() => {
    let result = fullProteins;

    if (filter) {
      const lowerFilter = filter.toLowerCase();
      result = result.filter(
        p =>
          p.name.toLowerCase().includes(lowerFilter) ||
          p.nameClean.toLowerCase().includes(lowerFilter) ||
          p.id.toLowerCase().includes(lowerFilter)
      );
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = a.nameClean.localeCompare(b.nameClean);
      } else {
        cmp = a[sortKey] - b[sortKey];
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [fullProteins, filter, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder(key === 'name' ? 'asc' : 'desc');
    }
  };

  // Stats
  const stats = useMemo(() => {
    if (!fullProteins.length) return null;
    const totalTiles = fullProteins.reduce((sum, p) => sum + p.tileCount, 0);
    const totalShared = fullProteins.reduce((sum, p) => sum + p.sharedTiles, 0);
    const avgLength = fullProteins.reduce((sum, p) => sum + p.length, 0) / fullProteins.length;
    return { totalTiles, totalShared, avgLength };
  }, [fullProteins]);

  // Count collapsed proteins from the SQLite query
  const collapsedCount = orgProteins.filter(p => p.status === 'collapsed').length;
  const directCount = orgProteins.filter(p => p.status === 'representative').length;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Loading message={`Loading ${decodedOrganism}...`} />
      </div>
    );
  }

  if (orgProteins.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <nav className="mb-4 text-sm">
          <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">Viruses</Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-600 dark:text-gray-300">{decodedOrganism}</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{decodedOrganism}</h1>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No proteins found for this organism in the library.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm">
        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">Viruses</Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-600 dark:text-gray-300">{decodedOrganism}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{decodedOrganism}</h1>
        {orgProteins.length > 0 && orgProteins[0].taxonId && (
          <p className="text-gray-500 dark:text-gray-400 font-mono mt-1">taxid:{orgProteins[0].taxonId}</p>
        )}
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {fullProteins.length.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Proteins (Tiled)</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalTiles.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Tiles</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.totalShared.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Shared Tiles</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(stats.avgLength)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Length (aa)</div>
          </div>
        </div>
      )}

      {/* Collapsed info banner */}
      {collapsedCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4 mb-6">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {directCount > 0
                ? `${directCount} direct protein${directCount !== 1 ? 's' : ''} + ${collapsedCount} via protein collapse (≥99% identity)`
                : `${collapsedCount} protein${collapsedCount !== 1 ? 's' : ''} represented via collapse into nearby viral representatives`}
            </h3>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="mb-4 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter proteins by name or ID..."
            className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={showTrack}
            onChange={e => setShowTrack(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
          />
          Show tile tracks
        </label>
        <div className="text-sm text-gray-500 dark:text-gray-400 self-center">
          {filteredProteins.length.toLocaleString()} proteins
        </div>
      </div>

      {/* Sort buttons */}
      <div className="mb-2 flex gap-2 text-xs">
        <span className="text-gray-500 dark:text-gray-400 self-center">Sort by:</span>
        {(['name', 'tileCount', 'length', 'sharedTiles'] as SortKey[]).map(key => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className={`px-2 py-1 rounded ${
              sortKey === key
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {key === 'name' ? 'Name' : key === 'tileCount' ? 'Tiles' : key === 'sharedTiles' ? 'Shared' : 'Length'}
            {sortKey === key && (
              <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        ))}
      </div>

      {/* Protein list */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[600px] overflow-y-auto">
        {filteredProteins.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            No proteins match your filter
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {filteredProteins.map(protein => (
              <Link
                key={protein.id}
                to={`/protein/${protein.id}`}
                className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {protein.nameClean}
                      </span>
                      {protein.database && (
                        <span className={`shrink-0 px-1.5 py-0.5 text-xs rounded ${
                          protein.database === 'Swiss-Prot' ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' :
                          protein.database === 'RefSeq' ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300' :
                          'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {protein.database}
                        </span>
                      )}
                      {(protein.sharedTiles > 0 || representativeIds.has(protein.id)) && (
                        <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs rounded">
                          {representativeIds.has(protein.id) ? protein.tileCount : protein.sharedTiles} shared
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                      {protein.id}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{protein.length} aa</span>
                      <span>{protein.tileCount} tiles</span>
                      <span>{protein.coveragePct}% coverage</span>
                    </div>
                  </div>
                  {showTrack && protein.tiles.length > 0 && (
                    <div className="w-48 shrink-0">
                      <TileTrack
                        tiles={representativeIds.has(protein.id)
                          ? protein.tiles.map(t => ({ ...t, isShared: true }))
                          : protein.tiles}
                        proteinLength={protein.length}
                        height={40}
                        xRegions={protein.xRegions}
                      />
                    </div>
                  )}
                  <svg className="w-5 h-5 text-gray-400 shrink-0 self-center" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
