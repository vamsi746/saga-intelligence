/**
 * Builds a URL to the grievances page pre-filtered for a specific politician.
 * Uses search + location as the primary filter mechanism since the grievances
 * API supports both params without requiring a politician_id foreign key.
 */
export const buildGrievancesUrl = (politician) => {
  if (!politician) return '/grievances';

  const params = new URLSearchParams();

  // politician context params (read back in Grievances.js to show the banner)
  params.set('politician_id', politician.id || '');
  params.set('politician_name', politician.name || politician.shortName || '');
  params.set('politician_role', politician.role || 'MLA');

  // pre-fill the search filter with the politician's short name
  const searchTerm = politician.shortName || politician.name || '';
  if (searchTerm) params.set('search', searchTerm);

  // pre-fill location with constituency
  if (politician.constituency) params.set('location', politician.constituency.toLowerCase());

  return `/grievances?${params.toString()}`;
};
