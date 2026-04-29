const { fetchKeywordGrievances } = require('./grievanceService');

let isFetching = false;
let stopRequested = false;
let lastFetchedAt = null;
let lastFetchStatus = 'idle'; // 'idle' | 'running' | 'stopped' | 'done' | 'error'
let lastFetchStats = null;    // { newGrievances, keywordsSearched }

const getStatus = () => ({
  isFetching,
  lastFetchedAt,
  lastFetchStatus,
  lastFetchStats,
  stopRequested
});

// Stop signal: lets current fetch finish but marks it as stopped-by-user
const stopFetch = () => {
  if (isFetching) {
    stopRequested = true;
    return true;
  }
  return false;
};

const runKeywordGrievanceFetch = async ({ triggeredBy = 'scheduler', platformFilter = null } = {}) => {
  if (isFetching) {
    console.log('[KeywordGrievanceScheduler] Already running, skipping');
    return { skipped: true };
  }

  isFetching = true;
  stopRequested = false;
  lastFetchStatus = 'running';
  lastFetchStats = null;

  try {
    console.log(`[KeywordGrievanceScheduler] Starting fetch | by=${triggeredBy} | platform=${platformFilter || 'all'}`);
    const result = await fetchKeywordGrievances(platformFilter);

    lastFetchedAt = new Date();
    lastFetchStats = result;
    lastFetchStatus = stopRequested ? 'stopped' : 'done';
    console.log(`[KeywordGrievanceScheduler] Done | newGrievances=${result?.newGrievances ?? 0} | keywords=${result?.keywordsSearched ?? 0}`);
    return result;
  } catch (err) {
    lastFetchStatus = 'error';
    console.error('[KeywordGrievanceScheduler] Error:', err.message);
    return { error: err.message };
  } finally {
    isFetching = false;
    stopRequested = false;
  }
};

module.exports = { runKeywordGrievanceFetch, stopFetch, getStatus };
