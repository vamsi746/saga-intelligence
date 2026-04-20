import React, { useState, useEffect, lazy, Suspense, useRef, useMemo, useCallback } from 'react';
// ...existing imports...
import ReactPlayer from 'react-player';
import { Link, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import {
  Shield, AlertTriangle, Send,
  Users, ChevronDown, Loader2, Info, Clock, FileText, MessageSquare,
  ArrowRight, RefreshCw, Sparkles, X, Video, Pencil, Play, ExternalLink, Settings,
  BarChart3, Tag
} from 'lucide-react';
import { Card } from '../components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { useDashboard } from '../contexts/DashboardContext';

// Lazy load heavy components
const GlanceChat = lazy(() => import('../components/dashboard/GlanceChat'));
const ManagedRibbonWidget = lazy(() => import('../components/dashboard/ManagedRibbonWidget'));
const TodaysEventsWidget = lazy(() => import('../components/dashboard/TodaysEventsWidget'));
const Dial100FeedWidget = lazy(() => import('../components/dashboard/Dial100FeedWidget'));

import PunjabMap from './PunjabMap';

// Platform configurations
const PLATFORMS = [
  { id: 'all', label: 'All sources' },
  { id: 'twitter', label: 'X (Twitter)' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'whatsapp', label: 'WhatsApp' }
];

const LoadingSpinner = () => (
  <div className="flex items-center justify-center p-4">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);

// ─── Drone View Live Monitoring Strip ───────────────────────────────────────
const DRONE_API_KEY_STORAGE = 'blura_yt_api_key';
// Fallback levels: 0=ReactPlayer, 1=nocookie iframe, 2=standard embed, 3=thumbnail card
const FALLBACK_LABELS = ['Player (auto)', 'Embed (privacy)', 'Embed (standard)', 'Info card'];

const DroneViewStrip = () => {
  const [title, setTitle] = useState('Drone View');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('Drone View');
  const [linkInput, setLinkInput] = useState('');
  const [savedLink, setSavedLink] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');
  const [playerState, setPlayerState] = useState('idle'); // idle|loading|playing|error
  const [playerKey, setPlayerKey] = useState(0);
  const [fallbackLevel, setFallbackLevel] = useState(0); // 0-3

  // API key settings
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(() => localStorage.getItem(DRONE_API_KEY_STORAGE) || '');
  const [savedApiKey, setSavedApiKey] = useState(() => localStorage.getItem(DRONE_API_KEY_STORAGE) || '');
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Stream metadata from YouTube Data API
  const [streamMeta, setStreamMeta] = useState(null); // {title, thumbnail, viewers, isLive}
  const [metaLoading, setMetaLoading] = useState(false);

  const extractYouTubeId = (url) => {
    if (!url) return null;
    const patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /\/(?:live|embed)\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = url.match(p);
      if (m) return m[1];
    }
    return null;
  };

  const fetchStreamMeta = async (url, apiKey) => {
    const videoId = extractYouTubeId(url);
    if (!videoId || !apiKey) return null;
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails,statistics&id=${videoId}&key=${apiKey}`
      );
      const data = await res.json();
      if (data.error) return { error: data.error.message };
      const item = data.items?.[0];
      if (!item) return { error: 'Video not found — check the URL.' };
      const thumbs = item.snippet?.thumbnails;
      return {
        videoTitle: item.snippet?.title || '',
        thumbnail: thumbs?.maxres?.url || thumbs?.high?.url || thumbs?.medium?.url || thumbs?.default?.url || '',
        isLive: item.snippet?.liveBroadcastContent === 'live',
        isUpcoming: item.snippet?.liveBroadcastContent === 'upcoming',
        viewers: item.liveStreamingDetails?.concurrentViewers
          ? Number(item.liveStreamingDetails.concurrentViewers).toLocaleString()
          : null,
        channelTitle: item.snippet?.channelTitle || '',
      };
    } catch {
      return null; // silently ignore — still show player
    }
  };

  const handleSaveApiKey = () => {
    localStorage.setItem(DRONE_API_KEY_STORAGE, apiKeyInput.trim());
    setSavedApiKey(apiKeyInput.trim());
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  };

  const isValidUrl = (url) => {
    try { new URL(url); return true; } catch { return false; }
  };

  const handleOpenModal = async () => {
    const url = linkInput.trim();
    if (!url) { setError('Please paste a stream URL'); return; }
    if (!isValidUrl(url)) { setError('Invalid URL — paste a full link starting with https://'); return; }
    setError('');
    setStreamMeta(null);
    setPlayerState('loading');
    setFallbackLevel(0);
    setPlayerKey(k => k + 1);
    setSavedLink(url);
    setShowModal(true);
    if (savedApiKey) {
      setMetaLoading(true);
      const meta = await fetchStreamMeta(url, savedApiKey);
      setStreamMeta(meta);
      setMetaLoading(false);
    }
  };

  const handleCloseModal = () => {
    setPlayerState('idle');
    setTimeout(() => { setShowModal(false); setStreamMeta(null); }, 50);
  };

  const handleTitleSave = () => {
    setTitle(titleInput.trim() || 'Drone View');
    setIsEditingTitle(false);
  };

  const handlePlayerReady = () => setPlayerState('playing');

  const handlePlayerError = () => {
    setFallbackLevel(prev => {
      const next = prev + 1;
      if (next >= 3) { setPlayerState('error'); }
      else { setPlayerKey(k => k + 1); setPlayerState('loading'); }
      return next;
    });
  };

  const videoId = extractYouTubeId(savedLink);
  const nocookieUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1` : '';
  const standardEmbedUrl = videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1` : '';

  return (
    <>
      {/* Strip */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl border border-sky-500/30 bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-transparent shadow-sm">
        {/* Pulsing dot */}
        <div className="relative flex-shrink-0">
          <div className="h-2 w-2 rounded-full bg-sky-500" />
          <div className="absolute inset-0 h-2 w-2 rounded-full bg-sky-500 animate-ping opacity-75" />
        </div>

        <Video className="h-4 w-4 text-sky-500 flex-shrink-0" />

        {/* Editable title */}
        {isEditingTitle ? (
          <input
            value={titleInput}
            autoFocus
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSave();
              if (e.key === 'Escape') { setTitleInput(title); setIsEditingTitle(false); }
            }}
            className="text-sm font-semibold bg-transparent border-b border-sky-500/60 focus:outline-none focus:border-sky-500 w-32 text-sky-700 dark:text-sky-300"
          />
        ) : (
          <button onClick={() => { setTitleInput(title); setIsEditingTitle(true); }} className="flex items-center gap-1.5 group">
            <span className="text-sm font-semibold text-sky-700 dark:text-sky-300">{title}</span>
            <Pencil className="h-3 w-3 text-sky-400/50 group-hover:text-sky-500 transition-colors" />
          </button>
        )}

        <div className="h-4 w-px bg-border flex-shrink-0" />

        {/* URL input */}
        <div className="flex flex-1 min-w-0 items-center gap-2">
          <input
            value={linkInput}
            onChange={(e) => { setLinkInput(e.target.value); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleOpenModal()}
            placeholder="Paste live stream URL — YouTube, HLS (.m3u8), direct video..."
            className="flex-1 min-w-0 text-xs bg-background/60 border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-sky-500/40 focus:border-sky-500/50 placeholder:text-muted-foreground/50"
          />
          {error && <span className="text-[10px] text-rose-500 whitespace-nowrap hidden sm:inline">{error}</span>}
        </div>

        {/* Watch Live button */}
        <button
          onClick={handleOpenModal}
          disabled={!linkInput.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-sm"
        >
          <Play className="h-3 w-3 fill-current" />
          Watch Live
        </button>

        {/* Settings gear */}
        <button
          onClick={() => setShowSettings(s => !s)}
          className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${showSettings ? 'bg-sky-500/20 text-sky-600' : 'text-muted-foreground hover:text-sky-600 hover:bg-sky-500/10'
            }`}
          title="YouTube API Key settings"
        >
          <Settings className="h-4 w-4" />
        </button>

        {error && <span className="text-[10px] text-rose-500 sm:hidden w-full text-center">{error}</span>}

        {/* API Key settings panel */}
        {showSettings && (
          <div className="w-full flex items-center gap-2 pt-1 pb-0.5 border-t border-sky-500/20 mt-0.5">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">YouTube Data API v3 Key:</span>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              placeholder="Paste your Google Console API key..."
              className="flex-1 text-xs bg-background/60 border border-border rounded-lg px-3 py-1 focus:outline-none focus:ring-1 focus:ring-sky-500/40 focus:border-sky-500/50 placeholder:text-muted-foreground/40"
            />
            <button
              onClick={handleSaveApiKey}
              className="text-xs px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-colors whitespace-nowrap"
            >
              {apiKeySaved ? '✓ Saved' : 'Save Key'}
            </button>
            {savedApiKey && (
              <span className="text-[10px] text-emerald-600 whitespace-nowrap">✓ API key active</span>
            )}
          </div>
        )}
      </div>

      {/* Live Viewer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={handleCloseModal}>
          <div className="relative w-full max-w-4xl bg-card rounded-2xl shadow-2xl overflow-hidden border border-border/60" onClick={(e) => e.stopPropagation()}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-sky-500/15 to-transparent border-b border-border">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Thumbnail */}
                {streamMeta?.thumbnail && (
                  <img src={streamMeta.thumbnail} alt="" className="h-10 w-16 rounded object-cover flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {streamMeta?.isLive && (
                      <span className="flex items-center gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-red-500">Live</span>
                      </span>
                    )}
                    {streamMeta?.isUpcoming && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Upcoming</span>
                    )}
                    {streamMeta?.viewers && (
                      <span className="text-[10px] text-white/60">{streamMeta.viewers} watching</span>
                    )}
                    {playerState === 'loading' && !streamMeta && (
                      <Loader2 className="h-3.5 w-3.5 text-sky-400 animate-spin" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {metaLoading
                      ? title
                      : (streamMeta?.videoTitle || title)}
                  </p>
                  {streamMeta?.channelTitle && (
                    <p className="text-[10px] text-muted-foreground truncate">{streamMeta.channelTitle}</p>
                  )}
                </div>
              </div>
              <button onClick={handleCloseModal} className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0 ml-2">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* API error notice (e.g. bad key) */}
            {streamMeta?.error && (
              <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-[10px] text-amber-600">
                API: {streamMeta.error}
              </div>
            )}

            {/* Player — 16:9 */}
            <div className="relative w-full bg-black" style={{ paddingBottom: '56.25%' }}>
              <div className="absolute inset-0">

                {/* ── Level 0: ReactPlayer (uses nocookie URL for YouTube — recommended) ── */}
                {fallbackLevel === 0 && playerState !== 'error' && (
                  <ReactPlayer key={`rp-${playerKey}`}
                    url={nocookieUrl || savedLink}
                    playing={playerState === 'loading' || playerState === 'playing'}
                    controls width="100%" height="100%"
                    onReady={handlePlayerReady}
                    onError={handlePlayerError}
                    config={{
                      youtube: { playerVars: { autoplay: 1, rel: 0, modestbranding: 1, origin: window.location.origin } },
                      file: { forceHLS: savedLink.includes('.m3u8'), attributes: { autoPlay: true, controls: true } },
                    }}
                  />
                )}

                {/* ── Level 1: youtube-nocookie iframe ── */}
                {fallbackLevel === 1 && playerState !== 'error' && nocookieUrl && (
                  <iframe key={`nc-${playerKey}`}
                    src={nocookieUrl} title={title}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => setPlayerState('playing')}
                    onError={handlePlayerError}
                  />
                )}

                {/* ── Level 2: standard YouTube embed iframe ── */}
                {fallbackLevel === 2 && playerState !== 'error' && standardEmbedUrl && (
                  <iframe key={`yt-${playerKey}`}
                    src={standardEmbedUrl} title={title}
                    className="absolute inset-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    onLoad={() => setPlayerState('playing')}
                    onError={handlePlayerError}
                  />
                )}

                {/* ── Level 3 / final error: info card ── */}
                {(fallbackLevel >= 3 || playerState === 'error') && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-black to-slate-900 gap-4 px-8 text-center">
                    {streamMeta?.thumbnail ? (
                      <div className="relative w-full max-w-sm">
                        <img src={streamMeta.thumbnail} alt="" className="w-full rounded-lg opacity-40" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="p-4 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
                            <Video className="h-10 w-10 text-white/60" />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 rounded-full bg-slate-800 border border-white/10">
                        <Video className="h-12 w-12 text-white/30" />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <p className="text-base font-bold text-white">{streamMeta?.videoTitle || title}</p>
                      {streamMeta?.channelTitle && <p className="text-xs text-white/50">{streamMeta.channelTitle}</p>}
                      {streamMeta?.isLive && streamMeta?.viewers && (
                        <p className="text-xs text-red-400 font-medium">🔴 Live · {streamMeta.viewers} watching</p>
                      )}
                      <p className="text-[11px] text-white/30 mt-2 leading-relaxed">
                        Stream could not be embedded in-app.<br />
                        All 3 playback methods were attempted.
                      </p>
                    </div>
                    <button onClick={() => { setFallbackLevel(0); setPlayerState('loading'); setPlayerKey(k => k + 1); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <Play className="h-3 w-3 fill-current" /> Retry All
                    </button>
                  </div>
                )}

                {/* Loading overlay (levels 0–2) */}
                {playerState === 'loading' && fallbackLevel < 3 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 pointer-events-none gap-3">
                    <Loader2 className="h-10 w-10 text-sky-400 animate-spin" />
                    <span className="text-xs text-white/50">Trying method {fallbackLevel + 1} of 3…</span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-2.5 bg-muted/30 border-t border-border flex items-center gap-3">
              <p className="text-[11px] text-muted-foreground truncate flex-1">{savedLink}</p>
              {fallbackLevel < 3 && playerState !== 'error' && (
                <div className="hidden sm:flex gap-1">
                  {[0, 1, 2].map(i => (
                    <button key={i}
                      onClick={() => { setFallbackLevel(i); setPlayerState('loading'); setPlayerKey(k => k + 1); }}
                      className={`text-[9px] px-1.5 py-0.5 rounded font-medium transition-colors ${fallbackLevel === i ? 'bg-sky-600 text-white' : 'bg-muted text-muted-foreground hover:bg-sky-500/10'}`}
                    >{['Auto', 'NoCookie', 'Embed'][i]}</button>
                  ))}
                </div>
              )}
              <button onClick={handleCloseModal} className="text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex-shrink-0">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Dashboard = () => {
  const { dashboardData, loading, fetchDashboardData, refreshDashboard, hasCachedData } = useDashboard();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGlanceOpen, setIsGlanceOpen] = useState(false);

  const [alertType, setAlertType] = useState('active');
  const [alertPlatform, setAlertPlatform] = useState('all');
  const [reportPlatform, setReportPlatform] = useState('all');
  const [reportStatus, setReportStatus] = useState('all');
  const [grievancePlatform, setGrievancePlatform] = useState('all');
  const [grievanceStatus, setGrievanceStatus] = useState('all');

  // Extract data from context
  const alertData = dashboardData?.alertData || {};
  const reportData = dashboardData?.reportData || {};
  const grievanceData = dashboardData?.grievanceData || {};
  const alertPendingReportData = dashboardData?.alertPendingReportData || {};
  const sentimentAnalytics = dashboardData?.sentimentAnalytics || null;
  const categoryAnalytics = dashboardData?.categoryAnalytics || null;

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(() => {
      refreshDashboard();
    }, 15000);
    return () => clearInterval(timer);
  }, [fetchDashboardData, refreshDashboard]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshDashboard();
    setIsRefreshing(false);
  };

  if (loading && !hasCachedData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-violet-500/20 border-t-violet-600"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Shield className="h-5 w-5 text-violet-600 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const ALERT_TYPES = [
    { id: 'active', label: 'Active Alerts' },
    { id: 'acknowledged', label: 'Acknowledged Alerts' },
    { id: 'false_positive', label: 'False Positive Alerts' },
    { id: 'escalated', label: 'Escalated Alerts' },
  ];

  const getAlertCount = () => {
    const typeData = alertData?.[alertType] || alertData?.active || {};
    return typeData[alertPlatform] ?? typeData.all ?? 0;
  };

  const getEscalatedPendingCount = () => alertPendingReportData?.[alertPlatform] ?? alertPendingReportData?.all ?? 0;
  const getEscalatedGeneratedCount = () => {
    const total = alertData?.escalated?.[alertPlatform] ?? alertData?.escalated?.all ?? 0;
    return Math.max(0, total - getEscalatedPendingCount());
  };

  const getGrievanceCount = () => {
    const data = grievanceData?.[grievancePlatform] || grievanceData?.all || {};
    if (grievanceStatus === 'pending') return data.pending ?? 0;
    if (grievanceStatus === 'resolved') return data.resolved ?? 0;
    return data.total ?? 0;
  };

  const getReportCount = () => {
    const data = reportData?.[reportPlatform] || reportData?.all || {};
    if (reportStatus === 'sent_to_intermediary') return data.sent_to_intermediary || 0;
    if (reportStatus === 'closed') return data.closed || 0;
    return data.total || 0;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300" data-testid="dashboard">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing || loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Grievance Sentiment Analytics */}
      {sentimentAnalytics && (() => {
        const dist = sentimentAnalytics.distribution || {};
        const total = (dist.positive || 0) + (dist.neutral || 0) + (dist.negative || 0);
        const profiles = sentimentAnalytics.topNegative || [];
        const maxCount = profiles.length > 0 ? profiles[0].count : 1;
        if (total === 0 && profiles.length === 0) return null;

        const pieData = [
          { name: 'Positive', value: dist.positive || 0, color: '#10b981' },
          { name: 'Moderate', value: dist.neutral || 0, color: '#f59e0b' },
          { name: 'Negative', value: dist.negative || 0, color: '#ef4444' }
        ].filter(d => d.value > 0);

        const sentimentRows = [
          { key: 'positive', label: 'Positive', value: dist.positive || 0, color: '#10b981', barBg: 'bg-emerald-500', trackBg: 'bg-emerald-100', sentiment: 'positive' },
          { key: 'medium', label: 'Moderate', value: dist.neutral || 0, color: '#f59e0b', barBg: 'bg-amber-400', trackBg: 'bg-amber-100', sentiment: 'neutral' },
          { key: 'negative', label: 'Negative', value: dist.negative || 0, color: '#ef4444', barBg: 'bg-red-500', trackBg: 'bg-red-100', sentiment: 'negative' }
        ];

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ── Tile 1: Sentiment Distribution ── */}
            <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-violet-100 rounded-lg">
                    <Shield className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                  <h3 className="text-[13px] font-semibold text-foreground">Sentiment Analysis</h3>
                </div>
                <Link to="/grievances" className="text-[11px] text-violet-600 hover:text-violet-700 font-medium flex items-center gap-0.5 transition-colors">
                  View All <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="p-5 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
                {/* Donut — large */}
                <div className="relative shrink-0 w-[180px] h-[180px] sm:w-[220px] sm:h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" paddingAngle={3} strokeWidth={0}>
                        {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <RechartsTooltip
                        formatter={(value, name) => [`${value} (${total ? Math.round(value / total * 100) : 0}%)`, name]}
                        contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '6px 10px' }}
                        wrapperStyle={{ zIndex: 1000 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                    <p className="text-2xl sm:text-3xl font-bold text-foreground leading-none">{total}</p>
                    <p className="text-[8px] sm:text-[9px] text-muted-foreground uppercase tracking-widest mt-1">Analyzed</p>
                  </div>
                </div>
                {/* Breakdown */}
                <div className="w-full sm:flex-1 space-y-3 sm:space-y-4">
                  {sentimentRows.map(row => {
                    const pct = total ? Math.round(row.value / total * 100) : 0;
                    return (
                      <Link key={row.key} to={`/grievances?sentiment=${row.sentiment}`} className="block group">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                            <span className="text-[12px] font-medium text-foreground">{row.label}</span>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-sm font-bold tabular-nums" style={{ color: row.color }}>{row.value}</span>
                            <span className="text-[10px] text-muted-foreground font-medium">({pct}%)</span>
                          </div>
                        </div>
                        <div className={`h-1.5 sm:h-2 rounded-full overflow-hidden ${row.trackBg} group-hover:opacity-80 transition-opacity`}>
                          <div className={`h-full rounded-full transition-all duration-700 ease-out ${row.barBg}`} style={{ width: `${pct}%` }} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Sangrur Constituency — In-depth AC Map */}
            <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all overflow-hidden lg:col-span-1">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/30">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-100 rounded-lg">
                    <BarChart3 className="h-3.5 w-3.5 text-green-600" />
                  </div>
                  <h3 className="text-[13px] font-semibold text-foreground">Sangrur Constituency</h3>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">CM Bhagwant Mann · 7 ACs</span>
              </div>
              <div className="flex items-center justify-center bg-white dark:bg-slate-950/20">
                <div className="w-full h-[480px]">
                  <PunjabMap embedded />
                </div>
              </div>
            </Card>
          </div>
        );
      })()}

      {/* Combined Analytics & Alerts Grid */}
      <TooltipProvider>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[280px] overflow-hidden">
          
          {/* Col 1-2: Grievance Analytics (Pie) */}
          <div className={`${categoryAnalytics ? 'lg:col-span-2' : 'hidden'} h-[280px] overflow-hidden`}>
            {categoryAnalytics && (() => {
              const rawTopics = categoryAnalytics.topics || [];
              const canonicalizeTopicName = (name) => {
                const original = String(name || '').trim();
                if (!original) return '';
                const normalized = original
                  .replace(/[_-]+/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .toLowerCase();

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

              const mergedTopicMap = rawTopics.reduce((acc, topic) => {
                const normalizedName = canonicalizeTopicName(topic?.name);
                const count = Number(topic?.count) || 0;
                if (!normalizedName || count <= 0) return acc;
                acc[normalizedName] = (acc[normalizedName] || 0) + count;
                return acc;
              }, {});
              const topics = Object.entries(mergedTopicMap)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count);
              const total = topics.reduce((s, t) => s + t.count, 0);

              if (topics.length === 0) return null;

              const TOPIC_COLORS = {
                'Political Criticism': '#8b5cf6', 'Hate Speech': '#ef4444', 'Public Complaint': '#3b82f6',
                'Corruption Complaint': '#f97316', 'General Complaint': '#10b981', 'Traffic Complaint': '#f59e0b',
                'Public Nuisance': '#f43f5e', 'Road & Infrastructure': '#eab308', 'Law & Order': '#6366f1'
              };

              const pieData = topics.map(t => ({
                name: t.name, value: t.count, color: TOPIC_COLORS[t.name] || '#6b7280'
              }));

              return (
                <Card className="border border-border/50 shadow-sm hover:shadow-md transition-all overflow-hidden h-full flex flex-col">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-violet-100 rounded-lg">
                        <BarChart3 className="h-3.5 w-3.5 text-violet-600" />
                      </div>
                      <h3 className="text-[13px] font-semibold text-foreground">Grievance Analytics</h3>
                      <span className="text-[10px] text-muted-foreground ml-1">({total} total)</span>
                    </div>
                    <Link to="/grievances" className="text-[11px] text-violet-600 hover:text-violet-700 font-medium flex items-center gap-0.5 transition-colors">
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="p-2 flex flex-row items-center gap-2 flex-1 min-h-0">
                    {/* Left Half: Big Pie Chart */}
                    <div className="relative w-1/2 h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius="50%" outerRadius="80%" paddingAngle={2} strokeWidth={0}>
                            {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value, name) => [`${value} (${total ? Math.round(value / total * 100) : 0}%)`, name]}
                            contentStyle={{ fontSize: '11px', borderRadius: '8px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', padding: '6px 10px' }}
                            wrapperStyle={{ zIndex: 1000 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <p className="text-2xl font-bold text-foreground leading-none">{total}</p>
                        <p className="text-[8px] text-muted-foreground uppercase tracking-widest mt-1">Grievances</p>
                      </div>
                    </div>

                    {/* Right Half: Category list */}
                    <div className="w-1/2 space-y-1 h-full overflow-y-auto pl-1 pr-1 custom-scrollbar">
                      {topics.map((topic) => {
                        const pct = total ? Math.round(topic.count / total * 100) : 0;
                        const color = TOPIC_COLORS[topic.name] || '#6b7280';
                        return (
                          <Link
                            key={topic.name}
                            to={`/grievances?grievance_type=${encodeURIComponent(topic.name)}`}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-violet-50 dark:hover:bg-violet-500/5 transition-colors group cursor-pointer"
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="text-[11px] font-medium text-foreground flex-1 truncate group-hover:text-violet-700 transition-colors">
                              {topic.name}
                            </span>
                            <span className="text-[10px] font-bold tabular-nums text-right" style={{ color }}>{pct}%</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </Card>
              );
            })()}
          </div>

          {/* Col 3: Alerts Card */}
          <div className={`${categoryAnalytics ? 'lg:col-span-1' : 'lg:col-span-3'} h-[280px] overflow-hidden`}>
            <Card className="bg-gradient-to-br from-card via-card to-rose-500/5 border border-border/50 shadow-sm hover:shadow-lg transition-all overflow-hidden h-full flex flex-col">
              <div className="p-4 border-b border-border/50 bg-gradient-to-r from-rose-500/10 to-transparent shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-500/10 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    </div>
                    <Link to={`/alerts?status=${alertType}`} className="text-xs font-semibold hover:underline">
                      Alerts
                    </Link>
                  </div>
                  <div className="relative">
                    <select
                      value={alertType}
                      onChange={(e) => setAlertType(e.target.value)}
                      className="appearance-none bg-transparent text-[11px] font-medium text-muted-foreground cursor-pointer focus:outline-none text-right pr-4"
                    >
                      {ALERT_TYPES.map((type) => (
                        <option key={type.id} value={type.id}>{type.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div className="flex items-end justify-between">
                     <div>
                       <p className="text-4xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent leading-none">{getAlertCount()}</p>
                       <p className="text-[10px] text-muted-foreground mt-1">Total {alertType.replace('_', ' ')}</p>
                     </div>
                     {alertType === 'escalated' && (
                        <div className="text-[10px] text-right text-muted-foreground">
                            <p>Gen: {getEscalatedGeneratedCount()}</p>
                            <p>Pend: {getEscalatedPendingCount()}</p>
                        </div>
                     )}
                </div>
              </div>

              <div className="p-2 border-b border-border/50 shrink-0">
                <div className="flex items-center gap-2">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Platform</p>
                  <div className="relative flex-1">
                    <select
                      value={alertPlatform}
                      onChange={(e) => setAlertPlatform(e.target.value)}
                      className="appearance-none bg-transparent text-xs font-medium text-foreground cursor-pointer focus:outline-none w-full pr-5"
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="p-2 flex gap-2 flex-1 items-stretch min-h-0">
                {ALERT_TYPES.filter(t => t.id !== alertType).slice(0, 3).map((type) => (
                  <button
                    key={type.id}
                    onClick={() => setAlertType(type.id)}
                    className="flex-1 flex flex-col items-center justify-center text-center py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors hover:bg-rose-500/5 rounded border border-transparent hover:border-rose-100"
                  >
                    <span className="block text-sm font-bold text-foreground">{alertData[type.id]?.all || 0}</span>
                    <span className="scale-90 opacity-80 leading-tight">{type.label.replace(' Alerts', '').replace(' Posts', '')}</span>
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </TooltipProvider>

      {/* Events & Dial-100 Rectangle Strip */}
      <Suspense fallback={<LoadingSpinner />}>
        <div className="flex gap-3 items-stretch mt-2" style={{ height: '180px' }}>
          {/* Events - Periscope */}
          <div className="flex-1 min-w-0 h-[180px] overflow-hidden">
             <TodaysEventsWidget className="!h-full w-full" />
          </div>

          {/* Dial-100 */}
          <div className="flex-1 min-w-0 h-[180px] overflow-hidden">
            <Dial100FeedWidget className="!h-full w-full" />
          </div>

          {/* Glance AI - compact strip button */}
          <button
             onClick={() => setIsGlanceOpen(true)}
             className="w-[120px] shrink-0 h-[180px] bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-xl border border-indigo-100 shadow-sm hover:shadow-indigo-200/50 hover:scale-[1.02] hover:border-indigo-300 transition-all group flex flex-col items-center justify-center p-3 text-center relative overflow-hidden"
          >
             <div className="absolute -top-4 -right-4 w-10 h-10 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-colors"></div>
             <div className="mb-1.5 p-1.5 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg shadow-md shadow-indigo-200 group-hover:rotate-12 transition-transform">
                <Sparkles className="h-4 w-4 text-white" />
             </div>
             <p className="text-[7px] font-bold text-indigo-600 uppercase tracking-widest leading-none">AI Insight</p>
             <h3 className="text-[10px] font-black text-slate-900 leading-tight uppercase tracking-tight mt-0.5">Glance</h3>
             <div className="mt-1 flex items-center gap-0.5 text-[8px] text-slate-500 font-medium group-hover:text-indigo-600 transition-colors">
                <span>Open</span>
                <ArrowRight className="h-2 w-2 group-hover:translate-x-0.5 transition-transform" />
             </div>
          </button>
        </div>
      </Suspense>

      {/* Glance Intelligence Centered Modal */}
      {
        isGlanceOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div
              className="w-full max-w-4xl h-[560px] bg-card border border-border/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-white/20 rounded-xl backdrop-blur-md">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight">Glance Intelligence</h3>
                    <p className="text-[10px] text-white/70 uppercase tracking-widest font-medium">Real-time Analysis Hub</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGlanceOpen(false)}
                  className="hover:bg-white/20 p-2 rounded-full transition-all hover:rotate-90"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <Suspense fallback={<LoadingSpinner />}>
                  <GlanceChat />
                </Suspense>
              </div>
            </div>
            {/* Click outside to close */}
            <div className="absolute inset-0 -z-10" onClick={() => setIsGlanceOpen(false)}></div>
          </div>
        )
      }


    </div >
  );
};

export default Dashboard;
