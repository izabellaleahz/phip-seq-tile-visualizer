export default function Methods() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Methods</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Pipeline methodology for PhIP-seq virome library generation
        </p>
      </div>

      <div className="space-y-8">
        {/* Overview */}
        <Section title="Overview">
          <p>
            This library was generated using a custom bioinformatics pipeline that transforms viral
            protein sequences into synthesis-ready 195&nbsp;bp DNA oligonucleotides for Phage
            Immunoprecipitation Sequencing (PhIP-seq). The pipeline fetches viral proteomes infecting
            human, bat, and bird hosts, tiles them into overlapping 49-amino-acid peptides, and
            produces codon-optimized DNA with restriction enzyme site avoidance.
          </p>
          <Figure caption="Pipeline overview: 8 sequential steps from protein collection to synthesis-ready oligos.">
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Protein Collection (UniProt + RefSeq)</li>
              <li>Protein Filtering (length, ambiguous AA, Swiss-Prot priority)</li>
              <li>Protein Clustering (CD-HIT, 100% identity)</li>
              <li>MSA-Aligned Tiling (49 AA tiles, 25 AA overlap)</li>
              <li>Tile Deduplication (exact-match collapse)</li>
              <li>Adapter Addition (5&prime; linker + 3&prime; FLAG tag)</li>
              <li>Codon Optimization (E. coli, RE avoidance)</li>
              <li>Output Generation (FASTA + metadata)</li>
            </ol>
          </Figure>
        </Section>

        {/* 1. Protein Collection */}
        <Section title="1. Protein Collection">
          <p>
            Viral protein sequences are collected from UniProt and NCBI RefSeq using a multi-source
            fetching strategy driven by{' '}
            <a href="https://www.genome.jp/virushostdb/" className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">VirusHostDB</a>{' '}
            to maximize taxonomic coverage:
          </p>
          <ol className="list-decimal list-inside space-y-2 mt-2">
            <li>
              <strong>VirusHostDB target list</strong> &mdash; The pipeline loads VirusHostDB
              (genome.jp/virushostdb), a curated database of virus&ndash;host associations, to
              identify all viral taxa known to infect each host group. For human viruses this
              yields ~1,488 expected taxa.
            </li>
            <li>
              <strong>UniProt host-based fetch</strong> &mdash; Query{' '}
              <Code>(taxonomy_id:10239) AND (virus_host_id:&#123;taxid&#125;)</Code> for three host
              groups: human (9606), bat/Chiroptera (9397), and bird/Aves (8782). This is the
              primary source, pulling both Swiss-Prot (reviewed) and TrEMBL (unreviewed) entries.
            </li>
            <li>
              <strong>NCBI RefSeq backfill</strong> &mdash; The pipeline compares taxa returned by
              UniProt against the VirusHostDB target list. Any viral taxa present in VirusHostDB
              but absent from UniProt results are fetched from NCBI RefSeq protein via Entrez.
              For human viruses, ~858 taxa (~58%) are missing from UniProt and backfilled from
              RefSeq, adding ~5,000 additional protein sequences.
            </li>
            <li>
              <strong>UniProt name-based fetch</strong> &mdash; Query{' '}
              <Code>(taxonomy_id:10239) AND (organism_name:&quot;human&quot;)</Code> to capture
              viruses named &ldquo;Human rhinovirus&rdquo;, &ldquo;Human coronavirus&rdquo;, etc.
              that may lack explicit host annotation in UniProt.
            </li>
          </ol>
          <p className="mt-2">
            Results from all sources are merged and deduplicated by accession. The VirusHostDB
            mapping also enables host-species labeling (human, bat, bird) for downstream
            visualization and analysis.
          </p>
        </Section>

        {/* 2. Protein Filtering */}
        <Section title="2. Protein Filtering">
          <p>Proteins are filtered with the following criteria:</p>
          <Table
            rows={[
              ['Minimum length', '49 amino acids (matches tile length)'],
              ['Ambiguous residues', 'Sequences containing X, B, Z, J, U, or O are rejected'],
              [
                'Over-represented viruses',
                'HIV, HBV, and EBV are restricted to Swiss-Prot (reviewed) entries only, reducing >1.2M redundant TrEMBL clinical isolate variants to ~920 curated representatives',
              ],
              ['Other viruses', 'All entries retained (both Swiss-Prot and TrEMBL)'],
            ]}
          />
        </Section>

        {/* 3. Protein Clustering */}
        <Section title="3. Protein Clustering">
          <p>
            Filtered proteins are clustered at <strong>100% sequence identity</strong> using{' '}
            <a href="https://sites.google.com/view/cd-hit" className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">CD-HIT</a>{' '}
            to remove exact duplicate sequences while preserving all unique variants including
            single-residue polymorphisms.
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>Swiss-Prot entries are sorted first so they are preferentially selected as cluster representatives.</li>
            <li>Cluster membership is tracked &mdash; all member proteins are linked back to their representative for downstream tile sharing analysis.</li>
          </ul>
        </Section>

        {/* 4. MSA-Aligned Tiling */}
        <Section title="4. MSA-Aligned Tiling">
          <p>
            Proteins are tiled into <strong>49-amino-acid peptides</strong> with{' '}
            <strong>25 AA overlap</strong> (24 AA step size), providing approximately 2&times;
            coverage of each position. For clusters with multiple members, a multiple sequence
            alignment (MSA) strategy minimizes redundant tiles:
          </p>
          <ol className="list-decimal list-inside space-y-2 mt-2">
            <li>
              Each CD-HIT cluster (at 80% identity) is aligned with{' '}
              <a href="https://mafft.cbrc.jp/alignment/software/" className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer">MAFFT</a>.
            </li>
            <li>
              Tiles are placed on a regular grid on the reference (longest) sequence.
            </li>
            <li>
              Each tile position is projected onto all cluster members via the alignment &mdash; only
              positions where the alignment column maps to an actual residue (not a gap) are included.
            </li>
            <li>
              Gap-fill tiles are added with local grid tiling to ensure every residue is covered, even
              in regions with large insertions/deletions.
            </li>
            <li>
              Singleton proteins and clusters larger than 500 members fall back to naive grid tiling.
            </li>
          </ol>
          <p className="mt-2">
            Tiles containing any <strong>X</strong> (unknown amino acid) residue are rejected, as
            they would produce unsynthesizable NNN codons.
          </p>
        </Section>

        {/* 5. Tile Deduplication */}
        <Section title="5. Tile Deduplication">
          <p>
            Identical peptide tiles arising from different source proteins are collapsed into single
            entries. Each deduplicated tile tracks its <strong>source proteins</strong> &mdash;
            enabling the shared-tile analysis shown in this viewer. Tiles present in multiple
            proteins are flagged as &ldquo;merged.&rdquo;
          </p>
        </Section>

        {/* 6. Codon Optimization */}
        <Section title="6. Codon Optimization &amp; Oligo Assembly">
          <p>Each 49-AA peptide tile is converted to a 195&nbsp;bp synthesis-ready DNA oligo:</p>
          <Table
            rows={[
              ['5\u2032 adapter', 'TGGAGCCATCCGCAGTTCGAGAAA (24 bp linker)'],
              ['Coding region', '147 bp (49 AA \u00d7 3 bp/codon, E. coli K12 codon table)'],
              ['3\u2032 adapter', 'GACTACAAGGACGACGATGATAAG (24 bp FLAG tag)'],
              ['Total', '195 bp per oligo'],
            ]}
          />
          <p className="mt-3">
            Codon optimization uses <strong>E. coli K12</strong> codon usage frequencies from the
            Kazusa database, with probabilistic sampling weighted by natural usage. An iterative
            optimization loop (up to 100 attempts per tile) avoids:
          </p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>
              <strong>Restriction enzyme sites</strong> &mdash; HindIII (AAGCTT), EcoRI (GAATTC),
              and XhoI (CTCGAG) in both the coding region and adapter&ndash;coding junctions.
            </li>
            <li>
              <strong>Shine-Dalgarno sequences</strong> &mdash; AGGAGG motif (ribosome binding site)
              in the coding region.
            </li>
            <li>
              <strong>Extreme GC content</strong> &mdash; targets 30&ndash;70% GC in the coding
              region.
            </li>
          </ul>
          <p className="mt-2">
            The optimizer uses a weighted scoring system: RE sites are most critical
            (&times;1000), pattern hits next (&times;100), and GC deviation as a tiebreaker
            (&times;1). The best-scoring sequence across all attempts is selected.
          </p>
        </Section>

        {/* 7. Controls */}
        <Section title="7. Controls">
          <p>The final library includes two types of control oligos:</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>
              <strong>3 peptide controls</strong> &mdash; GFAP fragments 5 and 11 and MYC fragment
              17 (human protein positive controls), codon-optimized with the same pipeline.
            </li>
            <li>
              <strong>50 stop-codon phages</strong> &mdash; Oligos beginning with TAA, TAG, or TGA
              (rotated) followed by random filler DNA. These produce empty phage particles and serve
              as negative controls for background signal estimation.
            </li>
          </ul>
        </Section>

        {/* 8. Quality Control */}
        <Section title="8. Quality Control">
          <p>
            Every oligo in the final library is validated with 12 automated checks:
          </p>
          <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
            <li>Oligo size consistency (195 bp expected)</li>
            <li>5&prime; and 3&prime; adapter presence and correctness</li>
            <li>Coding DNA length = 3 &times; AA length</li>
            <li>No restriction enzyme sites (HindIII, EcoRI, XhoI) in coding region</li>
            <li>No RE sites in full oligo including adapter junctions</li>
            <li>No internal stop codons</li>
            <li>Back-translation (DNA &rarr; AA) matches original peptide sequence</li>
            <li>Only valid DNA bases (A, T, G, C &mdash; no ambiguous N bases)</li>
            <li>FASTA sequences match metadata records</li>
            <li>No duplicate oligo sequences</li>
            <li>GC content within 30&ndash;70% range</li>
            <li>No Shine-Dalgarno (AGGAGG) motifs in coding region</li>
          </ol>
        </Section>

        {/* Software */}
        <Section title="Software &amp; Data Sources">
          <Table
            rows={[
              ['Pipeline', 'phip-seq-oligo-generator (custom, Python)'],
              ['CD-HIT', 'v4.8.1 (protein clustering)'],
              ['MAFFT', 'v7.520 (multiple sequence alignment)'],
              ['UniProt', 'rest.uniprot.org (protein sequences)'],
              ['RefSeq', 'NCBI Entrez (gap-fill sequences)'],
              ['VirusHostDB', 'genome.jp/virushostdb (virus\u2013host associations)'],
              ['Codon table', 'E. coli K12 (Kazusa database)'],
              ['BioPython', 'Sequence I/O and translation'],
            ]}
          />
        </Section>
      </div>
    </div>
  );
}


// ── Reusable sub-components ───────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{title}</h2>
      <div className="text-gray-700 dark:text-gray-300 space-y-2 leading-relaxed">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-700 last:border-0">
              <td className="py-2 pr-4 font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap align-top">
                {label}
              </td>
              <td className="py-2 text-gray-800 dark:text-gray-200">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Figure({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mt-3">
      <div className="text-gray-700 dark:text-gray-300">{children}</div>
      <figcaption className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
        {caption}
      </figcaption>
    </figure>
  );
}
