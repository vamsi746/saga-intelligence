import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../lib/api';
import { buildKeywordList, scoreRelevance } from '../utils/keywordService';

/**
 * Multi-keyword parallel-fetch hook for politician-specific grievances.
 * Usable as a standalone hook outside Grievances.js (e.g., mini-dashboards).
 *
 * @param {object|null} entity  - { id, name, shortName, constituency, role }
 * @param {object}      filters - additive filters: { sentiment, grievance_type, status_filter }
 * @param {object}      options - { autoRefreshMs, maxKeywords, searchLimit, constituencyLimit, maxResults }
 */
const usePoliticianGrievances = (entity, filters = {}, options = {}) => {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [customKeywords, setCustomKeywords] = useState([]);
  const [disabledKeywordIds, setDisabledKeywordIds] = useState(new Set());

  const {
    autoRefreshMs = 0,
    maxKeywords = 6,
    searchLimit = 40,
    constituencyLimit = 30,
    maxResults = 0,
  } = options;

  const systemKeywords = useMemo(() => buildKeywordList(entity), [entity]);

  const allKeywords = useMemo(() => {
    const custom = customKeywords.map((term, i) => ({
      id: `custom_${i}`,
      term,
      type: 'custom',
      label: term,
      isSystem: false,
    }));
    return [...systemKeywords, ...custom];
  }, [systemKeywords, customKeywords]);

  const activeKeywords = useMemo(
    () => allKeywords.filter(k => !disabledKeywordIds.has(k.id)),
    [allKeywords, disabledKeywordIds]
  );

  const fetch = useCallback(async () => {
    if (!entity) {
      setGrievances([]);
      setTotal(0);
      setLastUpdatedAt(null);
      return;
    }
    setLoading(true);
    setError(null);

    const commonParams = { limit: searchLimit, ...filters };
    const keywordBudget = Math.max(1, entity.constituency ? maxKeywords - 1 : maxKeywords);

    // Build parallel requests: one per active keyword (cap at 6 to avoid rate limits)
    const requests = activeKeywords
      .filter((kw) => kw.type !== 'constituency')
      .slice(0, keywordBudget)
      .map(kw =>
      api.get('/grievances', { params: { search: kw.term, ...commonParams } })
        .catch(() => ({ data: { grievances: [] } }))
    );

    // Always include a constituency-only fetch for indirect mentions
    if (entity.constituency) {
      requests.push(
        api.get('/grievances', {
          params: {
            location_city: entity.constituency.toLowerCase(),
            location: entity.constituency.toLowerCase(),
            limit: constituencyLimit,
            ...filters,
          },
        }).catch(() => ({ data: { grievances: [] } }))
      );
    }

    try {
      const responses = await Promise.all(requests);

      // Merge + deduplicate by ID
      const seen = new Set();
      const merged = [];
      responses.forEach(res => {
        (Array.isArray(res.data?.grievances) ? res.data.grievances : []).forEach(g => {
          if (g.id && !seen.has(g.id)) {
            seen.add(g.id);
            merged.push(g);
          }
        });
      });

      // Score and sort by relevance
      const scored = merged.map(g => {
        const text = [
          g.content?.full_text,
          g.content?.text,
          g.posted_by?.name,
          g.posted_by?.display_name,
          g.location_city,
        ].filter(Boolean).join(' ');
        return { ...g, _relevanceScore: scoreRelevance(text, activeKeywords) };
      });
      scored.sort((a, b) => {
        const scoreDiff = (b._relevanceScore || 0) - (a._relevanceScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        const aDate = new Date(a.post_date || a.detected_date || a.created_at || 0).getTime();
        const bDate = new Date(b.post_date || b.detected_date || b.created_at || 0).getTime();
        return bDate - aDate;
      });

      setGrievances(maxResults > 0 ? scored.slice(0, maxResults) : scored);
      setTotal(scored.length);
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError('Failed to load politician grievances');
    } finally {
      setLoading(false);
    }
  }, [entity, activeKeywords, filters, searchLimit, maxKeywords, constituencyLimit, maxResults]);

  // Re-fetch whenever entity or active keywords change
  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!entity || !autoRefreshMs) return undefined;
    const timer = setInterval(() => {
      fetch();
    }, autoRefreshMs);
    return () => clearInterval(timer);
  }, [entity, autoRefreshMs, fetch]);

  // Reset custom keywords when politician changes
  useEffect(() => {
    setCustomKeywords([]);
    setDisabledKeywordIds(new Set());
  }, [entity?.id]);

  const toggleKeyword = useCallback((kwId) => {
    setDisabledKeywordIds(prev => {
      const next = new Set(prev);
      if (next.has(kwId)) next.delete(kwId); else next.add(kwId);
      return next;
    });
  }, []);

  const addCustomKeyword = useCallback((term) => {
    const t = term?.trim();
    if (!t || customKeywords.includes(t)) return;
    setCustomKeywords(prev => [...prev, t]);
  }, [customKeywords]);

  const removeCustomKeyword = useCallback((term) => {
    setCustomKeywords(prev => prev.filter(t => t !== term));
  }, []);

  return {
    grievances, loading, error, total,
    lastUpdatedAt,
    allKeywords, activeKeywords, disabledKeywordIds,
    toggleKeyword, addCustomKeyword, removeCustomKeyword,
    refresh: fetch,
  };
};

export default usePoliticianGrievances;
