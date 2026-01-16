import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStatistics, useViruses } from '../hooks/useData';
import Loading from '../components/Loading';

type SortMetric = 'uniqueTiles' | 'tileCount';

export default function Statistics() {
  const { statistics, loading: statsLoading, error: statsError } = useStatistics();
  const { viruses, loading: virusesLoading } = useViruses();
  const [sortMetric, setSortMetric] = useState<SortMetric>('uniqueTiles');

  const loading = statsLoading || virusesLoading;

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Loading message="Loading statistics..." />
      </div>
    );
  }

  if (statsError || !statistics) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-lg">
          Error loading statistics: {statsError?.message || 'Unknown error'}
        </div>
      </div>
    );
  }

  const { library_summary, tile_statistics, sharing_details, coverage, protein_statistics } = statistics;

  // Top viruses - sortable by unique tiles or tile mappings
  const topViruses = [...viruses]
    .sort((a, b) => {
      if (sortMetric === 'uniqueTiles') {
        return (b.uniqueTiles || 0) - (a.uniqueTiles || 0);
      }
      return b.tileCount - a.tileCount;
    })
    .slice(0, 15);

  // Calculate sharing rate
  const sharingRate = (tile_statistics.shared_tiles / library_summary.total_unique_tiles) * 100;

  // Cross-virus sharing stats
  const crossVirusRate = sharing_details ?
    (sharing_details.cross_virus_tiles / sharing_details.total_shared_tiles) * 100 : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Library Statistics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Overview of the PhIP-seq peptide tile library
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {library_summary.total_unique_tiles.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Unique Tiles</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
            {library_summary.total_proteins_covered.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Proteins Covered</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">
            {library_summary.unique_viruses.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Viruses</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            {library_summary.total_tile_protein_mappings.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tile-Protein Mappings</div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Tile Statistics */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tile Sharing Statistics
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Single-Protein Tiles</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {tile_statistics.single_protein_tiles.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Shared Tiles (multi-protein)</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {tile_statistics.shared_tiles.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Sharing Rate</span>
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {sharingRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Avg Proteins per Shared Tile</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {tile_statistics.mean_proteins_per_shared_tile.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Visual representation */}
          <div className="mt-6">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Tile Distribution</div>
            <div className="h-4 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${100 - sharingRate}%` }}
                title={`${tile_statistics.single_protein_tiles.toLocaleString()} single-protein tiles`}
              />
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${sharingRate}%` }}
                title={`${tile_statistics.shared_tiles.toLocaleString()} shared tiles`}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
              <span>Single-Protein ({(100 - sharingRate).toFixed(1)}%)</span>
              <span>Shared ({sharingRate.toFixed(1)}%)</span>
            </div>
          </div>

          {/* Cross-virus sharing breakdown */}
          {sharing_details && (
            <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Cross-Virus Sharing
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Of the {sharing_details.total_shared_tiles.toLocaleString()} shared tiles:
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Same-Virus Only</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {sharing_details.same_virus_tiles.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Cross-Virus (pan-viral)</span>
                  <span className="font-medium text-purple-600 dark:text-purple-400">
                    {sharing_details.cross_virus_tiles.toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden flex">
                  <div
                    className="bg-blue-500 h-full"
                    style={{ width: `${100 - crossVirusRate}%` }}
                    title={`${sharing_details.same_virus_tiles.toLocaleString()} same-virus tiles`}
                  />
                  <div
                    className="bg-purple-500 h-full"
                    style={{ width: `${crossVirusRate}%` }}
                    title={`${sharing_details.cross_virus_tiles.toLocaleString()} cross-virus tiles`}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-500 dark:text-gray-400">
                  <span>Same-Virus ({(100 - crossVirusRate).toFixed(1)}%)</span>
                  <span>Cross-Virus ({crossVirusRate.toFixed(1)}%)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Protein Statistics */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Protein Statistics
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Mean Length</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {Math.round(protein_statistics.mean_length)} aa
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Median Length</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {protein_statistics.median_length} aa
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Length Range</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {protein_statistics.min_length} - {protein_statistics.max_length.toLocaleString()} aa
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Coverage</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Proteins with 100% Coverage</span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {coverage.proteins_with_100_pct.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Proteins with Gaps</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {coverage.proteins_with_gaps.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600 dark:text-gray-400">Mean Coverage Depth</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {coverage.mean_coverage_depth.toFixed(2)}x
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Viruses */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Top 15 Viruses by {sortMetric === 'uniqueTiles' ? 'Unique Tiles' : 'Tile Mappings'}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSortMetric('uniqueTiles')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                sortMetric === 'uniqueTiles'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Unique Tiles
            </button>
            <button
              onClick={() => setSortMetric('tileCount')}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                sortMetric === 'tileCount'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Tile Mappings
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          {sortMetric === 'uniqueTiles'
            ? 'Unique tiles = distinct peptide sequences (actual library diversity)'
            : 'Tile mappings = total tile-protein relationships (inflated by isolate redundancy)'}
        </p>
        <div className="space-y-3">
          {topViruses.map((virus, i) => {
            const primaryValue = sortMetric === 'uniqueTiles' ? (virus.uniqueTiles || 0) : virus.tileCount;
            const maxValue = sortMetric === 'uniqueTiles'
              ? (topViruses[0].uniqueTiles || 1)
              : topViruses[0].tileCount;
            const inflation = virus.uniqueTiles ? (virus.tileCount / virus.uniqueTiles) : 1;

            return (
              <Link
                key={virus.id}
                to={`/virus/${virus.id}`}
                className="flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-900 -mx-2 px-2 py-2 rounded-lg transition-colors"
              >
                <div className="w-6 text-center text-sm font-medium text-gray-400 dark:text-gray-500">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {virus.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {virus.proteinCount.toLocaleString()} proteins
                  </div>
                </div>
                <div className="text-right w-20">
                  <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                    {(virus.uniqueTiles || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">unique</div>
                </div>
                <div className="text-right w-20">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {virus.tileCount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">mappings</div>
                </div>
                <div className="text-right w-12">
                  <div className={`text-xs font-medium ${
                    inflation > 10 ? 'text-red-500' : inflation > 5 ? 'text-amber-500' : 'text-gray-400'
                  }`}>
                    {inflation.toFixed(1)}x
                  </div>
                </div>
                {/* Bar visualization */}
                <div className="w-24 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      sortMetric === 'uniqueTiles' ? 'bg-blue-500' : 'bg-gray-500'
                    }`}
                    style={{ width: `${(primaryValue / maxValue) * 100}%` }}
                  />
                </div>
              </Link>
            );
          })}
        </div>

        {/* Explanation */}
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p><strong>Unique Tiles:</strong> Distinct peptide sequences in the library</p>
            <p><strong>Tile Mappings:</strong> How many times tiles map to proteins (inflated by similar isolates)</p>
            <p><strong>Inflation:</strong> Mappings / Unique tiles. High values indicate many similar protein isolates</p>
          </div>
        </div>
      </div>
    </div>
  );
}
