import { GraphQLClient, gql } from 'graphql-request';
import { config } from '../config.js';
import type { SnapshotRow } from '../models/SnapshotRow.js';
import { withRetry } from '../utils/retry.js';

const SITE_QUERY = gql`
  query SiteQuery($siteId: String!, $accountId: String!) {
    site(siteId: $siteId, accountId: $accountId) {
      id
      url
      accessibilityCount
      latestStatsSnapshot {
        accessibility {
          score
          affectedPagesCount
        }
      }
    }
    assets(
      siteId: $siteId
      accountId: $accountId
      assetTypes: ["pdf"]
      page: 1
      perPage: 1
      sortBy: path
      sortOrder: asc
    ) {
      totalEntries
    }
  }
`;

interface SiteQueryResponse {
  site: {
    id: string;
    url: string;
    accessibilityCount: number;
    latestStatsSnapshot: {
      accessibility: {
        score: number;
        affectedPagesCount: number;
      };
    };
  };
  assets: {
    totalEntries: number;
  };
}

const client = new GraphQLClient(config.DUBBOT_API_URL, {
  headers: {
    'X-Api-Key': config.DUBBOT_API_KEY,
  },
});

export async function fetchSiteStats(siteId: string): Promise<Omit<SnapshotRow, 'collectedAt'>> {
  const data = await withRetry(() =>
    client.request<SiteQueryResponse>(SITE_QUERY, {
      siteId,
      accountId: config.DUBBOT_ACCOUNT_ID,
    }),
  );

  return {
    siteUrl: data.site.url,
    siteId: data.site.id,
    score: data.site.latestStatsSnapshot.accessibility.score,
    pdfCount: data.assets.totalEntries,
    issuesCount: data.site.accessibilityCount,
    pagesWithIssues: data.site.latestStatsSnapshot.accessibility.affectedPagesCount,
  };
}
