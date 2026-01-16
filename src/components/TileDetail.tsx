import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { TilePosition, ProteinIndex, SharedTilesIndex, SharedTile } from '../types';

const BASE_URL = import.meta.env.BASE_URL + 'data';

interface TileDetailProps {
  tile: TilePosition;
  currentProteinId: string;
  onClose: () => void;
}

// Cache for loaded data
let sharedTilesCache: SharedTilesIndex | null = null;
let proteinIndexCache: Record<string, ProteinIndex> | null = null;

interface VirusGroup {
  virusId: string;
  virusName: string;
  proteins: ProteinIndex[];
}

export default function TileDetail({ tile, currentProteinId, onClose }: TileDetailProps) {
  const [proteinList, setProteinList] = useState<ProteinIndex[]>([]);
  const [virusGroups, setVirusGroups] = useState<VirusGroup[]>([]);
  const [sharedInfo, setSharedInfo] = useState<SharedTile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tile.isShared) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Load shared tiles index if not cached
        if (!sharedTilesCache) {
          const response = await fetch(`${BASE_URL}/tiles/shared.json`);
          sharedTilesCache = await response.json();
        }

        // Load protein index if not cached
        if (!proteinIndexCache) {
          const response = await fetch(`${BASE_URL}/proteins/index.json`);
          proteinIndexCache = await response.json();
        }

        // Find proteins that share this tile by sequence
        const info = sharedTilesCache![tile.seq];
        setSharedInfo(info || null);

        if (info && proteinIndexCache) {
          const proteins = info.proteins
            .map(pid => proteinIndexCache![pid])
            .filter((p): p is ProteinIndex => !!p);

          // Group proteins by virus
          const groupMap = new Map<string, VirusGroup>();
          for (const protein of proteins) {
            const existing = groupMap.get(protein.virusId);
            if (existing) {
              existing.proteins.push(protein);
            } else {
              groupMap.set(protein.virusId, {
                virusId: protein.virusId,
                virusName: protein.virusName,
                proteins: [protein]
              });
            }
          }

          // Sort groups by protein count descending
          const groups = Array.from(groupMap.values())
            .sort((a, b) => b.proteins.length - a.proteins.length);

          setVirusGroups(groups);
          setProteinList(proteins);
        }
      } catch (err) {
        setError('Failed to load shared tile data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tile]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Tile Details
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
              {tile.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tile info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Position</div>
              <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {tile.start} - {tile.end}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Length</div>
              <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                {tile.end - tile.start} aa
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Type</div>
              <div className="mt-1">
                {!tile.isShared ? (
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                    Unique
                  </span>
                ) : loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                ) : sharedInfo?.isCrossVirus ? (
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                    Cross-Virus
                  </span>
                ) : (
                  <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                    Same-Virus
                  </span>
                )}
              </div>
            </div>
            {tile.isShared && (
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sharing</div>
                <div className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  ) : (
                    <span>{proteinList.length} proteins / {virusGroups.length} virus{virusGroups.length !== 1 ? 'es' : ''}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sequence */}
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Sequence</div>
            <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-3 font-mono text-sm text-gray-800 dark:text-gray-200 break-all">
              {tile.seq}
            </div>
          </div>

          {/* Proteins sharing this tile - grouped by virus */}
          {tile.isShared && (
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                {sharedInfo?.isCrossVirus
                  ? `Shared across ${virusGroups.length} viruses`
                  : 'Shared within same virus'}
              </div>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                  Loading shared proteins...
                </div>
              ) : error ? (
                <div className="text-sm text-red-500 dark:text-red-400">{error}</div>
              ) : virusGroups.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">No data available</div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 max-h-80 overflow-y-auto">
                  {virusGroups.map((group, groupIndex) => (
                    <div key={group.virusId}>
                      {/* Virus header */}
                      <div className={`sticky top-0 px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${
                        groupIndex > 0 ? 'border-t' : ''
                      }`}>
                        <div className="flex items-center justify-between">
                          <Link
                            to={`/virus/${group.virusId}`}
                            onClick={onClose}
                            className="text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 truncate"
                          >
                            {group.virusId}
                          </Link>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            sharedInfo?.isCrossVirus
                              ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                              : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
                          }`}>
                            {group.proteins.length} protein{group.proteins.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {group.virusName}
                        </div>
                      </div>
                      {/* Proteins in this virus */}
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {group.proteins.slice(0, 10).map(protein => (
                          <Link
                            key={protein.id}
                            to={`/protein/${protein.id}`}
                            onClick={onClose}
                            className={`block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                              protein.id === currentProteinId ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-sm text-gray-900 dark:text-white truncate">
                                  {protein.name}
                                </div>
                              </div>
                              <div className="text-xs text-gray-400 dark:text-gray-500 font-mono shrink-0">
                                {protein.length} aa
                              </div>
                            </div>
                            {protein.id === currentProteinId && (
                              <span className="text-xs text-blue-600 dark:text-blue-400">Current protein</span>
                            )}
                          </Link>
                        ))}
                        {group.proteins.length > 10 && (
                          <div className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                            + {group.proteins.length - 10} more proteins...
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
