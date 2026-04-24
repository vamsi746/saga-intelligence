/**
 * Builds a URL to the grievances page pre-filtered for a specific entity
 * (MLA, MP, or any future entity type).
 *
 * Entity shape:
 *   MLA/Minister: { id, name, shortName, role, constituency, entityType? }
 *   MP (future):  { id, name, shortName, role: 'MP', constituency, entityType: 'mp' }
 *
 * Uses politician_constituency instead of location so the Grievances page
 * doesn't confuse it with a user-applied location filter.
 */
export const buildGrievancesUrl = (entity) => {
  if (!entity) return '/grievances';

  const params = new URLSearchParams();

  // Entity identity — read back in Grievances.js to activate politician mode
  params.set('politician_id', entity.id || '');
  params.set('politician_name', entity.name || entity.shortName || '');
  params.set('politician_role', entity.role || 'MLA');

  // Constituency goes through a dedicated param so it's not treated as locationFilter
  if (entity.constituency) {
    params.set('politician_constituency', entity.constituency.toLowerCase());
  }

  // Optional entity type for future non-MLA entities (MPs, councillors, etc.)
  if (entity.entityType && entity.entityType !== 'mla') {
    params.set('entity_type', entity.entityType);
  }

  return `/grievances?${params.toString()}`;
};
