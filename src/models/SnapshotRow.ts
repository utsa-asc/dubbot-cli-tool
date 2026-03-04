export interface SnapshotRow {
  collectedAt: string;       // ISO 8601 UTC
  siteUrl: string;
  siteId: string;
  score: number;             // latestStatsSnapshot.accessibility.score
  pdfCount: number;          // assets.totalEntries
  issuesCount: number;       // accessibilityCount
  pagesWithIssues: number;   // latestStatsSnapshot.accessibility.affectedPagesCount
}

export const SNAPSHOT_HEADERS = [
  'Collected At',
  'Site URL',
  'DubBot Site ID',
  'Score (%)',
  'PDF Count',
  'Issues Count',
  'Pages With Issues',
];

export function toRow(r: SnapshotRow): string[] {
  return [
    r.collectedAt,
    r.siteUrl,
    r.siteId,
    String(r.score),
    String(r.pdfCount),
    String(r.issuesCount),
    String(r.pagesWithIssues),
  ];
}
