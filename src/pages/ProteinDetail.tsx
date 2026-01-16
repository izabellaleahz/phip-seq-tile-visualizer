import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProtein } from '../hooks/useData';
import Loading from '../components/Loading';
import TileTrack from '../components/TileTrack';
import TileDetail from '../components/TileDetail';
import type { TilePosition } from '../types';

export default function ProteinDetail() {
  const { proteinId } = useParams<{ proteinId: string }>();
  const { protein, virusId, loading, error } = useProtein(proteinId);
  const [selectedTile, setSelectedTile] = useState<TilePosition | null>(null);
  const [filterShared, setFilterShared] = useState<'all' | 'shared' | 'unique'>('all');

  // Filter tiles
  const filteredTiles = useMemo(() => {
    if (!protein) return [];
    if (filterShared === 'all') return protein.tiles;
    return protein.tiles.filter(t =>
      filterShared === 'shared' ? t.isShared : !t.isShared
    );
  }, [protein, filterShared]);

  // Calculate coverage depth
  const coverageDepth = useMemo(() => {
    if (!protein) return [];
    const depth = new Array(protein.length).fill(0);
    for (const tile of protein.tiles) {
      for (let i = tile.start; i < tile.end && i < protein.length; i++) {
        depth[i]++;
      }
    }
    return depth;
  }, [protein]);

  const maxDepth = Math.max(...coverageDepth, 1);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Loading message="Loading protein details..." />
      </div>
    );
  }

  if (error || !protein) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg">
          {error ? `Error loading data: ${error.message}` : 'Protein not found'}
        </div>
      </div>
    );
  }

  const sharedCount = protein.tiles.filter(t => t.isShared).length;
  const uniqueCount = protein.tiles.filter(t => !t.isShared).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm">
        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">
          Viruses
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <Link to={`/virus/${virusId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
          {protein.virusName}
        </Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-600 dark:text-gray-300">{protein.nameClean}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {protein.nameClean}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 font-mono mt-1">{protein.id}</p>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{protein.virusName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {protein.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Length (aa)</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {protein.tileCount}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Tiles</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {uniqueCount}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Unique Tiles</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {sharedCount}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Shared Tiles</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {protein.coveragePct}%
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Coverage</div>
        </div>
      </div>

      {/* Tile Track */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tile Coverage
          </h2>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-emerald-500" />
              <span className="text-gray-600 dark:text-gray-400">Unique</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span className="text-gray-600 dark:text-gray-400">Shared</span>
            </div>
          </div>
        </div>
        <TileTrack
          tiles={protein.tiles}
          proteinLength={protein.length}
          onTileClick={setSelectedTile}
          height={100}
        />
      </div>

      {/* Coverage Depth */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Coverage Depth
        </h2>
        <div className="h-16 relative">
          <svg className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="depthGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.2" />
              </linearGradient>
            </defs>
            <path
              d={`M 0 ${64} ${coverageDepth
                .map((d, i) => {
                  const x = (i / protein.length) * 100;
                  const y = 64 - (d / maxDepth) * 60;
                  return `L ${x}% ${y}`;
                })
                .join(' ')} L 100% 64 Z`}
              fill="url(#depthGradient)"
            />
          </svg>
          <div className="absolute top-0 left-0 text-xs text-gray-500 dark:text-gray-400">
            Max: {maxDepth}x
          </div>
        </div>
      </div>

      {/* Tile List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Tiles ({filteredTiles.length})
          </h2>
          <div className="flex gap-1">
            {(['all', 'shared', 'unique'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterShared(f)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  filterShared === f
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f === 'all' ? 'All' : f === 'shared' ? `Shared (${sharedCount})` : `Unique (${uniqueCount})`}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700 max-h-96 overflow-y-auto">
          {filteredTiles.map(tile => (
            <button
              key={tile.id}
              onClick={() => setSelectedTile(tile)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-white font-mono truncate">
                      {tile.id}
                    </span>
                    <span
                      className={`shrink-0 px-1.5 py-0.5 rounded text-xs ${
                        tile.isShared
                          ? 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                          : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300'
                      }`}
                    >
                      {tile.isShared ? 'Shared' : 'Unique'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono truncate">
                    {tile.seq}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 text-right shrink-0">
                  <div>{tile.start} - {tile.end}</div>
                  <div>{tile.end - tile.start} aa</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Tile Detail Modal */}
      {selectedTile && (
        <TileDetail
          tile={selectedTile}
          currentProteinId={protein.id}
          onClose={() => setSelectedTile(null)}
        />
      )}
    </div>
  );
}
