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
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Loading message={`Loading ${decodedOrganism}...`} />
      </div>
    );
  }

  const reps = proteins.filter(p => p.status === 'representative');
  const collapsed = proteins.filter(p => p.status === 'collapsed');
  const totalProteins = proteins.length;

  // Group collapsed by representative
  const byRep = new Map<string, OrganismProtein[]>();
  for (const p of collapsed) {
    if (!byRep.has(p.representativeAccession)) byRep.set(p.representativeAccession, []);
    byRep.get(p.representativeAccession)!.push(p);
  }

  // Compute stats
  const repAccessions = new Set<string>();
  for (const p of proteins) {
    repAccessions.add(p.representativeAccession);
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
        {proteins.length > 0 && proteins[0].taxonId && (
          <p className="text-gray-500 dark:text-gray-400 font-mono mt-1">taxid:{proteins[0].taxonId}</p>
        )}
      </div>

      {totalProteins === 0 ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">No proteins found for this organism in the library.</p>
        </div>
      ) : (
        <>
          {/* Stats cards — same style as VirusDetail */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalProteins}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Proteins</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{reps.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Direct (Tiled)</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{collapsed.length}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Via Collapse</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{repAccessions.size}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Representative{repAccessions.size !== 1 ? 's' : ''}</div>
            </div>
          </div>

          {/* Direct proteins */}
          {reps.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Proteins ({reps.length})</h2>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {reps.map(p => (
                  <Link key={p.accession} to={`/protein/${p.accession}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{p.proteinName || 'Unknown'}</span>
                      <span className="text-xs text-gray-400 font-mono ml-2">{p.accession}</span>
                      {p.database && (
                        <span className={`ml-2 px-1.5 py-0.5 rounded text-xs ${
                          p.database === 'Swiss-Prot' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                          p.database === 'RefSeq' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>{p.database}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500">{p.length} aa</span>
                      <span className="text-blue-600 dark:text-blue-400 font-medium">{p.representativeTileCount} tiles</span>
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Collapsed proteins grouped by representative */}
          {collapsed.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {reps.length > 0 ? 'Additional ' : ''}Proteins via Collapse ({collapsed.length})
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  These proteins were &ge;99% identical to a representative. Click the representative to see tiles.
                </p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {Array.from(byRep.entries()).map(([repAcc, members]) => (
                  <div key={repAcc}>
                    <Link to={`/protein/${repAcc}`}
                      className="flex items-center justify-between px-4 py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                          Representative: {repAcc}
                        </span>
                        <span className="text-xs text-blue-500 dark:text-blue-400">
                          {members[0].representativeOrganism}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                        {members[0].representativeTileCount} tiles
                      </span>
                    </Link>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {members.map(m => (
                        <div key={m.accession} className="flex items-center justify-between px-4 py-2.5 pl-10">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900 dark:text-white">{m.proteinName || 'Unknown'}</span>
                            <span className="text-xs text-gray-400 font-mono">{m.accession}</span>
                            {m.database && (
                              <span className={`px-1 py-0.5 rounded text-xs ${
                                m.database === 'Swiss-Prot' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' :
                                m.database === 'RefSeq' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300' :
                                'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                              }`}>{m.database}</span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500">{m.length} aa</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
