import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../lib/api';
import { buildKeywordList, scoreRelevance, isGrievanceRelevant, getEntityKeywords } from '../utils/keywordService';

/**
 * Multi-signal parallel-fetch hook for politician-specific grievances.
 * Reusable outside Grievances.js (e.g. TopMlaWatchCard, MinisterDetailPanel).
 *
 * Fetch pipeline (priority order):
 *  1. posted_by_handle   — content FROM the politician's official account
 *  2. @mention search    — content MENTIONING the politician's handle
 *  3. Primary name terms — content mentioning the politician by name
 *  4. Alias terms        — role / title based mentions
 *  5. Constituency       — location supplement (noise-filtered post-fetch)
 *
 * Post-fetch gate (isGrievanceRelevant):
 *  Drops constituency-only and party-only matches that don't directly
 *  mention the politician. Primary noise suppressor.
 *
 * @param {object|null} entity  - { id, name, shortName, constituency, role }
 * @param {object}      filters - { sentiment, grievance_type, status_filter, ... }
 * @param {object}      options - { autoRefreshMs, maxKeywords, searchLimit, constituencyLimit, maxResults }
 */
const usePoliticianGrievances = (entity, filters = {}, options = {}) => {
  const [grievances, setGrievances]                 = useState([]);
  const [loading, setLoading]                       = useState(false);
  const [error, setError]                           = useState(null);
  const [total, setTotal]                           = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt]           = useState(null);
  const [customKeywords, setCustomKeywords]         = useState([]);
  const [disabledKeywordIds, setDisabledKeywordIds] = useState(new Set());

  const {
    autoRefreshMs     = 0,
    maxKeywords       = 8,
    searchLimit       = 40,
    constituencyLimit = 20,
    maxResults        = 0,
  } = options;

  const systemKeywords = useMemo(() => buildKeywordList(entity), [entity]);

  const allKeywords = useMemo(() => {
    const custom = customKeywords.map((term, i) => ({
      id: `custom_${i}`, term, type: 'custom', label: term, isSystem: false,
    }));
    return [...systemKeywords, ...custom];
  }, [systemKeywords, customKeywords]);

  const activeKeywords = useMemo(
    () => allKeywords.filter(k => !disabledKeywordIds.has(k.id)),
    [allKeywords, disabledKeywordIds]
  );

  // Stable filters reference — callers that pass an inline `{}` would otherwise
  // recreate the useCallback on every render, causing an infinite fetch loop.
  const filtersRef = useRef(filters);
  const filtersKey = JSON.stringify(filters);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFilters = useMemo(() => { filtersRef.current = filters; return filtersRef.current; }, [filtersKey]);

  const fetch = useCallback(async () => {
    if (!entity) {
      setGrievances([]);
      setTotal(0);
      setLastUpdatedAt(null);
      return;
    }

    setLoading(true);
    setError(null);

    const commonParams = { limit: searchLimit, ...stableFilters };
    const entityKws    = getEntityKeywords(entity);

    const requests = [];

    // 1. posted_by_handle — official posts FROM the politician's account
    entityKws.handles.slice(0, 2).forEach(handle => {
      requests.push(
        api.get('/grievances', { params: { posted_by_handle: handle, limit: searchLimit, ...stableFilters } })
          .catch(() => ({ data: { grievances: [] } }))
      );
    });

    // 2. @mention search — posts that @tag the politician
    entityKws.handles.slice(0, 2).forEach(handle => {
      requests.push(
        api.get('/grievances', { params: { search: `@${handle}`, ...commonParams } })
          .catch(() => ({ data: { grievances: [] } }))
      );
    });

    // 3 & 4. Primary names + aliases (budget = maxKeywords minus handle slots)
    const handleSlots  = Math.min(entityKws.handles.length, 2) * 2;
    const nameBudget   = Math.max(1, maxKeywords - handleSlots);

    activeKeywords
      .filter(k => k.type === 'primary' || k.type === 'alias' || k.type === 'custom')
      .slice(0, nameBudget)
      .forEach(kw => {
        requests.push(
          api.get('/grievances', { params: { search: kw.term, ...commonParams } })
            .catch(() => ({ data: { grievances: [] } }))
        );
      });

    // 5. Constituency supplement — small cap, filtered strictly post-fetch
    if (entity.constituency) {
      requests.push(
        api.get('/grievances', {
          params: {
            location_city: entity.constituency.toLowerCase(),
            location:      entity.constituency.toLowerCase(),
            limit:         constituencyLimit,
            ...stableFilters,
          },
        }).catch(() => ({ data: { grievances: [] } }))
      );
    }

    try {
      const responses = await Promise.all(requests);

      // Merge + deduplicate
      const seen   = new Set();
      const merged = [];
      responses.forEach(res => {
        (res.data?.grievances ?? []).forEach(g => {
          if (g.id && !seen.has(g.id)) {
            seen.add(g.id);
            merged.push(g);
          }
        });
      });

      // Score relevance
      const scored = merged.map(g => {
        const text = [
          g.content?.full_text,
          g.content?.text,
          g.posted_by?.handle,
          g.posted_by?.display_name,
          g.tagged_account,
          g.location_city,
        ].filter(Boolean).join(' ');
        return { ...g, _relevanceScore: scoreRelevance(text, activeKeywords) };
      });

      // Quality gate — drop zero-score and constituency/party-only noise
      const relevant = scored.filter(g => {
        if (g._relevanceScore <= 0) return false;
        return isGrievanceRelevant(g, entity);
      });

      // Sort: relevance desc, then date desc
      relevant.sort((a, b) => {
        const scoreDiff = (b._relevanceScore || 0) - (a._relevanceScore || 0);
        if (scoreDiff !== 0) return scoreDiff;
        const aDate = new Date(a.post_date || a.detected_date || a.created_at || 0).getTime();
        const bDate = new Date(b.post_date || b.detected_date || b.created_at || 0).getTime();
        return bDate - aDate;
      });

      const results = maxResults > 0 ? relevant.slice(0, maxResults) : relevant;
      setGrievances(results);
      setTotal(relevant.length); // full matched count, not the display-capped slice
      setLastUpdatedAt(new Date());
    } catch (err) {
      setError('Failed to load politician grievances');
    } finally {
      setLoading(false);
    }
  }, [entity, activeKeywords, stableFilters, searchLimit, maxKeywords, constituencyLimit, maxResults]);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    if (!entity || !autoRefreshMs) return undefined;
    const timer = setInterval(fetch, autoRefreshMs);
    return () => clearInterval(timer);
  }, [entity, autoRefreshMs, fetch]);

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
