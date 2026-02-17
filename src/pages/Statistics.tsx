import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useStatistics, useViruses, useTaxonomy } from '../hooks/useData';
import type { FamilyStats } from '../types';
import Loading from '../components/Loading';
import HostBadge from '../components/HostBadge';

type SortMetric = 'uniqueTiles' | 'tileCount';

type FamilySortMetric = 'unique_tiles' | 'count' | 'proteins';

// Extended type for taxonomy entries with family field
interface TaxonomyEntryWithFamily {
  name: string;
  lineage: string;
  rank: string;
  family?: string;
  division?: string;
}

export default function Statistics() {
  const { statistics, loading: statsLoading, error: statsError } = useStatistics();
  const { viruses, loading: virusesLoading } = useViruses();
  const { taxonomy, loading: taxonomyLoading } = useTaxonomy();
  const [sortMetric, setSortMetric] = useState<SortMetric>('uniqueTiles');
  const [familySortMetric, setFamilySortMetric] = useState<FamilySortMetric>('unique_tiles');

  const loading = statsLoading || virusesLoading || taxonomyLoading;

  // Compute family stats from taxonomy data (handles both flat and nested formats)
  const familyStats = useMemo(() => {
    if (!taxonomy) return {};

    // Check if taxonomy has family_stats (nested format)
    if ((taxonomy as { family_stats?: Record<string, unknown> }).family_stats) {
      return (taxonomy as { family_stats: Record<string, FamilyStats> }).family_stats;
    }

    // Compute from flat taxonomy dict (taxid -> entry with family field)
    const stats: Record<string, FamilyStats> = {};
    const taxData = taxonomy as unknown as Record<string, TaxonomyEntryWithFamily>;

    for (const entry of Object.values(taxData)) {
      if (entry && typeof entry === 'object' && 'family' in entry) {
        const family = entry.family || 'Unknown';
        if (!stats[family]) {
          stats[family] = { count: 0, proteins: 0, tiles: 0, unique_tiles: 0 };
        }
        stats[family].count++;
      }
    }
    return stats;
  }, [taxonomy]);

  // Sort families by selected metric
  const sortedFamilies = useMemo(() => {
    if (!familyStats || Object.keys(familyStats).length === 0) return [];
    return Object.entries(familyStats)
      .sort((a, b) => (b[1][familySortMetric] || 0) - (a[1][familySortMetric] || 0));
  }, [familyStats, familySortMetric]);

  // Count total taxon IDs (handles both flat and nested formats)
  const totalTaxonIds = useMemo(() => {
    if (!taxonomy) return 0;
    // Nested format with taxonomy_data
    if ((taxonomy as { taxonomy_data?: Record<string, unknown> }).taxonomy_data) {
      return Object.keys((taxonomy as { taxonomy_data: Record<string, unknown> }).taxonomy_data).length;
    }
    // Flat format: taxonomy itself is the taxid -> data mapping
    return Object.keys(taxonomy).length;
  }, [taxonomy]);

  // Compute per-species aggregates
  const speciesData = useMemo(() => {
    if (!viruses.length) return null;
    const species = (['human', 'bat', 'bird'] as const).map(host => {
      const hostViruses = viruses.filter(v => (v.hostSpecies || ['human']).includes(host));
      const virusCount = hostViruses.length;
      const proteinCount = hostViruses.reduce((sum, v) => sum + v.proteinCount, 0);
      const uniqueTiles = hostViruses.reduce((sum, v) => sum + (v.uniqueTiles || 0), 0);
      const totalTileMappings = hostViruses.reduce((sum, v) => sum + v.tileCount, 0);
      const topViruses = [...hostViruses]
        .sort((a, b) => (b.uniqueTiles || 0) - (a.uniqueTiles || 0))
        .slice(0, 5);
      return { host, virusCount, proteinCount, uniqueTiles, totalTileMappings, topViruses };
    });
    return species;
  }, [viruses]);

  const allSpeciesTotals = useMemo(() => {
    if (!viruses.length) return { virusCount: 0, uniqueTiles: 0, totalTileMappings: 0, proteinCount: 0 };
    return {
      virusCount: viruses.length,
      uniqueTiles: viruses.reduce((sum, v) => sum + (v.uniqueTiles || 0), 0),
      totalTileMappings: viruses.reduce((sum, v) => sum + v.tileCount, 0),
      proteinCount: viruses.reduce((sum, v) => sum + v.proteinCount, 0),
    };
  }, [viruses]);

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

  const { library_summary, tile_statistics, sharing_details, coverage, protein_statistics, generation_info } = statistics;

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
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
            {viruses.length.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Virus Entries</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-3xl font-bold text-teal-600 dark:text-teal-400">
            {totalTaxonIds.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Taxon IDs</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
            {sortedFamilies.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Virus Families</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            {library_summary.total_tile_protein_mappings.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tile Mappings</div>
        </div>
      </div>

      {/* Species Tiles */}
      {speciesData && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Species Tile Breakdown
          </h2>

          {/* All Species summary bar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {allSpeciesTotals.virusCount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Total Viruses</div>
              </div>
              <div>
                <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  {allSpeciesTotals.uniqueTiles.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Unique Tiles</div>
              </div>
              <div>
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {allSpeciesTotals.totalTileMappings.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Tile Mappings</div>
              </div>
              <div>
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {allSpeciesTotals.proteinCount.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Proteins</div>
              </div>
            </div>
          </div>

          {/* Species cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {speciesData.map(species => {
              const colorMap = {
                human: {
                  border: 'border-blue-200 dark:border-blue-800',
                  accent: 'text-blue-600 dark:text-blue-400',
                  bg: 'bg-blue-50 dark:bg-blue-900/20',
                  bar: 'bg-blue-500',
                  link: 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300',
                },
                bat: {
                  border: 'border-purple-200 dark:border-purple-800',
                  accent: 'text-purple-600 dark:text-purple-400',
                  bg: 'bg-purple-50 dark:bg-purple-900/20',
                  bar: 'bg-purple-500',
                  link: 'text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300',
                },
                bird: {
                  border: 'border-green-200 dark:border-green-800',
                  accent: 'text-green-600 dark:text-green-400',
                  bg: 'bg-green-50 dark:bg-green-900/20',
                  bar: 'bg-green-500',
                  link: 'text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300',
                },
              };
              const colors = colorMap[species.host];
              const tilePct = allSpeciesTotals.uniqueTiles > 0
                ? (species.uniqueTiles / allSpeciesTotals.uniqueTiles) * 100
                : 0;

              return (
                <div
                  key={species.host}
                  className={`bg-white dark:bg-gray-800 rounded-xl border-2 ${colors.border} overflow-hidden`}
                >
                  {/* Header */}
                  <div className={`${colors.bg} px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center gap-2">
                      <HostBadge host={species.host} />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {species.host.charAt(0).toUpperCase() + species.host.slice(1)}
                      </span>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${colors.bg} ${colors.accent}`}>
                      {species.virusCount.toLocaleString()} viruses
                    </span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Stats */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Unique Tiles</span>
                        <span className={`font-bold ${colors.accent}`}>
                          {species.uniqueTiles.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Tile Mappings</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {species.totalTileMappings.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Proteins</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {species.proteinCount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Percentage bar */}
                    <div>
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Library share</span>
                        <span>{tilePct.toFixed(1)}% of unique tiles</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${colors.bar}`}
                          style={{ width: `${tilePct}%` }}
                        />
                      </div>
                    </div>

                    {/* Top 5 viruses */}
                    <div>
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                        Top viruses by unique tiles
                      </div>
                      <div className="space-y-1.5">
                        {species.topViruses.map((virus, i) => (
                          <Link
                            key={virus.id}
                            to={`/virus/${virus.id}`}
                            className="flex items-center gap-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-1 px-1 py-0.5 rounded transition-colors"
                          >
                            <span className="text-gray-400 dark:text-gray-500 w-4 text-right">
                              {i + 1}.
                            </span>
                            <span className="text-gray-900 dark:text-white truncate flex-1">
                              {virus.name}
                            </span>
                            <span className={`font-medium ${colors.accent} tabular-nums`}>
                              {(virus.uniqueTiles || 0).toLocaleString()}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer link */}
                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-2.5">
                    <Link
                      to={`/?host=${species.host}`}
                      className={`text-xs font-medium ${colors.link} flex items-center gap-1`}
                    >
                      Browse all {species.host} viruses
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footnote */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
            Some viruses infect multiple host species. Per-species totals may overlap and will not sum to the library total.
          </p>
        </div>
      )}

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

      {/* Family Distribution */}
      {sortedFamilies.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Virus Family Distribution
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setFamilySortMetric('unique_tiles')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  familySortMetric === 'unique_tiles'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Unique Tiles
              </button>
              <button
                onClick={() => setFamilySortMetric('count')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  familySortMetric === 'count'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Virus Count
              </button>
              <button
                onClick={() => setFamilySortMetric('proteins')}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  familySortMetric === 'proteins'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Proteins
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Taxonomy from NCBI. Each virus entry may contain multiple taxon IDs (strains/isolates).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-2 pr-4 font-medium text-gray-500 dark:text-gray-400">Family</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Viruses</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Proteins</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-500 dark:text-gray-400">Unique Tiles</th>
                  <th className="py-2 pl-4 font-medium text-gray-500 dark:text-gray-400 w-32">Distribution</th>
                </tr>
              </thead>
              <tbody>
                {sortedFamilies.map(([family, stats]) => {
                  const maxTiles = sortedFamilies[0][1].unique_tiles || 1;
                  const pct = ((stats.unique_tiles || 0) / maxTiles) * 100;
                  const isUnknown = family === 'Unknown';

                  return (
                    <tr
                      key={family}
                      className={`border-b border-gray-100 dark:border-gray-800 ${isUnknown ? 'opacity-60' : ''}`}
                    >
                      <td className="py-2 pr-4">
                        <span className={`font-medium ${isUnknown ? 'text-gray-500 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                          {family}
                        </span>
                      </td>
                      <td className="text-right py-2 px-4 text-gray-600 dark:text-gray-400">
                        {stats.count.toLocaleString()}
                      </td>
                      <td className="text-right py-2 px-4 text-gray-600 dark:text-gray-400">
                        {stats.proteins.toLocaleString()}
                      </td>
                      <td className="text-right py-2 px-4 font-medium text-blue-600 dark:text-blue-400">
                        {(stats.unique_tiles || 0).toLocaleString()}
                      </td>
                      <td className="py-2 pl-4">
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isUnknown ? 'bg-gray-400' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Note:</strong> "Unknown" includes viruses where NCBI taxonomy lookup didn't return a family classification.
            </p>
          </div>
        </div>
      )}

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
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {virus.name}
                    </span>
                    {(virus.hostSpecies || ['human']).map(host => (
                      <HostBadge key={host} host={host} />
                    ))}
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

      {/* Library Generation Info */}
      {generation_info && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Library Generation Parameters
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Tiling Parameters</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tile Length</span>
                  <span className="font-medium text-gray-900 dark:text-white">{generation_info.tile_length} aa</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Tile Overlap</span>
                  <span className="font-medium text-gray-900 dark:text-white">{generation_info.tile_overlap} aa</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Similarity Threshold</span>
                  <span className="font-medium text-gray-900 dark:text-white">{(generation_info.similarity_threshold * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Max Cluster Size</span>
                  <span className="font-medium text-gray-900 dark:text-white">{generation_info.max_cluster_size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">No-Gaps Mode</span>
                  <span className={`font-medium ${generation_info.no_gaps_mode ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                    {generation_info.no_gaps_mode ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Data Sources</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Source Database</span>
                  <span className="font-medium text-gray-900 dark:text-white text-right">{generation_info.source_database}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Host Filter</span>
                  <span className="font-medium text-gray-900 dark:text-white text-right">{generation_info.host_filter}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Min Protein Length</span>
                  <span className="font-medium text-gray-900 dark:text-white">{generation_info.min_protein_length} aa</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Protein Clustering</span>
                  <span className="font-medium text-gray-900 dark:text-white text-right">{generation_info.clustering}</span>
                </div>
              </div>
            </div>
          </div>
          {generation_info.notes && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                <strong>Note:</strong> {generation_info.notes}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
