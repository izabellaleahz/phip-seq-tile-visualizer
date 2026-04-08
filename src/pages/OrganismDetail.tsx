import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProteinsForOrganism } from '../utils/searchDb';
import type { OrganismProtein } from '../utils/searchDb';
import Loading from '../components/Loading';

export default function OrganismDetail() {
  const { organism } = useParams<{ organism: string }>();
  const decodedOrganism = organism ? decodeURIComponent(organism) : '';
  const [proteins, setProteins] = useState<OrganismProtein[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!decodedOrganism) { setLoading(false); return; }
    setLoading(true);
    getProteinsForOrganism(decodedOrganism)
      .then(setProteins)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [decodedOrganism]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Loading message={`Loading proteins for ${decodedOrganism}...`} />
      </div>
    );
  }

  const reps = proteins.filter(p => p.status === 'representative');
  const collapsed = proteins.filter(p => p.status === 'collapsed');

  // Group collapsed by representative
  const byRep = new Map<string, OrganismProtein[]>();
  for (const p of collapsed) {
    if (!byRep.has(p.representativeAccession)) byRep.set(p.representativeAccession, []);
    byRep.get(p.representativeAccession)!.push(p);
  }

  const totalProteins = proteins.length;
  const uniqueReps = new Set(collapsed.map(p => p.representativeAccession));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm">
        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">Viruses</Link>
        <span className="mx-2 text-gray-400">/</span>
        <span className="text-gray-600 dark:text-gray-300">{decodedOrganism}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{decodedOrganism}</h1>
        {totalProteins === 0 ? (
          <p className="text-red-500 mt-2">No proteins found for this organism in the library.</p>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {totalProteins} protein{totalProteins !== 1 ? 's' : ''} in the library
            {collapsed.length > 0 && reps.length === 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {' '}(all via protein collapse into {uniqueReps.size} representative{uniqueReps.size !== 1 ? 's' : ''})
              </span>
            )}
          </p>
        )}
      </div>

      {/* Direct representative proteins */}
      {reps.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Direct Proteins ({reps.length})
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {reps.map(p => (
              <Link
                key={p.accession}
                to={`/protein/${p.accession}`}
                className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{p.proteinName || 'Unknown'}</span>
                    <span className="text-xs text-gray-400 font-mono ml-2">{p.accession}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{p.length} aa</span>
                    <span className="text-blue-600 dark:text-blue-400">{p.representativeTileCount} tiles</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Collapsed proteins grouped by representative */}
      {collapsed.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {reps.length > 0 ? 'Additional ' : ''}Proteins via Collapse ({collapsed.length})
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            These proteins were &gt;99% identical to a representative and collapsed during clustering.
            The representative carries the tiles — click to see them.
          </p>
          <div className="space-y-4">
            {Array.from(byRep.entries()).map(([repAcc, members]) => {
              const rep = members[0]; // all share same representative info
              return (
                <div key={repAcc} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Representative header */}
                  <Link
                    to={`/protein/${repAcc}`}
                    className="block px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                          Representative: {repAcc}
                        </span>
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          ({rep.representativeOrganism})
                        </span>
                      </div>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {rep.representativeTileCount} tiles
                      </span>
                    </div>
                  </Link>
                  {/* Member proteins */}
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {members.map(m => (
                      <div key={m.accession} className="px-4 py-2.5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 text-xs rounded">
                            collapsed
                          </span>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {m.proteinName || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">{m.accession}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span>{m.length} aa</span>
                          {m.database && (
                            <span className={`px-1 py-0.5 rounded ${
                              m.database === 'Swiss-Prot' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' :
                              m.database === 'RefSeq' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300' :
                              'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                            }`}>
                              {m.database}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
