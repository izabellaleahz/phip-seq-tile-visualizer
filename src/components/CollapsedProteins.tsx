import { useState, useEffect } from 'react';
import { getCollapsedProteins } from '../utils/searchDb';
import type { CollapsedProtein } from '../utils/searchDb';

interface Props {
  proteinId: string;
}

export default function CollapsedProteins({ proteinId }: Props) {
  const [collapsed, setCollapsed] = useState<CollapsedProtein[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCollapsedProteins(proteinId)
      .then(setCollapsed)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [proteinId]);

  if (loading) return null;
  if (collapsed.length === 0) return null;

  // Group by organism for summary
  const byOrganism = new Map<string, CollapsedProtein[]>();
  for (const cp of collapsed) {
    const org = cp.memberOrganism || 'Unknown';
    if (!byOrganism.has(org)) byOrganism.set(org, []);
    byOrganism.get(org)!.push(cp);
  }

  const uniqueOrganisms = byOrganism.size;
  const uniqueTaxids = new Set(collapsed.map(c => c.memberTaxonId).filter(Boolean)).size;

  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 p-4 mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            Represents {collapsed.length} collapsed protein{collapsed.length !== 1 ? 's' : ''}
            {uniqueOrganisms > 1 && ` from ${uniqueOrganisms} organisms`}
            {uniqueTaxids > 0 && ` (${uniqueTaxids} taxon ID${uniqueTaxids !== 1 ? 's' : ''})`}
          </h3>
        </div>
        <svg
          className={`w-4 h-4 text-amber-600 dark:text-amber-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {Array.from(byOrganism.entries()).map(([organism, proteins]) => (
            <div key={organism} className="bg-white dark:bg-gray-800 rounded-md p-3">
              <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {organism}
                <span className="text-gray-400 text-xs ml-2">
                  ({proteins.length} protein{proteins.length !== 1 ? 's' : ''})
                </span>
              </div>
              <div className="space-y-1">
                {proteins.map(cp => (
                  <div key={cp.memberAccession} className="flex items-center gap-2 text-xs">
                    <span className="font-mono text-gray-600 dark:text-gray-400 w-32 shrink-0">
                      {cp.memberAccession}
                    </span>
                    <span className="text-gray-500 dark:text-gray-500 truncate">
                      {cp.memberProteinName || 'Unknown protein'}
                    </span>
                    <span className="text-amber-600 dark:text-amber-400 shrink-0">
                      {cp.identityPct.toFixed(1)}%
                    </span>
                    {cp.memberTaxonId && (
                      <span className="text-gray-400 shrink-0">
                        taxid:{cp.memberTaxonId}
                      </span>
                    )}
                    {cp.memberDatabase && (
                      <span className={`px-1 py-0.5 rounded text-xs shrink-0 ${
                        cp.memberDatabase === 'Swiss-Prot' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' :
                        cp.memberDatabase === 'RefSeq' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300' :
                        'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {cp.memberDatabase}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
