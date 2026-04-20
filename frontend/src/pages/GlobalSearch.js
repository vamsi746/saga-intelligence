import React, { useState, useMemo, useCallback, useRef } from 'react';
import api from '../lib/api';
import axios from 'axios';
import {
    Search, User, Users, Twitter, Youtube, Monitor, ExternalLink,
    Loader2, AlertCircle, Download, Facebook, Instagram,
    Globe, Heart, MessageCircle, Eye, Repeat2, ArrowUpRight, TrendingUp,
    Hash, ChevronDown, X, RefreshCw, Share2, StopCircle
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import AddSourceModal from '../components/AddSourceModal';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// Reddit SVG icon (official Snoo shape)
const RedditIcon = ({ size = 24, className = '', ...props }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor" {...props}>
        <path d="M14.238 15.348c.085.084.085.221 0 .306-.465.462-1.194.687-2.231.687l-.008-.002-.008.002c-1.036 0-1.766-.225-2.231-.688-.085-.084-.085-.221 0-.305.084-.084.222-.084.307 0 .379.377 1.008.561 1.924.561l.008.002.008-.002c.915 0 1.544-.184 1.924-.561.085-.084.223-.084.307 0zm-3.44-2.418c0-.507-.414-.919-.922-.919-.509 0-.922.412-.922.919 0 .506.414.918.922.918.508 0 .922-.412.922-.918zm4.04-.919c-.509 0-.922.412-.922.919 0 .506.414.918.922.918.508 0 .922-.412.922-.918 0-.507-.414-.919-.922-.919zM12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.8 11.333c.02.14.03.283.03.428 0 2.19-2.547 3.964-5.69 3.964-3.142 0-5.69-1.774-5.69-3.964 0-.145.01-.288.03-.428A1.473 1.473 0 0 1 5.5 12c0-.378.145-.722.382-.982-.02-.12-.035-.244-.035-.372 0-.946.476-1.818 1.268-2.464C7.96 7.428 9.862 6.9 12 6.9c2.137 0 4.04.528 4.886 1.282.79.646 1.266 1.518 1.266 2.464 0 .128-.015.252-.035.372.237.26.383.604.383.982 0 .556-.312 1.04-.77 1.29l.07.043z"/>
    </svg>
);

/* ── 3D Globe Animation (CSS-only) ────────────────────────────── */
const SearchGlobe = () => (
    <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-500/20 animate-pulse" />
        <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-400/10 to-transparent" />

        {/* Globe sphere */}
        <div className="relative w-24 h-24 rounded-full overflow-hidden" style={{
            background: 'radial-gradient(circle at 35% 35%, #60a5fa, #3b82f6 40%, #1d4ed8 75%, #1e3a5f)',
            boxShadow: '0 0 40px rgba(59,130,246,0.3), inset -8px -8px 20px rgba(0,0,0,0.3), inset 4px 4px 10px rgba(255,255,255,0.15)'
        }}>
            {/* Spinning grid lines - longitude */}
            <div className="absolute inset-0 rounded-full" style={{ animation: 'globeSpin 3s linear infinite' }}>
                {[0, 30, 60, 90, 120, 150].map(deg => (
                    <div key={deg} className="absolute inset-0 rounded-full border border-white/20"
                        style={{ transform: `rotateY(${deg}deg)`, borderRadius: '50%' }} />
                ))}
            </div>
            {/* Latitude lines */}
            {[20, 40, 60, 80].map(pct => (
                <div key={pct} className="absolute left-0 right-0 border-t border-white/15"
                    style={{ top: `${pct}%` }} />
            ))}
            {/* Orbiting dots */}
            <div className="absolute inset-0" style={{ animation: 'globeSpin 2.5s linear infinite' }}>
                <div className="absolute w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" style={{ top: '30%', left: '55%' }} />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50" style={{ top: '55%', left: '35%' }} />
                <div className="absolute w-1.5 h-1.5 rounded-full bg-rose-400 shadow-lg shadow-rose-400/50" style={{ top: '42%', left: '72%' }} />
            </div>
            {/* Specular highlight */}
            <div className="absolute top-2 left-3 w-8 h-8 rounded-full bg-white/15 blur-md" />
        </div>

        {/* CSS keyframes injected via style tag */}
        <style>{`
            @keyframes globeSpin {
                from { transform: rotateY(0deg); }
                to { transform: rotateY(360deg); }
            }
        `}</style>
    </div>
);

// Platform configuration
const PLATFORMS = {
    all: { label: 'All Platforms', icon: Globe, color: 'from-slate-600 to-slate-800', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
    x: { label: 'X (Twitter)', icon: Twitter, color: 'from-gray-900 to-black', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-900 dark:text-gray-100', border: 'border-gray-300' },
    youtube: { label: 'YouTube', icon: Youtube, color: 'from-red-500 to-red-700', bg: 'bg-red-50 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-200' },
    reddit: { label: 'Reddit', icon: RedditIcon, color: 'from-orange-500 to-orange-700', bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200' },
    facebook: { label: 'Facebook', icon: Facebook, color: 'from-blue-500 to-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200' },
    instagram: { label: 'Instagram', icon: Instagram, color: 'from-purple-500 via-pink-500 to-orange-400', bg: 'bg-pink-50 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200' },
};

const GlobalSearch = () => {
    const [platform, setPlatform] = useState('all');
    const [searchType, setSearchType] = useState('profiles');
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [resultFilter, setResultFilter] = useState('all');
    const [searched, setSearched] = useState(false);
    const [platformErrors, setPlatformErrors] = useState({});
    const [completedPlatforms, setCompletedPlatforms] = useState(new Set());

    // Abort controller ref
    const abortRef = useRef(null);

    // Add Source modal state
    const [sourceModalOpen, setSourceModalOpen] = useState(false);
    const [initialSourceData, setInitialSourceData] = useState(null);

    const clearAll = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
        setLoading(false);
        setQuery('');
        setResults([]);
        setSearched(false);
        setPlatformErrors({});
        setCompletedPlatforms(new Set());
        setResultFilter('all');
    }, []);

    const handleSearch = useCallback(async (e) => {
        e?.preventDefault();
        if (!query.trim()) return;

        // Abort any previous search
        if (abortRef.current) abortRef.current.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setResults([]);
        setSearched(true);
        setPlatformErrors({});
        setCompletedPlatforms(new Set());

        try {
            const endpoint = searchType === 'profiles' ? '/search/profiles' : '/search/content';
            const timeout = 45000;

            if (platform === 'all') {
                const platformKeys = ['x', 'youtube', 'reddit', 'facebook', 'instagram'];

                // Create an abort-aware wrapper that rejects immediately on abort
                const abortPromise = new Promise((_, reject) => {
                    controller.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
                });

                const fetchAll = Promise.allSettled(
                    platformKeys.map(p =>
                        api.get(endpoint, { params: { platform: p, query }, timeout, signal: controller.signal })
                    )
                );

                const settled = await Promise.race([fetchAll, abortPromise]);

                const combined = [];
                const errors = {};
                // Process in fixed order: x, youtube, reddit, facebook, instagram
                settled.forEach((result, idx) => {
                    const p = platformKeys[idx];
                    if (result.status === 'fulfilled') {
                        const data = Array.isArray(result.value.data) ? result.value.data : [];
                        combined.push(...data.map(item => ({ ...item, _platform: item._platform || item.platform || p })));
                    } else {
                        if (axios.isCancel(result.reason) || result.reason?.name === 'AbortError' || result.reason?.code === 'ERR_CANCELED') return;
                        const errMsg = result.reason?.response?.data?.error || result.reason?.message || 'Failed';
                        errors[p] = errMsg.includes('timeout') ? 'Timed out' : errMsg;
                    }
                });
                setPlatformErrors(errors);
                setResults(combined);
            } else {
                const response = await api.get(endpoint, {
                    params: { platform, query },
                    timeout,
                    signal: controller.signal
                });
                const data = Array.isArray(response.data) ? response.data : [];
                setResults(data.map(item => ({ ...item, _platform: item._platform || item.platform || platform })));
            }
        } catch (error) {
            if (axios.isCancel(error) || error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
                toast.info('Search cancelled');
                return;
            }
            console.error('Search error:', error);
            const msg = error?.code === 'ECONNABORTED' ? 'Search timed out. Try a specific platform.' : (error?.response?.data?.error || 'Search failed. Please try again.');
            toast.error(msg);
        } finally {
            if (!controller.signal.aborted) {
                setLoading(false);
            }
        }
    }, [query, platform, searchType]);

    const openMonitorDialog = useCallback((source) => {
        const sourcePlatform = source._platform || platform;
        const handle = source.screen_name || source.username || source.id || '';
        const displayName = source.name || source.title || '';
        const followers = source.followers_count || source.subscriber_count || '';

        setInitialSourceData({
            platform: sourcePlatform,
            identifier: handle,
            display_name: displayName,
            category: 'others',
            priority: 'medium',
            is_active: true,
            poiData: {
                realName: displayName,
                socialMedia: [{
                    platform: sourcePlatform,
                    handle: handle,
                    displayName: displayName,
                    category: 'others',
                    priority: 'medium',
                    isActive: true,
                    followerCount: followers ? String(followers) : '',
                    createdDate: ''
                }]
            }
        });
        setSourceModalOpen(true);
    }, [platform]);

    // Filtered results
    const filteredResults = useMemo(() => {
        if (resultFilter === 'all') return results;
        return results.filter(item => item._platform === resultFilter);
    }, [results, resultFilter]);

    // Platform stats
    const platformCounts = useMemo(() => {
        const counts = {};
        results.forEach(r => {
            const p = r._platform || 'unknown';
            counts[p] = (counts[p] || 0) + 1;
        });
        return counts;
    }, [results]);

    const formatIST = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return '';
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: diffDays > 365 ? 'numeric' : undefined });
    };

    const formatISTFull = (dateStr) => {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    };

    const formatNumber = (num) => {
        const n = Number(num) || 0;
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return n.toLocaleString();
    };

    const getProfileUrl = (item) => {
        const p = item._platform;
        if (p === 'x') return `https://x.com/${item.screen_name}`;
        if (p === 'youtube') return item.customUrl || `https://youtube.com/channel/${item.id}`;
        if (p === 'reddit') return `https://www.reddit.com/user/${item.screen_name}`;
        if (p === 'facebook') return item.url || `https://facebook.com/${item.id}`;
        if (p === 'instagram') return `https://instagram.com/${item.screen_name}`;
        return '#';
    };

    const getContentUrl = (item) => {
        if (item.url) return item.url;
        const p = item._platform;
        if (p === 'x') return `https://x.com/i/status/${item.id}`;
        if (p === 'youtube') return `https://youtube.com/watch?v=${item.id?.videoId || item.id}`;
        if (p === 'facebook') return `https://facebook.com/${item.id}`;
        if (p === 'instagram') return `https://instagram.com/p/${item.id}`;
        if (p === 'reddit') return item.url || `https://reddit.com`;
        return '#';
    };

    const getHandle = (item) => {
        const p = item._platform;
        if (p === 'x' || p === 'instagram') return `@${item.screen_name || ''}`;
        if (p === 'reddit') return `u/${item.screen_name || ''}`;
        if (p === 'facebook') return item.screen_name || item.id || '';
        if (p === 'youtube') return item.customUrl || '';
        return item.screen_name || '';
    };

    const getFollowerLabel = (p) => {
        if (p === 'youtube') return 'subscribers';
        if (p === 'reddit') return 'karma';
        return 'followers';
    };

    const getFollowerCount = (item) => {
        return item.followers_count || item.statistics?.subscriberCount || 0;
    };

    // --- Export Functions ---
    const exportToPDF = () => {
        if (filteredResults.length === 0) { toast.error('No results to export'); return; }
        const doc = new jsPDF({ orientation: 'landscape' });
        doc.setFillColor(15, 23, 42);
        doc.rect(0, 0, 297, 22, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.text('Global Search Report', 14, 14);
        doc.setFontSize(8);
        doc.text(`"${query}" | ${PLATFORMS[platform]?.label || platform} | ${searchType} | ${formatISTFull(new Date())}`, 14, 20);
        doc.setTextColor(0, 0, 0);

        const tableColumn = searchType === 'profiles'
            ? ['#', 'Platform', 'Name', 'Handle', 'Followers', 'Link']
            : ['#', 'Platform', 'Author', 'Date', 'Likes', 'Comments', 'Link'];

        const tableRows = filteredResults.map((item, i) => {
            const p = (item._platform || '').toUpperCase();
            if (searchType === 'profiles') {
                return [i + 1, p, item.name || item.title || 'N/A', getHandle(item), formatNumber(getFollowerCount(item)), getProfileUrl(item)];
            }
            return [i + 1, p, item.author || item.channelTitle || 'N/A', formatISTFull(item.created_at || item.publishedAt),
                (item.metrics?.likes || item.statistics?.likeCount || 0).toLocaleString(),
                (item.metrics?.comments || item.statistics?.commentCount || 0).toLocaleString(),
                getContentUrl(item)];
        });

        const urlColIndex = searchType === 'profiles' ? 5 : 6;
        autoTable(doc, {
            head: [tableColumn], body: tableRows, startY: 28,
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            didDrawCell: (data) => {
                if (data.column.index === urlColIndex && data.cell.section === 'body') {
                    const url = data.cell.raw;
                    if (url && String(url).startsWith('http')) {
                        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
                    }
                }
            }
        });
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.text(`Page ${i}/${pageCount} — Blura Hub`, 148, 205, { align: 'center' });
        }
        doc.save(`search_${query}_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('PDF exported');
    };

    const exportToExcel = () => {
        if (filteredResults.length === 0) { toast.error('No results to export'); return; }
        const rows = filteredResults.map(item => {
            const p = item._platform || '';
            if (searchType === 'profiles') {
                return { Platform: p.toUpperCase(), Name: item.name || item.title || '', Handle: getHandle(item), Description: item.description || '', Followers: getFollowerCount(item), URL: getProfileUrl(item) };
            }
            return { Platform: p.toUpperCase(), Author: item.author || item.channelTitle || '', Content: (item.text || item.description || item.title || '').substring(0, 300), Date: formatISTFull(item.created_at || item.publishedAt), Likes: item.metrics?.likes || item.statistics?.likeCount || 0, Comments: item.metrics?.comments || item.statistics?.commentCount || 0, Views: item.metrics?.views || item.statistics?.viewCount || 0, URL: getContentUrl(item) };
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Results');
        const meta = [{ Field: 'Query', Value: query }, { Field: 'Platform', Value: PLATFORMS[platform]?.label || platform }, { Field: 'Type', Value: searchType }, { Field: 'Count', Value: filteredResults.length }, { Field: 'Date', Value: formatISTFull(new Date()) }];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(meta), 'Info');
        const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `search_${query}_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Excel exported');
    };

    // --- Render Helpers ---
    const PlatformPill = ({ platformKey, small }) => {
        const cfg = PLATFORMS[platformKey] || PLATFORMS.all;
        const Icon = cfg.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${cfg.color} ${small ? 'text-[10px]' : 'text-xs'} font-medium`}>
                <Icon className={small ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
                {!small && cfg.label}
            </span>
        );
    };

    const renderProfileCard = (item, index) => {
        const p = item._platform || 'x';
        const cfg = PLATFORMS[p] || PLATFORMS.all;
        const profileUrl = getProfileUrl(item);
        const followers = getFollowerCount(item);

        return (
            <div key={`${p}-${item.id}-${index}`} className={`group relative bg-card rounded-xl border border-border hover:shadow-lg transition-all duration-200 overflow-hidden`}>
                {/* Gradient top stripe */}
                <div className={`h-1 bg-gradient-to-r ${cfg.color}`} />

                <div className="p-4">
                    <div className="flex items-start gap-3">
                        <div className="relative flex-shrink-0">
                            <Avatar className="h-12 w-12 border-2 border-card shadow-sm">
                                <AvatarImage src={item.profile_image_url || item.thumbnails?.default?.url} />
                                <AvatarFallback className={`${cfg.bg} ${cfg.text} font-semibold`}>
                                    {(item.name || item.title || '?')[0]?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            {item.verified && (
                                <div className="absolute -bottom-0.5 -right-0.5 bg-blue-500 rounded-full p-0.5">
                                    <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/></svg>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-sm text-foreground truncate leading-tight">
                                        {item.name || item.title}
                                    </h3>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{getHandle(item)}</p>
                                </div>
                                <PlatformPill platformKey={p} small />
                            </div>

                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                                {item.description || 'No description available'}
                            </p>
                        </div>
                    </div>

                    {/* Stats + Actions */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <div className="flex items-center gap-1 text-xs">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="font-semibold text-foreground">{formatNumber(followers)}</span>
                            <span className="text-muted-foreground">{getFollowerLabel(p)}</span>
                        </div>
                        <div className="flex gap-1.5">
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => window.open(profileUrl, '_blank', 'noopener,noreferrer')}
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs px-2.5 gap-1 font-medium"
                                onClick={() => openMonitorDialog(item)}
                            >
                                <Monitor className="h-3 w-3" />
                                Monitor
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderContentCard = (item, index) => {
        const p = item._platform || 'x';
        const cfg = PLATFORMS[p] || PLATFORMS.all;
        const contentUrl = getContentUrl(item);
        const likes = item.metrics?.likes || item.statistics?.likeCount || 0;
        const comments = item.metrics?.comments || item.statistics?.commentCount || 0;
        const views = item.metrics?.views || item.statistics?.viewCount || 0;
        const shares = item.metrics?.retweets || item.metrics?.shares || 0;
        const contentText = item.text || item.description || item.title || '';
        const thumbnail = item.thumbnails?.medium?.url || item.thumbnails?.default?.url || null;

        return (
            <div key={`${p}-${item.id}-${index}`} className="group bg-card rounded-xl border border-border hover:shadow-lg hover:border-border/80 transition-all duration-200 overflow-hidden">
                <div className="p-4">
                    {/* Author row */}
                    <div className="flex items-center gap-3 mb-3">
                        <Avatar className="h-9 w-9 border border-border">
                            <AvatarImage src={item.author_avatar || item.thumbnails?.default?.url} />
                            <AvatarFallback className={`${cfg.bg} ${cfg.text} text-xs font-semibold`}>
                                {(item.author || item.channelTitle || '?')[0]?.toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-foreground truncate">{item.author || item.channelTitle || 'Unknown'}</span>
                                <PlatformPill platformKey={p} small />
                            </div>
                            {(item.author_handle || item.created_at || item.publishedAt) && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                    {item.author_handle && <span>@{item.author_handle}</span>}
                                    {(item.created_at || item.publishedAt) && (
                                        <span>· {formatIST(item.created_at || item.publishedAt)}</span>
                                    )}
                                </div>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => window.open(contentUrl, '_blank', 'noopener,noreferrer')}
                        >
                            <ArrowUpRight className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Content */}
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-line">{contentText}</p>
                        </div>
                        {thumbnail && p === 'youtube' && (
                            <div className="flex-shrink-0 w-32 h-20 rounded-lg overflow-hidden bg-muted">
                                <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                            </div>
                        )}
                    </div>

                    {/* Engagement metrics */}
                    <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/50">
                        {likes > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Heart className="h-3.5 w-3.5" />
                                {formatNumber(likes)}
                            </span>
                        )}
                        {comments > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MessageCircle className="h-3.5 w-3.5" />
                                {formatNumber(comments)}
                            </span>
                        )}
                        {shares > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Repeat2 className="h-3.5 w-3.5" />
                                {formatNumber(shares)}
                            </span>
                        )}
                        {views > 0 && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Eye className="h-3.5 w-3.5" />
                                {formatNumber(views)}
                            </span>
                        )}
                        <div className="flex-1" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 px-2 gap-1"
                            onClick={() => window.open(contentUrl, '_blank', 'noopener,noreferrer')}
                        >
                            View <ExternalLink className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </div>
        );
    };

    // How many platforms are done (for loading progress)
    const totalPlatforms = platform === 'all' ? 5 : 1;
    const donePlatforms = completedPlatforms.size;

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-background to-muted/30 overflow-hidden">
            {/* Header + Search — sticky within the page container */}
            <div className="flex-shrink-0 bg-background/80 backdrop-blur-md z-20 shadow-sm border-b border-border/50">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Title row */}
                    <div className="flex items-center justify-between py-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-200 dark:shadow-blue-900/30">
                                <Globe className="h-4.5 w-4.5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-bold text-foreground leading-tight">Global Search</h1>
                                <p className="text-[11px] text-muted-foreground">Search profiles & content across all platforms</p>
                            </div>
                        </div>
                        {results.length > 0 && (
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-1.5 text-xs h-8">
                                    <Download className="h-3.5 w-3.5" /> PDF
                                </Button>
                                <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-1.5 text-xs h-8">
                                    <Download className="h-3.5 w-3.5" /> Excel
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Search bar */}
                    <form onSubmit={handleSearch} className="pb-3">
                        <div className="flex flex-col sm:flex-row gap-2.5">
                            {/* Platform + Type selectors */}
                            <div className="flex gap-2">
                                <Select value={platform} onValueChange={(v) => { setPlatform(v); setResultFilter('all'); }}>
                                    <SelectTrigger className="w-[160px] h-10 bg-card text-sm rounded-lg">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border border-border shadow-lg">
                                        {Object.entries(PLATFORMS).map(([key, cfg]) => {
                                            const Icon = cfg.icon;
                                            return (
                                                <SelectItem key={key} value={key}>
                                                    <span className="flex items-center gap-2">
                                                        <Icon className="h-3.5 w-3.5" />
                                                        {cfg.label}
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>

                                <div className="flex rounded-lg overflow-hidden border border-border">
                                    <button
                                        type="button"
                                        className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-all ${searchType === 'profiles' ? 'bg-primary text-primary-foreground shadow-inner' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                                        onClick={() => setSearchType('profiles')}
                                    >
                                        <Users className="h-3.5 w-3.5" /> Profiles
                                    </button>
                                    <button
                                        type="button"
                                        className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 transition-all border-l border-border ${searchType === 'content' ? 'bg-primary text-primary-foreground shadow-inner' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                                        onClick={() => setSearchType('content')}
                                    >
                                        <Hash className="h-3.5 w-3.5" /> Content
                                    </button>
                                </div>
                            </div>

                            {/* Search input */}
                            <div className="flex-1 flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder={searchType === 'profiles'
                                            ? `Search users, channels, pages...`
                                            : `Search posts, tweets, videos by keyword...`}
                                        className="pl-10 h-10 bg-muted/50 border-border focus:bg-card text-sm rounded-lg"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                    />
                                    {query && (
                                        <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                                <Button type="submit" disabled={loading || !query.trim()} className="h-10 px-6 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-sm font-medium rounded-lg text-white">
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Search className="h-4 w-4 mr-1.5" />} Search
                                </Button>
                                {(loading || searched) && (
                                    <Button type="button" onClick={clearAll} variant="outline" className="h-10 px-4 text-sm font-medium rounded-lg gap-1.5">
                                        <X className="h-4 w-4" /> Clear
                                    </Button>
                                )}
                            </div>
                        </div>
                    </form>
                </div>
                {/* Thin progress bar during loading */}
                {loading && (
                    <div className="h-0.5 bg-muted w-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 transition-all duration-700 ease-out"
                            style={{ width: `${Math.max(10, (donePlatforms / totalPlatforms) * 100)}%` }}
                        />
                    </div>
                )}
            </div>

            {/* Scrollable results area */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-5">
                    {/* Platform error warnings */}
                    {Object.keys(platformErrors).length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-2">
                            {Object.entries(platformErrors).map(([p, err]) => (
                                <div key={p} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50/80 dark:bg-amber-900/20 rounded-lg text-xs text-amber-800 dark:text-amber-300">
                                    <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                    <span className="font-medium">{PLATFORMS[p]?.label || p}:</span> {err}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Results header with filter pills */}
                    {searched && results.length > 0 && (
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h2 className="text-sm font-semibold text-foreground">
                                    {filteredResults.length} result{filteredResults.length !== 1 ? 's' : ''}
                                    {resultFilter !== 'all' && ` from ${PLATFORMS[resultFilter]?.label || resultFilter}`}

                                </h2>
                                {platform === 'all' && Object.keys(platformCounts).length > 1 && (
                                    <div className="flex gap-1.5 flex-wrap">
                                        <button
                                            onClick={() => setResultFilter('all')}
                                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${resultFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                                        >
                                            All ({results.length})
                                        </button>
                                        {['x', 'youtube', 'reddit', 'facebook', 'instagram'].filter(p => platformCounts[p]).map(p => {
                                            const count = platformCounts[p];
                                            const cfg = PLATFORMS[p];
                                            const Icon = cfg.icon;
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setResultFilter(p)}
                                                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${resultFilter === p ? `bg-gradient-to-r ${cfg.color} text-white shadow-sm` : `${cfg.bg} ${cfg.text} hover:opacity-80`}`}
                                                >
                                                    <Icon className="h-3 w-3" /> {count}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Loading state — 3D Globe */}
                    {loading && results.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <SearchGlobe />
                            <p className="mt-6 text-sm font-medium text-foreground">
                                Scanning {platform === 'all' ? 'all platforms' : PLATFORMS[platform]?.label || platform}...
                            </p>
                            <p className="text-xs text-muted-foreground mt-1.5">Results will appear as they arrive</p>
                            {/* Platform progress dots */}
                            {platform === 'all' && (
                                <div className="flex items-center gap-3 mt-5">
                                    {['x', 'youtube', 'reddit', 'facebook', 'instagram'].map(p => {
                                        const cfg = PLATFORMS[p];
                                        const Icon = cfg.icon;
                                        const done = completedPlatforms.has(p);
                                        const hasError = !!platformErrors[p];
                                        return (
                                            <div key={p} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all duration-300 ${done ? (hasError ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300') : 'bg-muted text-muted-foreground'}`}>
                                                <Icon className="h-3 w-3" />
                                                {done ? (hasError ? '!' : '✓') : <Loader2 className="h-3 w-3 animate-spin" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Empty state — not searched yet */}
                    {!loading && !searched && (
                        <div className="flex flex-col items-center justify-center py-24">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/20 flex items-center justify-center mb-6 shadow-sm">
                                <Globe className="h-10 w-10 text-blue-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">Search across platforms</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-md">
                                Find users, channels, and pages or discover content by keywords across X, YouTube, Reddit, Facebook, and Instagram.
                            </p>
                            <div className="flex gap-3 mt-6">
                                {['x', 'youtube', 'reddit', 'facebook', 'instagram'].map(p => {
                                    const cfg = PLATFORMS[p];
                                    const Icon = cfg.icon;
                                    return (
                                        <div key={p} className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shadow-sm`}>
                                            <Icon className={`h-5 w-5 ${cfg.text}`} />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* No results */}
                    {!loading && searched && results.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24">
                            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                                <Search className="h-8 w-8 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-base font-semibold text-foreground mb-1">No results found</h3>
                            <p className="text-sm text-muted-foreground mb-4">Try a different keyword or switch platforms</p>
                            <Button variant="outline" size="sm" onClick={() => { setQuery(''); setSearched(false); }} className="gap-1.5">
                                <RefreshCw className="h-3.5 w-3.5" /> Clear & try again
                            </Button>
                        </div>
                    )}

                    {/* Results grid */}
                    {!loading && filteredResults.length > 0 && (
                        searchType === 'profiles' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {filteredResults.map((item, i) => renderProfileCard(item, i))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-w-6xl mx-auto">
                                {filteredResults.map((item, i) => renderContentCard(item, i))}
                            </div>
                        )
                    )}


                </div>
            </div>

            {/* Add Source Modal — same as Alerts/Sources/POI */}
            <AddSourceModal
                open={sourceModalOpen}
                onClose={() => setSourceModalOpen(false)}
                initialData={initialSourceData}
                onSuccess={() => {
                    toast.success(`Started monitoring ${initialSourceData?.display_name || initialSourceData?.identifier || 'source'}`);
                    setSourceModalOpen(false);
                }}
            />
        </div>
    );
};

export default GlobalSearch;
