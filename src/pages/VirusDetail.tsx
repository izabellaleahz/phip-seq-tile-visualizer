import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVirusProteins, useViruses } from '../hooks/useData';
import Loading from '../components/Loading';
import TileTrack from '../components/TileTrack';

type SortKey = 'name' | 'tileCount' | 'length' | 'sharedTiles';
type SortOrder = 'asc' | 'desc';

export default function VirusDetail() {
  const { virusId } = useParams<{ virusId: string }>();
  const { viruses, loading: virusesLoading } = useViruses();
  const { proteins, loading, error } = useVirusProteins(virusId);

  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('tileCount');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showTrack, setShowTrack] = useState(true);

  const virus = useMemo(
    () => viruses.find(v => v.id === virusId),
    [viruses, virusId]
  );

  // Filter and sort proteins
  const filteredProteins = useMemo(() => {
    let result = proteins;

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
  }, [proteins, filter, sortKey, sortOrder]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder(key === 'name' ? 'asc' : 'desc');
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    if (!proteins.length) return null;
    const totalTiles = proteins.reduce((sum, p) => sum + p.tileCount, 0);
    const totalShared = proteins.reduce((sum, p) => sum + p.sharedTiles, 0);
    const avgLength = proteins.reduce((sum, p) => sum + p.length, 0) / proteins.length;
    return { totalTiles, totalShared, avgLength };
  }, [proteins]);

  if (loading || virusesLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Loading message="Loading virus details..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg">
          Error loading data: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm">
        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">
          Viruses
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-600 dark:text-gray-300">{virus?.name || virusId}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {virus?.name || virusId}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-mono mt-1">{virusId}</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {proteins.length.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Proteins</div>
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
                      {protein.sharedTiles > 0 && (
                        <span className="shrink-0 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs rounded">
                          {protein.sharedTiles} shared
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
                        tiles={protein.tiles}
                        proteinLength={protein.length}
                        height={40}
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
