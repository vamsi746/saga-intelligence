import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { geoMercator, geoPath, geoCentroid } from 'd3-geo';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Loader2, TrendingUp, TrendingDown, Minus, BarChart3, Tag, MapPin, ArrowLeft, Crown } from 'lucide-react';
import { cn } from '../lib/utils';
import { TELANGANA_MINISTERS, getMinisterInitials } from '../data/telanganaMinistersData';

const MAHBUBNAGAR_PC = 'MAHBUBNAGAR';

// Normalize AC names for matching: strip reservation suffixes (SC/ST/MBC) and fix known
// spelling discrepancies between our data and the GeoJSON AC_NAME field.
const AC_SPELLING_ALIASES = {
  bellampalli: 'bellampalle',
  vikarabad:   'vicarabad',
};
const normalizeAcName = (n) => {
  if (!n) return '';
  const stripped = n
    .replace(/\s*\(\s*(SC|ST|MBC|OBC|GEN|SP)\s*\)\s*$/i, '')
    .trim()
    .toLowerCase();
  return AC_SPELLING_ALIASES[stripped] || stripped;
};

const TOPIC_STYLES = {
  'Political Criticism': 'bg-purple-50 text-purple-700 ring-purple-200',
  'Hate Speech': 'bg-red-50 text-red-700 ring-red-200',
  'Hate Speech Threat': 'bg-red-50 text-red-700 ring-red-200',
  'Public Complaint': 'bg-blue-50 text-blue-700 ring-blue-200',
  'Corruption Complaint': 'bg-orange-50 text-orange-700 ring-orange-200',
  'General Complaint': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'Traffic Complaint': 'bg-amber-50 text-amber-700 ring-amber-200',
  'Public Nuisance': 'bg-rose-50 text-rose-700 ring-rose-200',
  'Road & Infrastructure': 'bg-yellow-50 text-yellow-700 ring-yellow-200',
  'Law & Order': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'Normal': 'bg-gray-50 text-gray-600 ring-gray-200',
};

const canonicalizeTopic = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const normalized = raw.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();

  if (normalized === 'normal' || normalized === 'govt praise' || normalized === 'government praise' || normalized === 'general praise' || normalized === 'general complaint') return 'General Complaint';
  if (normalized === 'public complaint') return 'Public Complaint';
  if (normalized === 'political criticism') return 'Political Criticism';
  if (normalized === 'corruption complaint') return 'Corruption Complaint';
  if (normalized === 'traffic complaint') return 'Traffic Complaint';
  if (normalized === 'public nuisance') return 'Public Nuisance';
  if (normalized === 'road and infrastructure' || normalized === 'road & infrastructure') return 'Road & Infrastructure';
  if (normalized === 'law and order' || normalized === 'law & order') return 'Law & Order';
  if (normalized === 'hate speech') return 'Hate Speech';

  return normalized
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getTopicStyle = (topic) => TOPIC_STYLES[canonicalizeTopic(topic)] || 'bg-teal-50 text-teal-700 ring-teal-200';

const AC_NAMES = ['Kodangal', 'Narayanpet', 'Mahbubnagar', 'Jadcherla', 'Devarkadra', 'Makthal', 'Shadnagar'];

const SENTIMENT_TIERS = {
  high:    { fill: '#15803d', hover: '#166534', stroke: '#14532d' },
  medium:  { fill: '#22c55e', hover: '#16a34a', stroke: '#15803d' },
  low:     { fill: '#86efac', hover: '#4ade80', stroke: '#22c55e' },
  none:    { fill: '#e2e8f0', hover: '#cbd5e1', stroke: '#94a3b8' },
};

const getSentimentColors = (stats) => {
  if (!stats || stats.count === 0) return SENTIMENT_TIERS.none;
  const ratio = (stats.positive || 0) / stats.count;
  if (ratio >= 0.6) return SENTIMENT_TIERS.high;
  if (ratio >= 0.3) return SENTIMENT_TIERS.medium;
  return SENTIMENT_TIERS.low;
};

const formatTopicLabel = (value) => {
  const canonical = canonicalizeTopic(value);
  return canonical || 'Normal';
};

const mergeTopicEntries = (entries = []) => {
  const topicMap = {};
  entries.forEach((item) => {
    const [rawTopic, rawCount] = Array.isArray(item)
      ? item
      : [item?.name || item?.topic, item?.count || 0];
    const topic = canonicalizeTopic(rawTopic);
    const count = Number(rawCount) || 0;
    if (!topic || count <= 0) return;
    topicMap[topic] = (topicMap[topic] || 0) + count;
  });
  return Object.entries(topicMap).sort((a, b) => b[1] - a[1]);
};

const CITY_TO_AC = {
  'kodangal': 'Kodangal', 'narayanpet': 'Narayanpet', 'mahbubnagar': 'Mahbubnagar',
  'mahabubnagar': 'Mahbubnagar', 'jadcherla': 'Jadcherla', 'devarkadra': 'Devarkadra',
  'makthal': 'Makthal', 'shadnagar': 'Shadnagar',
  'kosgi': 'Kodangal', 'bomraspet': 'Kodangal', 'doultabad': 'Kodangal',
  'maddur': 'Kodangal', 'kalwakurthy': 'Shadnagar',
};

const CITY_TO_DISTRICT = {
  'hyderabad': 'HYDERABAD', 'secunderabad': 'HYDERABAD', 'warangal': 'WARANGAL',
  'karimnagar': 'KARIMNAGAR', 'nizamabad': 'NIZAMABAD', 'khammam': 'KHAMMAM',
  'nalgonda': 'NALGONDA', 'adilabad': 'ADILABAD', 'mahabubnagar': 'MAHABUBNAGAR',
  'mahbubnagar': 'MAHABUBNAGAR', 'rangareddy': 'RANGAREDDY', 'medak': 'MEDAK',
  'sangareddy': 'SANGAREDDY', 'siddipet': 'SIDDIPET', 'vikarabad': 'VIKARABAD',
  'kodangal': 'VIKARABAD', 'narayanpet': 'NARAYANPET', 'jadcherla': 'MAHABUBNAGAR',
  'devarkadra': 'MAHABUBNAGAR', 'makthal': 'NARAYANPET', 'shadnagar': 'RANGAREDDY',
  'suryapet': 'SURYAPET', 'kamareddy': 'KAMAREDDY', 'jagtial': 'JAGTIAL',
  'peddapalli': 'PEDDAPALLI', 'mancherial': 'MANCHERIAL', 'nirmal': 'NIRMAL',
  'wanaparthy': 'WANAPARTHY', 'nagarkurnool': 'NAGARKURNOOL', 'jangaon': 'JANGAON',
  'mahabubabad': 'MAHABUBABAD', 'medchal': 'MEDCHAL-MALKAJGIRI',
  'sircilla': 'RAJANNA SIRCILLA', 'telangana': 'HYDERABAD',
  'kaleshwaram': 'JAGTIAL', 'telangana state': 'HYDERABAD',
  'bangalore': null, 'delhi': null, 'patna': null, 'kochi': null, 'agra': null,
  'bhubaneswar': null, 'vijayawada': null, 'nawanshahr': null,
};

/* ─── Sentiment Pie (pure SVG donut) ─── */
const SentimentPie = ({ positive = 0, negative = 0, neutral = 0, size = 180 }) => {
  const total = positive + negative + neutral;
  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <div className="text-sm text-slate-400">No data</div>
      </div>
    );
  }

  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  const slices = [
    { value: negative, color: '#ef4444', label: 'Negative' },
    { value: neutral, color: '#94a3b8', label: 'Neutral' },
    { value: positive, color: '#22c55e', label: 'Positive' },
  ].filter(s => s.value > 0);

  let startAngle = -Math.PI / 2;
  const paths = slices.map((slice) => {
    const angle = (slice.value / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    startAngle = endAngle;
    return { ...slice, d };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths.map((p, i) => (
        <path key={i} d={p.d} fill={p.color} stroke="white" strokeWidth={2} />
      ))}
      <circle cx={cx} cy={cy} r={r * 0.55} fill="white" />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#1e293b" fontSize="18" fontWeight="700">{total}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="500">Total</text>
    </svg>
  );
};

const SELECTED_AC_COLORS = { fill: '#3b82f6', hover: '#2563eb', stroke: '#1d4ed8' };

const TelanganaMap = ({ embedded = false, highlightMinister = null, highlightMinisters = [] }) => {
  const navigate = useNavigate();
  const routerLocation = useLocation();

  // Parse minister/constituency from URL params (standalone mode only)
  const urlParams = useMemo(() => {
    const p = new URLSearchParams(routerLocation.search);
    return {
      constituency: p.get('constituency') || null,
      ministerName: p.get('minister') || null,
      ministerRole: p.get('role') || null,
      ministerDept: p.get('dept') || null,
      ministerId: p.get('ministerId') || null,
    };
  }, [routerLocation.search]);

  const selectedMinisterData = useMemo(() => {
    if (!urlParams.ministerId) return null;
    return TELANGANA_MINISTERS.find((m) => m.id === urlParams.ministerId) || null;
  }, [urlParams.ministerId]);

  const [geojson, setGeojson] = useState(null);
  const [mapStats, setMapStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [hoveredDistrict, setHoveredDistrict] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [sentimentData, setSentimentData] = useState(null);
  const [categoryData, setCategoryData] = useState(null);
  const [grievanceStats, setGrievanceStats] = useState(null);
  const [alertStats, setAlertStats] = useState(null);
  const [selectedConstituencyData, setSelectedConstituencyData] = useState(null);
  const [hoverTweets, setHoverTweets] = useState([]);
  const [hoverTweetsLoading, setHoverTweetsLoading] = useState(false);
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const hoverHideTimerRef = useRef(null);

  const clearHoverHideTimer = useCallback(() => {
    if (hoverHideTimerRef.current) {
      clearTimeout(hoverHideTimerRef.current);
      hoverHideTimerRef.current = null;
    }
  }, []);

  const scheduleHoverHide = useCallback(() => {
    clearHoverHideTimer();
    hoverHideTimerRef.current = setTimeout(() => {
      setHoveredDistrict(null);
    }, 220);
  }, [clearHoverHideTimer]);

  const handleDistrictClick = useCallback((distName) => {
    if (!distName) return;
    if (embedded) {
      const DistrictName = distName.replace(/\s*\(SC\)\s*$/, '').trim();
      navigate(`/grievances?location=${encodeURIComponent(DistrictName)}&sentiment=negative`);
    } else {
      // Title-case the all-caps DIST_NAME from GeoJSON (e.g. "MAHABUBNAGAR" → "Mahabubnagar")
      const titleCased = distName.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
      navigate(`/grievances?location=${encodeURIComponent(titleCased)}&sentiment=negative`);
    }
  }, [navigate, embedded]);

  useEffect(() => {
    fetch('/telangana_ac.geojson')
      .then(r => r.json())
      .then(data => {
        const telangana = data.features.filter(f =>
          f.properties.ST_NAME === 'TELANGANA'
        );
        setGeojson({ ...data, features: telangana });
      });
  }, []);

  useEffect(() => {
    if (embedded) return;
    Promise.all([
      api.get('/grievances/sentiment-analytics').catch(() => ({ data: null })),
      api.get('/grievances/category-analytics').catch(() => ({ data: null })),
      api.get('/grievances/dashboard-stats').catch(() => ({ data: null })),
      api.get('/alerts/dashboard-stats').catch(() => ({ data: null })),
    ]).then(([sentRes, catRes, grievanceRes, alertRes]) => {
      setSentimentData(sentRes.data);
      setCategoryData(catRes.data);
      setGrievanceStats(grievanceRes.data);
      setAlertStats(alertRes.data);
    });
  }, [embedded]);

  // Fetch data for selected minister's constituency
  useEffect(() => {
    if (embedded || !urlParams.constituency) { setSelectedConstituencyData(null); return; }
    api.get('/grievances/location-summary', {
      params: { location_city: urlParams.constituency.toLowerCase() }
    })
      .then((res) => setSelectedConstituencyData(res.data || null))
      .catch(() => setSelectedConstituencyData(null));
  }, [embedded, urlParams.constituency]);

  const fetchMapStats = useCallback(async () => {
    setLoading(true);
    try {
      if (embedded) {
        // Embedded: only need mahabubnagar scope
        const res = await api.get('/grievances/map', { params: { days: 30, scope: 'mahabubnagar' } });
        const locs = res.data?.locations;
        if (locs && Object.keys(locs).length > 0) { setMapStats(locs); }
        else { setMapStats({}); }
      } else {
        // Full-state: fetch both scopes so sidebar and AC map use same data
        const [allRes, mahRes] = await Promise.all([
          api.get('/grievances/map', { params: { days: 30, scope: 'all' } }),
          api.get('/grievances/map', { params: { days: 30, scope: 'mahabubnagar' } }),
        ]);
        const allLocs = allRes.data?.locations || {};
        const mahLocs = mahRes.data?.locations || {};
        // Merge: all-scope for district view, mahabubnagar-scope for AC/sidebar
        setMapStats({ ...allLocs, ...mahLocs });
      }
    } catch (err) { console.warn('[Map] /grievances/map failed:', err.message); setMapStats({}); }
    finally { setLoading(false); }
  }, [embedded]);

  useEffect(() => { fetchMapStats(); }, [fetchMapStats]);

  useEffect(() => () => {
    if (hoverHideTimerRef.current) clearTimeout(hoverHideTimerRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadHoverTweets = async () => {
      if (!embedded || !hoveredDistrict) {
        setHoverTweets([]);
        setHoverTweetsLoading(false);
        return;
      }
      const acQuery = hoveredDistrict.replace(/\s*\(SC\)\s*$/i, '').trim();
      setHoverTweetsLoading(true);
      try {
        const res = await api.get('/grievances', {
          params: {
            limit: 5,
            location_constituency: acQuery
          }
        });
        if (cancelled) return;
        const items = Array.isArray(res.data?.grievances) ? res.data.grievances : [];
        setHoverTweets(items);
      } catch (error) {
        if (!cancelled) setHoverTweets([]);
      } finally {
        if (!cancelled) setHoverTweetsLoading(false);
      }
    };

    loadHoverTweets();
    return () => { cancelled = true; };
  }, [embedded, hoveredDistrict]);

  const byDistrict = useMemo(() => {
    const m = {};
    // Use API aggregate key for Mahabubnagar district if available
    if (mapStats?.mahabubnagar) {
      const mah = mapStats.mahabubnagar;
      m['MAHABUBNAGAR'] = {
        count: mah.total ?? mah.count ?? 0,
        positive: mah.positive || 0,
        negative: mah.negative || 0,
        neutral: mah.neutral || 0,
        categories: Array.isArray(mah.categories) ? [...mah.categories] : []
      };
    }

    Object.entries(mapStats).forEach(([keyword, stats]) => {
      if (keyword === 'mahabubnagar') return; // already handled above
      const dist = CITY_TO_DISTRICT[keyword];
      if (!dist) return;
      if (m['MAHABUBNAGAR'] && dist === 'MAHABUBNAGAR') return;
      if (!m[dist]) m[dist] = { count: 0, positive: 0, negative: 0, neutral: 0, categories: [] };
      m[dist].count += stats.count || stats.total || ((stats.negative || 0) + (stats.positive || 0) + (stats.neutral || 0));
      m[dist].positive += stats.positive || 0;
      m[dist].negative += stats.negative || 0;
      m[dist].neutral += stats.neutral || 0;
      m[dist].categories = m[dist].categories.concat(stats.categories || []);
    });
    Object.values(m).forEach((d) => {
      d.categories = mergeTopicEntries(d.categories);
    });
    return m;
  }, [mapStats]);

  const byAC = useMemo(() => {
    const m = {};
    const acKeywordAllowList = new Set(['kodangal', 'narayanpet', 'mahbubnagar', 'jadcherla', 'devarkadra', 'makthal', 'shadnagar']);
    Object.entries(mapStats).forEach(([keyword, stats]) => {
      const normalizedKeyword = String(keyword || '').toLowerCase().trim();
      // Skip non-AC aggregate key ("mahabubnagar" is constituency total in API response)
      if (!acKeywordAllowList.has(normalizedKeyword)) return;
      const ac = CITY_TO_AC[keyword];
      if (!ac) return;
      if (!m[ac]) m[ac] = { count: 0, positive: 0, negative: 0, neutral: 0, categories: [] };
      m[ac].count += stats.count || stats.total || ((stats.negative || 0) + (stats.positive || 0) + (stats.neutral || 0));
      m[ac].positive += stats.positive || 0;
      m[ac].negative += stats.negative || 0;
      m[ac].neutral += stats.neutral || 0;
      m[ac].categories = m[ac].categories.concat(stats.categories || []);
    });
    Object.values(m).forEach((d) => {
      d.categories = mergeTopicEntries(d.categories);
    });
    return m;
  }, [mapStats, embedded]);

  const pcFeatures = useMemo(() => {
    if (!geojson) return null;
    const feats = geojson.features.filter(f => f.properties.PC_NAME === MAHBUBNAGAR_PC);
    return { ...geojson, features: feats };
  }, [geojson]);

  const { projection, pathGenerator, dims } = useMemo(() => {
    if (!geojson) return { projection: null, pathGenerator: null, dims: { w: 800, h: 950 } };
    const w = embedded ? 600 : 700;
    const h = embedded ? 600 : 850;
    const proj = geoMercator().fitSize([w, h], geojson);
    return { projection: proj, pathGenerator: geoPath().projection(proj), dims: { w, h } };
  }, [geojson, embedded]);

  const districtCentroids = useMemo(() => {
    if (!geojson || !projection) return {};
    const groups = {};
    geojson.features.forEach(f => {
      const d = f.properties.DIST_NAME;
      if (!groups[d]) groups[d] = [];
      groups[d].push(f);
    });
    const out = {};
    Object.entries(groups).forEach(([name, feats]) => {
      let sx = 0, sy = 0;
      feats.forEach(f => { const c = geoCentroid(f); sx += c[0]; sy += c[1]; });
      const px = projection([sx / feats.length, sy / feats.length]);
      if (px) out[name] = px;
    });
    return out;
  }, [geojson, projection]);

  const acCentroids = useMemo(() => {
    if (!pcFeatures || !projection) return {};
    const out = {};
    pcFeatures.features.forEach(f => {
      const name = f.properties.AC_NAME;
      const c = geoCentroid(f);
      const px = projection(c);
      if (px) out[name] = px;
    });
    return out;
  }, [pcFeatures, projection]);

  const allAcCentroids = useMemo(() => {
    if (!geojson || !projection) return {};
    const out = {};
    geojson.features.forEach(f => {
      const raw = f.properties.AC_NAME;
      if (!raw) return;
      const c = geoCentroid(f);
      const px = projection(c);
      if (!px) return;
      if (!out[raw]) out[raw] = px;
      // Also store under normalized key so data-side constituency names resolve correctly
      const norm = normalizeAcName(raw);
      if (!out[norm]) out[norm] = px;
    });
    return out;
  }, [geojson, projection]);

  const districtFeatures = useMemo(() => {
    if (!geojson) return {};
    const m = {};
    geojson.features.forEach(f => {
      const d = f.properties.DIST_NAME;
      if (!m[d]) m[d] = { name: d, hasMahbubnagar: false };
      if (f.properties.PC_NAME === MAHBUBNAGAR_PC) m[d].hasMahbubnagar = true;
    });
    return m;
  }, [geojson]);

  const handleMouseMove = (e, distName) => {
    clearHoverHideTimer();
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) setTooltipPos({ x: e.clientX - rect.left + 16, y: e.clientY - rect.top - 10 });
    setHoveredDistrict(distName);
  };

  const getTooltipTop = useCallback((estimatedHeight) => {
    const containerHeight = containerRef.current?.offsetHeight || dims.h || 700;
    const gap = 10;
    const fromTop = tooltipPos.y;
    const showAbove = fromTop > (containerHeight * 0.58);
    const rawTop = showAbove ? (fromTop - estimatedHeight - gap) : (fromTop + gap);
    const maxTop = Math.max(6, containerHeight - estimatedHeight - 6);
    return Math.min(Math.max(rawTop, 6), maxTop);
  }, [tooltipPos.y, dims.h]);

  const getTooltipLeft = useCallback((estimatedWidth) => {
    const containerWidth = containerRef.current?.offsetWidth || 800;
    const gap = 16;
    // If cursor is in the right 40% of the container, flip tooltip to the left
    if (tooltipPos.x > containerWidth * 0.6) {
      return Math.max(6, tooltipPos.x - estimatedWidth - gap);
    }
    return Math.min(tooltipPos.x + gap, containerWidth - estimatedWidth - 6);
  }, [tooltipPos.x]);

  const totalSentiment = useMemo(() => {
    // Use state-level distribution from sentiment analytics API
    if (sentimentData?.distribution) {
      const d = sentimentData.distribution;
      return { positive: d.positive || 0, negative: d.negative || 0, neutral: d.neutral || 0 };
    }
    // Fallback: aggregate across all districts
    const agg = { positive: 0, negative: 0, neutral: 0 };
    Object.values(byDistrict).forEach(d => {
      agg.positive += d.positive || 0;
      agg.negative += d.negative || 0;
      agg.neutral += d.neutral || 0;
    });
    return agg;
  }, [sentimentData, byDistrict]);

  const totalGrievances = useMemo(() => {
    if (grievanceStats?.all?.total != null) return grievanceStats.all.total;
    if (grievanceStats?.total != null) return grievanceStats.total;
    return (totalSentiment.positive || 0) + (totalSentiment.negative || 0) + (totalSentiment.neutral || 0);
  }, [grievanceStats, totalSentiment]);

  const topCategories = useMemo(() => {
    if (categoryData?.topics?.length > 0) return mergeTopicEntries(categoryData.topics).slice(0, 6);
    if (categoryData?.categories?.length > 0) return mergeTopicEntries(categoryData.categories).slice(0, 6);
    // Fallback: aggregate from all districts
    const allCats = Object.values(byDistrict).flatMap(d => d.categories || []);
    return mergeTopicEntries(allCats).slice(0, 6);
  }, [categoryData, byDistrict]);

  // Must be before early returns — hooks cannot be called conditionally
  const activeConstituencyData = useMemo(() => {
    if (!urlParams.constituency) return null;
    if (selectedConstituencyData) {
      return {
        total: selectedConstituencyData.total || 0,
        positive: selectedConstituencyData.positive || 0,
        negative: selectedConstituencyData.negative || 0,
        neutral: selectedConstituencyData.neutral || 0,
        categories: selectedConstituencyData.categories || [],
      };
    }
    const distKey = Object.keys(byDistrict).find(
      (k) => k.toLowerCase().includes((urlParams.constituency || '').toLowerCase().slice(0, 5))
    );
    return distKey ? byDistrict[distKey] : null;
  }, [urlParams.constituency, selectedConstituencyData, byDistrict]);

  const highlightedConstituency = useMemo(() => {
    if (highlightMinister?.constituency) return normalizeAcName(highlightMinister.constituency);
    if (highlightMinisters?.length > 0 && highlightMinisters[0]?.constituency) {
      return normalizeAcName(highlightMinisters[0].constituency);
    }
    return null;
  }, [highlightMinister, highlightMinisters]);

  if (!geojson) return <div className={cn('flex items-center justify-center', embedded ? 'h-full' : 'h-screen')}><Loader2 className="h-8 w-8 animate-spin text-green-600" /></div>;

  /* ── Embedded: fixed-scale map with single constituency boundary highlight ── */
  if (embedded) {
    const hasSelection = Boolean(highlightedConstituency);
    const highlightColor = highlightMinister?.color || highlightMinisters?.[0]?.color || SELECTED_AC_COLORS.stroke;

    return (
      <div className="relative w-full h-full bg-slate-50 overflow-hidden" ref={containerRef}>
        {loading && (
          <div className="absolute top-2 right-2 z-10">
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          </div>
        )}

        <svg ref={svgRef} viewBox={`0 0 ${dims.w} ${dims.h}`} className="w-full h-full">
          {geojson.features.map((f, i) => {
            const isHL = hasSelection && normalizeAcName(f.properties.AC_NAME) === highlightedConstituency;
            return (
              <path
                key={i}
                d={pathGenerator(f.geometry)}
                fill="#f1f5f9"
                stroke={isHL ? highlightColor : '#94a3b8'}
                strokeWidth={isHL ? 2.2 : 0.7}
                style={{ vectorEffect: 'non-scaling-stroke' }}
                className="transition-colors duration-150"
              />
            );
          })}
        </svg>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  //  STANDALONE: Constituency Overview Dashboard
  // ═══════════════════════════════════════════════

  // When a minister is selected, use their constituency data; else use default Kodangal/Mahabubnagar
  const activeConstituency = urlParams.constituency || 'Kodangal';
  const isMinisterView = !!urlParams.constituency;

  const displaySentiment = isMinisterView && activeConstituencyData
    ? { positive: activeConstituencyData.positive, negative: activeConstituencyData.negative, neutral: activeConstituencyData.neutral }
    : totalSentiment;

  const displayTotal = isMinisterView && activeConstituencyData
    ? activeConstituencyData.total
    : totalGrievances;

  const displayCategories = isMinisterView && activeConstituencyData
    ? mergeTopicEntries(activeConstituencyData.categories).slice(0, 6)
    : topCategories;

  const hovStats = hoveredDistrict ? (byDistrict[hoveredDistrict] || byAC[hoveredDistrict] || { count: 0, positive: 0, negative: 0, neutral: 0, categories: [] }) : null;
  const isHovAc = hoveredDistrict && AC_NAMES.includes(hoveredDistrict);
  const topCats = hovStats?.categories || [];
  const hovTotal = hovStats?.count || ((hovStats?.negative || 0) + (hovStats?.positive || 0) + (hovStats?.neutral || 0));

  return (
    <div className="p-4 lg:p-6 min-h-screen bg-slate-50" ref={containerRef}>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isMinisterView && (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {isMinisterView
                ? `${activeConstituency} Constituency Overview`
                : 'Telangana State Intelligence Dashboard'}
            </h1>
            {isMinisterView && urlParams.ministerName && (
              <p className="text-sm text-slate-500 mt-0.5">
                {urlParams.ministerName} · {urlParams.ministerRole}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
          <Button onClick={() => navigate('/dashboard')} className="gap-2 bg-slate-800 hover:bg-slate-700 text-white">
            <BarChart3 className="h-4 w-4" />
            {isMinisterView ? 'Back to Dashboard' : 'View More Details'}
          </Button>
        </div>
      </div>

      {/* State-level metrics strip */}
      {!isMinisterView && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          <Card className="p-3 border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Total Grievances</div>
            <div className="text-2xl font-bold text-blue-700 mt-0.5">{totalGrievances.toLocaleString()}</div>
          </Card>
          <Card className="p-3 border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100">
            <div className="text-[10px] font-semibold text-green-500 uppercase tracking-wide">Positive Sentiment</div>
            <div className="text-2xl font-bold text-green-700 mt-0.5">
              {totalGrievances > 0 ? Math.round((totalSentiment.positive / totalGrievances) * 100) : 0}%
            </div>
          </Card>
          <Card className="p-3 border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100">
            <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wide">Active Alerts</div>
            <div className="text-2xl font-bold text-red-700 mt-0.5">{alertStats?.total || alertStats?.count || 0}</div>
          </Card>
          <Card className="p-3 border-0 shadow-md bg-gradient-to-br from-purple-50 to-purple-100">
            <div className="text-[10px] font-semibold text-purple-500 uppercase tracking-wide">Constituencies</div>
            <div className="text-2xl font-bold text-purple-700 mt-0.5">{geojson?.features?.length || 119}</div>
          </Card>
        </div>
      )}

      {/* Main 2-column: Left analytics | Right map */}
      <div className="flex gap-5 items-start">
        {/* LEFT PANEL */}
        <div className="w-[340px] flex-shrink-0 space-y-4">
          
          {/* Minister / CM Photo Card */}
          <Card className="overflow-hidden border-0 shadow-lg">
            <div className="relative">
              {selectedMinisterData?.image ? (
                <img
                  src={selectedMinisterData.image}
                  alt={selectedMinisterData.shortName}
                  className="w-full object-cover object-top"
                  style={{ height: '320px' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                />
              ) : (
                <img
                  src="/CM.webp"
                  alt="CM Revanth Reddy"
                  className="w-full object-cover object-top"
                  style={{ height: '320px' }}
                />
              )}
              {/* Fallback avatar for ministers without photos */}
              {selectedMinisterData && (
                <div
                  className="w-full items-center justify-center"
                  style={{
                    height: '320px',
                    display: 'none',
                    background: `linear-gradient(135deg, ${selectedMinisterData.color}cc, ${selectedMinisterData.color})`,
                  }}
                >
                  <div className="text-8xl font-black text-white/80">
                    {getMinisterInitials(selectedMinisterData.shortName)}
                  </div>
                </div>
              )}
              <div
                className="absolute inset-0"
                style={{
                  background: selectedMinisterData
                    ? `linear-gradient(to top, ${selectedMinisterData.color}e6 0%, ${selectedMinisterData.color}30 40%, transparent 100%)`
                    : 'linear-gradient(to top, rgba(20,83,45,0.9) 0%, rgba(20,83,45,0.2) 40%, transparent 100%)',
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-xl font-extrabold text-white leading-tight drop-shadow">
                  {selectedMinisterData?.shortName || 'Revanth Reddy'}
                </h3>
                <p className="text-white/80 text-sm font-medium mt-0.5">
                  {selectedMinisterData?.role || 'Chief Minister'}, Telangana
                </p>
                {selectedMinisterData && (
                  <p className="text-white/70 text-[11px] mt-0.5">{selectedMinisterData.department}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-[11px] font-semibold border border-white/30">
                    <MapPin className="h-2.5 w-2.5" />
                    {isMinisterView ? `MLA · ${activeConstituency} Constituency` : 'Telangana State · 119 Constituencies'}
                  </span>
                  {selectedMinisterData && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-[11px] font-semibold border border-white/30">
                      <Crown className="h-2.5 w-2.5" />
                      Activity {selectedMinisterData.activityScore}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          {/* Sentiment Pie */}
          <Card className="p-4 border-0 shadow-md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700">Sentiment Analysis</h4>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                style={
                  selectedMinisterData
                    ? { color: selectedMinisterData.color, borderColor: `${selectedMinisterData.color}50`, background: `${selectedMinisterData.color}10` }
                    : { color: '#15803d', borderColor: '#bbf7d0', background: '#f0fdf4' }
                }
              >
                {isMinisterView ? activeConstituency : 'Telangana State'}
              </span>
            </div>
            <div className="flex justify-center">
              <SentimentPie
                positive={displaySentiment.positive || 0}
                negative={displaySentiment.negative || 0}
                neutral={displaySentiment.neutral || 0}
                size={180}
              />
            </div>
            <div className="flex justify-center gap-4 mt-3">
              <div className="flex items-center gap-1.5 text-xs">
                <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                <span className="text-green-700 font-semibold">{displaySentiment.positive || 0}</span>
                <span className="text-slate-400">Positive</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-red-700 font-semibold">{displaySentiment.negative || 0}</span>
                <span className="text-slate-400">Negative</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Minus className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-600 font-semibold">{displaySentiment.neutral || 0}</span>
                <span className="text-slate-400">Neutral</span>
              </div>
            </div>
          </Card>

          {/* Grievance Summary + Top Categories — side by side */}
          <div className="flex gap-3">
            {/* Quick Stats */}
            <Card className="p-3 border-0 shadow-md flex-1">
              <h4 className="text-xs font-semibold text-slate-700 mb-2">Grievance Summary</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-blue-700">{displayTotal}</div>
                  <div className="text-[9px] text-blue-500 font-medium">Total</div>
                </div>
                <div className="bg-green-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-green-700">{displaySentiment.positive || 0}</div>
                  <div className="text-[9px] text-green-500 font-medium">Positive</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-amber-700">{displaySentiment.neutral || 0}</div>
                  <div className="text-[9px] text-amber-500 font-medium">Moderate</div>
                </div>
                <div className="bg-red-50 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-red-700">{displaySentiment.negative || 0}</div>
                  <div className="text-[9px] text-red-500 font-medium">Negative</div>
                </div>
              </div>
            </Card>

            {/* Top Categories */}
            {displayCategories.length > 0 && (
              <Card className="p-3 border-0 shadow-md flex-1">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Top Topics</h4>
                <div className="flex flex-wrap gap-1.5">
                  {displayCategories.map(([cat, cnt]) => {
                    const style = getTopicStyle(cat);
                    return (
                      <span key={cat} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ${style}`}>
                        <Tag className="h-2.5 w-2.5" />
                        {formatTopicLabel(cat)} <span className="font-bold">({cnt})</span>
                      </span>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

        </div>

        {/* RIGHT PANEL: Map */}
        <div className="flex-1 min-w-0">
          <div className="relative bg-white rounded-2xl border shadow-sm overflow-hidden h-full">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${dims.w} ${dims.h}`}
              className="w-full h-full"
              style={{ maxHeight: '82vh' }}
            >
              {/* Constituency polygons — all districts colored by sentiment */}
              {geojson.features.map((f, i) => {
                const { DIST_NAME, AC_NAME } = f.properties;
                const isSelectedAC = urlParams.constituency &&
                  AC_NAME?.toLowerCase() === urlParams.constituency.toLowerCase();
                const hoverKey = isSelectedAC ? AC_NAME : DIST_NAME;
                const isHov = hoveredDistrict === hoverKey;
                const distStats = byDistrict[DIST_NAME];

                const colors = isSelectedAC ? SELECTED_AC_COLORS : getSentimentColors(distStats);
                return (
                  <path key={i} d={pathGenerator(f.geometry)}
                    fill={isHov ? colors.hover : colors.fill}
                    stroke={isHov ? '#0f172a' : isSelectedAC ? SELECTED_AC_COLORS.stroke : colors.stroke}
                    strokeWidth={isHov ? 2.5 : isSelectedAC ? 2 : 0.8}
                    opacity={hoveredDistrict && !isHov ? 0.65 : 1}
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={(e) => handleMouseMove(e, hoverKey)}
                    onMouseMove={(e) => handleMouseMove(e, hoverKey)}
                    onMouseLeave={scheduleHoverHide}
                    onClick={() => handleDistrictClick(hoverKey)} />
                );
              })}

              {/* District Labels */}
              {Object.entries(districtCentroids).map(([name, px]) => (
                <g key={name} className="pointer-events-none select-none">
                  <text
                    x={px[0]} y={px[1] - 2}
                    textAnchor="middle"
                    style={{
                      fontSize: '9px',
                      fontWeight: 500,
                      fill: '#475569',
                      stroke: 'white',
                      strokeWidth: 3, paintOrder: 'stroke',
                    }}
                  >{name}</text>
                </g>
              ))}
            </svg>

            {/* Summary strip */}
            <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm border border-green-200 rounded-lg px-3 py-2 text-[11px] text-gray-600 shadow-sm max-w-[240px]">
              {isMinisterView && urlParams.constituency ? (
                <>
                  <span className="font-bold text-blue-700">{urlParams.constituency} Constituency</span>
                  {urlParams.ministerName && (
                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">{urlParams.ministerName}</div>
                  )}
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="inline-block w-2 h-2 rounded-sm bg-blue-500" />
                    <span className="text-[10px] text-slate-500">Highlighted in blue · Hover to inspect</span>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-bold text-slate-700">Telangana State · All Districts</span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="inline-block w-2 h-2 rounded-sm bg-green-500" />
                    <span className="text-[10px] text-slate-500">Colored by sentiment · Hover to inspect</span>
                  </div>
                </>
              )}
            </div>

            {/* Selected AC label pin (for non-Mahabubnagar constituencies) */}
            {isMinisterView && urlParams.constituency && (() => {
              const px = allAcCentroids[urlParams.constituency];
              if (!px) return null;
              return (
                <div
                  className="absolute pointer-events-none z-20"
                  style={{ left: `${(px[0] / dims.w) * 100}%`, top: `${(px[1] / dims.h) * 100}%`, transform: 'translate(-50%, -100%)' }}
                >
                  <div
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold text-white shadow-lg border border-white/30"
                    style={{ background: selectedMinisterData?.color || SELECTED_AC_COLORS.fill }}
                  >
                    <MapPin className="h-2.5 w-2.5" />
                    {urlParams.constituency}
                  </div>
                  <div className="w-0 h-0 mx-auto" style={{ borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: `6px solid ${selectedMinisterData?.color || SELECTED_AC_COLORS.fill}` }} />
                </div>
              );
            })()}

            {/* Hover tooltip */}
            {hoveredDistrict && (
              <div
                className="absolute bg-white border border-gray-200 shadow-xl rounded-xl z-50 overflow-hidden"
                onMouseEnter={clearHoverHideTimer}
                onMouseLeave={scheduleHoverHide}
                style={{
                  left: getTooltipLeft(360),
                  top: getTooltipTop(260),
                  minWidth: 280, maxWidth: 360
                }}
              >
                {/* Header */}
                {(() => {
                  const distS = hovStats ? getSentimentColors(hovStats) : SENTIMENT_TIERS.none;
                  const hasGrievances = hovTotal > 0;
                  return (
                    <div className="px-3.5 py-2 flex items-center justify-between"
                      style={{ background: hasGrievances ? distS.fill : '#f1f5f9', color: hasGrievances ? '#fff' : '#374151' }}>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{hoveredDistrict}</span>
                        {hovTotal > 0 && (
                          <span className="text-[10px] font-medium opacity-80">
                            {hovTotal} grievance{hovTotal !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {hovTotal > 0 && (
                        <Badge className="bg-white/20 text-[10px] border-0" style={{ color: hasGrievances ? distS.fill : '#374151', background: 'rgba(255,255,255,0.25)' }}>
                          District
                        </Badge>
                      )}
                    </div>
                  );
                })()}

                <div className="p-3">
                  {!hovStats || hovTotal === 0 ? (
                    <div className="text-xs text-gray-400 italic py-1">No grievances detected in this area</div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-[10px] mb-1.5">
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{hovStats.negative} grievance{hovStats.negative !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />{hovStats.positive || 0}
                        </span>
                        <span className="inline-flex items-center gap-1 text-gray-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />{hovStats.neutral || 0}
                        </span>
                      </div>

                      {hovTotal > 0 && (
                        <div className="flex h-1.5 rounded-full overflow-hidden mb-2.5">
                          {hovStats.negative > 0 && <div className="bg-red-500" style={{ width: `${(hovStats.negative / hovTotal) * 100}%` }} />}
                          {hovStats.neutral > 0 && <div className="bg-gray-300" style={{ width: `${(hovStats.neutral / hovTotal) * 100}%` }} />}
                          {hovStats.positive > 0 && <div className="bg-green-500" style={{ width: `${(hovStats.positive / hovTotal) * 100}%` }} />}
                        </div>
                      )}

                      {topCats.length > 0 ? (
                        <div>
                          <div className="text-[9px] font-semibold text-red-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Grievance Topics
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {topCats.slice(0, 5).map(([cat, cnt]) => (
                              <span key={cat} className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ring-1 ${getTopicStyle(cat)}`}>
                                <Tag className="h-2.5 w-2.5" />
                                {formatTopicLabel(cat)} <span className="font-bold">({cnt})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-gray-500 italic mt-1">No grievance topics found</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Bottom legend */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-gray-500 justify-center">
            {isMinisterView && urlParams.constituency && (
              <span className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded" style={{ background: SELECTED_AC_COLORS.fill }} />
                <span className="font-semibold text-blue-600">{urlParams.constituency} (Selected)</span>
              </span>
            )}
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-gray-300" style={{ background: SENTIMENT_TIERS.none.fill }} /> No Data</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded" style={{ background: SENTIMENT_TIERS.low.fill }} /> Low Positive</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded" style={{ background: SENTIMENT_TIERS.medium.fill }} /> Medium Positive</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded" style={{ background: SENTIMENT_TIERS.high.fill }} /> High Positive</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Positive</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Negative</span>
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default TelanganaMap;
