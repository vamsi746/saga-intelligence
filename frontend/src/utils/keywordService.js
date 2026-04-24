import MLA_KEYWORD_OVERRIDES from '../data/mlaKeywords';

/**
 * Returns structured keyword categories for an entity (MLA/MP).
 * primary   = full name + short name
 * constituency = constituency name
 * aliases   = registry-defined alternative references
 */
export const getEntityKeywords = (entity) => {
  if (!entity) return { primary: [], constituency: [], aliases: [], all: [] };

  const overrides = MLA_KEYWORD_OVERRIDES[entity.id] || {};

  const primary = [...new Set([entity.name, entity.shortName].filter(Boolean))];
  const constituency = [entity.constituency].filter(Boolean);
  const aliases = overrides.aliases || [];

  return { primary, constituency, aliases, all: [...primary, ...constituency, ...aliases] };
};

/**
 * Returns a flat list of keyword objects for UI rendering and fetch dispatch.
 * [{ id, term, type: 'primary'|'constituency'|'alias'|'custom', label, isSystem }]
 */
export const buildKeywordList = (entity) => {
  if (!entity) return [];
  const kws = getEntityKeywords(entity);
  const list = [];
  let idx = 0;
  kws.primary.forEach(term => {
    list.push({ id: `primary_${idx++}`, term, type: 'primary', label: term, isSystem: true });
  });
  kws.constituency.forEach(term => {
    list.push({ id: `constituency_${idx++}`, term, type: 'constituency', label: term, isSystem: true });
  });
  kws.aliases.forEach(term => {
    list.push({ id: `alias_${idx++}`, term, type: 'alias', label: term, isSystem: true });
  });
  return list;
};

/**
 * Scores how strongly a piece of text matches a keyword list.
 * Primary keyword hits score higher than constituency/alias hits.
 */
export const scoreRelevance = (text, keywordList) => {
  if (!text || !keywordList?.length) return 0;
  const lower = text.toLowerCase();
  return keywordList.reduce((score, kw) => {
    if (!kw?.term) return score;
    const t = kw.term.toLowerCase();
    const weight = kw.type === 'primary' ? 3 : kw.type === 'constituency' ? 2 : 1;
    return lower.includes(t) ? score + weight : score;
  }, 0);
};

/**
 * Validates that a grievance is truly relevant to the entity.
 * Returns true if at least one primary keyword appears in the content.
 * Used as a post-fetch quality gate to filter out noise from constituency-only matches.
 */
export const isGrievanceRelevant = (grievance, entity) => {
  if (!grievance || !entity) return false;
  const kws = getEntityKeywords(entity);
  const text = [
    grievance.content?.full_text,
    grievance.content?.text,
    grievance.posted_by?.name,
    grievance.posted_by?.display_name,
    grievance.location_city,
  ].filter(Boolean).join(' ').toLowerCase();

  // Must match at least one primary keyword OR constituency + alias combo
  const hasPrimary = kws.primary.some(k => text.includes(k.toLowerCase()));
  const hasConstituency = kws.constituency.some(k => text.includes(k.toLowerCase()));
  const hasAlias = kws.aliases.some(k => text.includes(k.toLowerCase()));
  return hasPrimary || hasAlias || hasConstituency;
};
