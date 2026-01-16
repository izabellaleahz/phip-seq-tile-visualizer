import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';

interface VirusEntry {
  id: string;
  name: string;
  proteins: number;
  tiles: number;
}

interface FamilyData {
  viruses: VirusEntry[];
}

interface TreeData {
  families: Record<string, FamilyData>;
  summary: {
    total_families: number;
    total_viruses: number;
  };
}

type SortBy = 'tiles' | 'viruses' | 'name';

export default function ViralTree() {
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortBy>('tiles');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('data/viral_tree.json')
      .then(res => res.json())
      .then(data => {
        setTreeData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load tree data:', err);
        setLoading(false);
      });
  }, []);

  const toggleFamily = (family: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(family)) {
        next.delete(family);
      } else {
        next.add(family);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (treeData) {
      setExpandedFamilies(new Set(Object.keys(treeData.families)));
    }
  };

  const collapseAll = () => {
    setExpandedFamilies(new Set());
  };

  // Filter and sort families
  const sortedFamilies = useMemo(() => {
    if (!treeData) return [];

    const families = Object.entries(treeData.families)
      .map(([name, data]) => ({
        name,
        viruses: data.viruses,
        totalTiles: data.viruses.reduce((sum, v) => sum + v.tiles, 0),
        virusCount: data.viruses.length
      }))
      .filter(f => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return f.name.toLowerCase().includes(term) ||
          f.viruses.some(v => v.name.toLowerCase().includes(term));
      });

    switch (sortBy) {
      case 'tiles':
        return families.sort((a, b) => b.totalTiles - a.totalTiles);
      case 'viruses':
        return families.sort((a, b) => b.virusCount - a.virusCount);
      case 'name':
        return families.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return families;
    }
  }, [treeData, sortBy, searchTerm]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse">Loading taxonomy tree...</div>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="text-red-500">Failed to load taxonomy data</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Viral Taxonomy Tree
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {treeData.summary.total_viruses} viruses across {treeData.summary.total_families} families
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search viruses or families..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Sort */}
        <div className="flex gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 self-center">Sort by:</span>
          {(['tiles', 'viruses', 'name'] as SortBy[]).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                sortBy === s
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {s === 'tiles' ? 'Tiles' : s === 'viruses' ? 'Virus Count' : 'Name'}
            </button>
          ))}
        </div>

        {/* Expand/Collapse */}
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="space-y-2">
        {sortedFamilies.map((family) => {
          const isExpanded = expandedFamilies.has(family.name);
          const maxTiles = sortedFamilies[0]?.totalTiles || 1;
          const barWidth = (family.totalTiles / maxTiles) * 100;

          return (
            <div
              key={family.name}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Family Header */}
              <button
                onClick={() => toggleFamily(family.name)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors text-left"
              >
                {/* Expand Icon */}
                <span className="text-gray-400 w-4">
                  {isExpanded ? '▼' : '▶'}
                </span>

                {/* Family Name */}
                <span className="font-medium text-gray-900 dark:text-white flex-1">
                  {family.name}
                </span>

                {/* Stats */}
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {family.virusCount} viruses
                </span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400 w-24 text-right">
                  {family.totalTiles.toLocaleString()} tiles
                </span>

                {/* Bar */}
                <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </button>

              {/* Viruses List */}
              {isExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                  <div className="px-4 py-2 max-h-96 overflow-y-auto">
                    {family.viruses
                      .filter(v => !searchTerm || v.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .sort((a, b) => b.tiles - a.tiles)
                      .map((virus, i) => (
                        <Link
                          key={virus.id}
                          to={`/virus/${virus.id}`}
                          className="flex items-center gap-3 py-2 px-2 -mx-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          {/* Tree line indicator */}
                          <span className="text-gray-300 dark:text-gray-600 pl-4">
                            {i === family.viruses.length - 1 ? '└─' : '├─'}
                          </span>

                          {/* Virus name */}
                          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">
                            {virus.name}
                          </span>

                          {/* Proteins */}
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {virus.proteins.toLocaleString()} proteins
                          </span>

                          {/* Tiles */}
                          <span className="text-sm font-medium text-blue-600 dark:text-blue-400 w-20 text-right">
                            {virus.tiles.toLocaleString()}
                          </span>
                        </Link>
                      ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sortedFamilies.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No families match your search
        </div>
      )}
    </div>
  );
}
