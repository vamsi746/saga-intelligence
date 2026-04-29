import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Loader2, RefreshCw, TrendingUp, Users, MapPin, Tag, BarChart2, Activity } from 'lucide-react';
import api from '../lib/api';

const PLATFORM_LABELS = { x: 'X / Twitter', facebook: 'Facebook', rss: 'RSS / News', youtube: 'YouTube', instagram: 'Instagram', whatsapp: 'WhatsApp' };
const PLATFORM_COLORS = { x: '#1d9bf0', facebook: '#1877f2', rss: '#f97316', youtube: '#ff0000', instagram: '#e1306c', whatsapp: '#25d366', unknown: '#94a3b8' };
const SENTIMENT_COLORS = { positive: '#22c55e', negative: '#ef4444', neutral: '#94a3b8', mixed: '#f59e0b', unknown: '#cbd5e1' };
const RISK_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e', unknown: '#94a3b8' };
const PARTY_COLORS = { TDP: '#ffcc00', YSRCP: '#0033cc', Janasena: '#ff6600', BJP: '#ff9933', INC: '#19a74e', unknown: '#94a3b8' };

const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 Days', days: 7 },
  { label: '30 Days', days: 30 },
  { label: '90 Days', days: 90 },
  { label: 'All Time', days: null },
];

const fmt = (n) => n?.toLocaleString() ?? '0';

const MiniBar = ({ data, colorMap, valueKey = 'count', labelKey }) => {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const label = d[labelKey];
        const pct = Math.round((d[valueKey] / max) * 100);
        const color = colorMap?.[label] || '#6366f1';
        return (
          <div key={i} className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-24 truncate capitalize">{label || '—'}</span>
            <div className="flex-1 h-4 bg-muted/40 rounded-sm overflow-hidden">
              <div className="h-full rounded-sm transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="text-[10px] font-medium w-8 text-right">{fmt(d[valueKey])}</span>
          </div>
        );
      })}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, sub, color = 'text-primary' }) => (
  <Card className="p-3 border shadow-sm">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  </Card>
);

const AnalyticsTab = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ preset: '30', platform: 'all', sentiment: 'all', party: 'all' });

  const buildParams = () => {
    const p = new URLSearchParams();
    if (filters.platform !== 'all') p.set('platform', filters.platform);
    if (filters.sentiment !== 'all') p.set('sentiment', filters.sentiment);
    if (filters.party !== 'all') p.set('party', filters.party);
    if (filters.preset && filters.preset !== 'all') {
      const days = parseInt(filters.preset);
      if (!isNaN(days)) {
        const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        p.set('dateFrom', d.toISOString().slice(0, 10));
      }
    }
    return p.toString();
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildParams();
      const res = await api.get(`/analytics/posts-stats${params ? '?' + params : ''}`);
      setData(res.data);
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));

  const positiveCount = data?.bySentiment?.find(s => s.sentiment === 'positive')?.count || 0;
  const negativeCount = data?.bySentiment?.find(s => s.sentiment === 'negative')?.count || 0;
  const highRisk = data?.byRiskLevel?.find(r => r.risk === 'high')?.count || 0;
  const escalated = data?.byWorkflowStatus?.find(w => w.status === 'escalated')?.count || 0;

  return (
    <div className="space-y-4">
      {/* ── Filter Bar ── */}
      <Card className="p-3 border shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground mr-1">Filters:</span>

          {/* Date preset */}
          <div className="flex gap-1">
            {DATE_PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => setFilter('preset', p.days === null ? 'all' : String(p.days))}
                className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                  filters.preset === (p.days === null ? 'all' : String(p.days))
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          <Select value={filters.platform} onValueChange={v => setFilter('platform', v)}>
            <SelectTrigger className="h-7 text-xs w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="x">X / Twitter</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="rss">RSS / News</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.sentiment} onValueChange={v => setFilter('sentiment', v)}>
            <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sentiments</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filters.party} onValueChange={v => setFilter('party', v)}>
            <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Parties</SelectItem>
              <SelectItem value="TDP">TDP</SelectItem>
              <SelectItem value="YSRCP">YSRCP</SelectItem>
              <SelectItem value="Janasena">Janasena</SelectItem>
              <SelectItem value="BJP">BJP</SelectItem>
              <SelectItem value="INC">INC</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" variant="outline" className="h-7 px-2 ml-auto" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </Card>

      {loading && !data && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <>
          {/* ── Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={BarChart2} label="Total Posts" value={fmt(data.total)} sub="across all sources" />
            <StatCard icon={TrendingUp} label="Positive" value={fmt(positiveCount)} color="text-green-600"
              sub={data.total ? `${Math.round(positiveCount / data.total * 100)}% of total` : ''} />
            <StatCard icon={Activity} label="Negative" value={fmt(negativeCount)} color="text-red-500"
              sub={data.total ? `${Math.round(negativeCount / data.total * 100)}% of total` : ''} />
            <StatCard icon={Activity} label="High Risk" value={fmt(highRisk)} color="text-red-600"
              sub={escalated ? `${escalated} escalated` : 'risk level ≥80'} />
          </div>

          {/* ── Row 2: Platform + Sentiment ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-3 border shadow-sm">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-primary" /> By Platform
              </h4>
              {data.byPlatform.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No data</p>
              ) : (
                <MiniBar data={data.byPlatform} colorMap={PLATFORM_COLORS} labelKey="platform" />
              )}
            </Card>

            <Card className="p-3 border shadow-sm">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> By Sentiment
              </h4>
              {data.bySentiment.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No data</p>
              ) : (
                <MiniBar data={data.bySentiment} colorMap={SENTIMENT_COLORS} labelKey="sentiment" />
              )}
            </Card>

            <Card className="p-3 border shadow-sm">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-red-500" /> Risk &amp; Workflow
              </h4>
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1.5">Risk Level</p>
                  <MiniBar data={data.byRiskLevel} colorMap={RISK_COLORS} labelKey="risk" />
                </div>
                {data.byWorkflowStatus.length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase tracking-wide text-muted-foreground mb-1.5">Workflow Status</p>
                    <MiniBar data={data.byWorkflowStatus} colorMap={{}} labelKey="status" />
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* ── Row 3: Daily Trend ── */}
          {data.byDate.length > 0 && (
            <Card className="p-3 border shadow-sm">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" /> Daily Posts (Last 30 Days)
              </h4>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={data.byDate} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                    formatter={(v) => [v, 'Posts']}
                  />
                  <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ── Row 4: Top Senders + By Party ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Top Senders */}
            <Card className="p-3 border shadow-sm">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" /> Top Senders
              </h4>
              {data.topSenders.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No data</p>
              ) : (
                <ScrollArea className="h-[220px]">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-1 pr-2 text-muted-foreground font-medium">#</th>
                        <th className="text-left py-1 pr-2 text-muted-foreground font-medium">Handle / Source</th>
                        <th className="text-left py-1 pr-2 text-muted-foreground font-medium">Platform</th>
                        <th className="text-right py-1 text-muted-foreground font-medium">Posts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topSenders.map((s, i) => (
                        <tr key={i} className="border-b border-border/40 hover:bg-muted/20">
                          <td className="py-1.5 pr-2 text-muted-foreground">{i + 1}</td>
                          <td className="py-1.5 pr-2">
                            <div className="font-medium truncate max-w-[150px]">{s.handle || '—'}</div>
                            {s.display_name && s.display_name !== s.handle && (
                              <div className="text-[9px] text-muted-foreground truncate max-w-[150px]">{s.display_name}</div>
                            )}
                          </td>
                          <td className="py-1.5 pr-2">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium"
                              style={{ backgroundColor: PLATFORM_COLORS[s.platform] || '#94a3b8' }}>
                              {s.platform || '?'}
                            </span>
                          </td>
                          <td className="py-1.5 text-right font-semibold">{fmt(s.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </Card>

            {/* By Party */}
            <Card className="p-3 border shadow-sm">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5 text-primary" /> By Party (Targeted)
              </h4>
              {data.byParty.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No analyzed party data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.byParty} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="party" tick={{ fontSize: 10 }} width={60} />
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                      {data.byParty.map((entry, i) => (
                        <Cell key={i} fill={PARTY_COLORS[entry.party] || '#6366f1'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* ── Row 5: Location + Category + Keywords ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-3 border shadow-sm">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary" /> By Location (Top Cities)
              </h4>
              {data.byLocation.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No location data yet.</p>
              ) : (
                <ScrollArea className="h-[180px]">
                  <MiniBar data={data.byLocation} colorMap={{}} labelKey="city" />
                </ScrollArea>
              )}
            </Card>

            <Card className="p-3 border shadow-sm">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" /> By Category
              </h4>
              {data.byCategory.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No category data yet.</p>
              ) : (
                <ScrollArea className="h-[180px]">
                  <MiniBar data={data.byCategory} colorMap={{}} labelKey="category" />
                </ScrollArea>
              )}
            </Card>

            <Card className="p-3 border shadow-sm">
              <h4 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-amber-500" /> Top Keywords
              </h4>
              {data.byKeyword.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">No keyword data yet.</p>
              ) : (
                <ScrollArea className="h-[180px]">
                  <MiniBar data={data.byKeyword} colorMap={{}} labelKey="keyword" />
                </ScrollArea>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsTab;
