/** The two categories of smell SlopLint looks for. */
export type FindingKind = 'hallucinated-import' | 'hallucinated-api' | 'parse-error';

/** A single itemized problem found in a source file. */
export interface Finding {
  kind: FindingKind;
  /** Absolute path to the offending file. */
  filePath: string;
  /** 1-based line number. */
  line: number;
  /** 1-based column number. */
  column: number;
  /** The exact source text (first line only) that triggered the finding. */
  snippet: string;
  /** Human-readable explanation of why this was flagged. */
  message: string;
}

export interface ScanResult {
  filesScanned: number;
  findings: Finding[];
  /** Path to the package.json SlopLint used as the dependency manifest, if any. */
  manifestPath: string | null;
}
