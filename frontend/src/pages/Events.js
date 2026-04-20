import React, { useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { CalendarDays, Loader2, Play, Download, RefreshCw } from 'lucide-react';

const splitKeywords = (value) => {
  if (!value) return [];
  return value
    .split(/\n|,|;/g)
    .map((s) => s.trim())
    .filter(Boolean);
};

const downloadTextFile = (filename, content, mimeType = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const toCsv = (rows) => {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    const needsQuotes = /[\",\n\r]/.test(s);
    const escaped = s.replace(/\"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  return rows.map((r) => r.map(escape).join(',')).join('\n');
};

const openPrintableReport = ({ event, stats, content, alerts }) => {
  const safe = (v) => (v === null || v === undefined ? '' : String(v));

  const companyLogoUrl = `${window.location.origin}/Logo.png`;
  const policeLogoUrl = `${window.location.origin}/policelogo.jpg`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Event Report - ${safe(event?.name)}</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; color: #111; }
    h1 { margin: 0 0 6px; font-size: 22px; }
    .sub { margin: 0 0 18px; color: #444; font-size: 12px; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
    .logo { height: 80px; width: auto; object-fit: contain; }
    .titleBlock { flex: 1; text-align: center; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 18px 0; }
    .box { border: 1px solid #ddd; border-radius: 10px; padding: 12px; }
    .k { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: .06em; }
    .v { font-size: 14px; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 11px; vertical-align: top; }
    th { background: #f6f6f6; text-align: left; }
    a { color: #0b5; text-decoration: none; }
    @media print { body { padding: 0; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="display:flex; gap:10px; margin-bottom:16px;">
    <button onclick="window.print()" style="padding:8px 12px; border:1px solid #ddd; border-radius:8px; background:#fff;">Print / Save as PDF</button>
    <button onclick="window.close()" style="padding:8px 12px; border:1px solid #ddd; border-radius:8px; background:#fff;">Close</button>
  </div>
  <div class="header">
    <img class="logo" src="${companyLogoUrl}" alt="Company logo" />
    <div class="titleBlock">
      <h1>Event Report: ${safe(event?.name)}</h1>
      <p class="sub">Generated: ${new Date().toLocaleString()}</p>
    </div>
    <img class="logo" src="${policeLogoUrl}" alt="Police logo" />
  </div>

  <div class="grid">
    <div class="box"><div class="k">Date Range</div><div class="v">${safe(event?.start_date)} → ${safe(event?.end_date)}</div></div>
    <div class="box"><div class="k">Location</div><div class="v">${safe(event?.location)}</div></div>
    <div class="box"><div class="k">Content Total</div><div class="v">${safe(stats?.content_total)}</div></div>
    <div class="box"><div class="k">Priority Alerts</div><div class="v">${safe(stats?.alerts_priority)}</div></div>
  </div>

  <h2 style="font-size:14px; margin:18px 0 6px;">Recent Priority Alerts</h2>
  <table>
    <thead><tr><th>Time</th><th>Platform</th><th>Title</th><th>Reason</th><th>Link</th></tr></thead>
    <tbody>
      ${alerts
        .filter((a) => a.is_priority)
        .map((a) => `
          <tr>
            <td>${safe(new Date(a.created_at).toLocaleString())}</td>
            <td>${safe((a.platform || '').toUpperCase())}</td>
            <td>${safe(a.title)}</td>
            <td>${safe(a.priority_reason)}</td>
            <td><a href="${safe(a.content_url)}" target="_blank" rel="noopener noreferrer">Open</a></td>
          </tr>`)
        .join('')}
    </tbody>
  </table>

  <h2 style="font-size:14px; margin:18px 0 6px;">Recent Content Evidence</h2>
  <table>
    <thead><tr><th>Published</th><th>Platform</th><th>Author</th><th>Text</th><th>Risk</th><th>Link</th></tr></thead>
    <tbody>
      ${content
        .map((c) => `
          <tr>
            <td>${safe(new Date(c.published_at).toLocaleString())}</td>
            <td>${safe((c.platform || '').toUpperCase())}</td>
            <td>${safe(c.author)}</td>
            <td>${safe(c.text).slice(0, 240)}</td>
            <td>${safe(c.risk_level)} (${safe(c.risk_score)})</td>
            <td><a href="${safe(c.content_url)}" target="_blank" rel="noopener noreferrer">Open</a></td>
          </tr>`)
        .join('')}
    </tbody>
  </table>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) {
    toast.error('Popup blocked. Please allow popups to export PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
};

const Events = () => {
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [creating, setCreating] = useState(false);
  const [runningScan, setRunningScan] = useState(false);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [exportFormat, setExportFormat] = useState('pdf');

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [keywordsTe, setKeywordsTe] = useState('');
  const [keywordsHi, setKeywordsHi] = useState('');
  const [keywordsEn, setKeywordsEn] = useState('');

  const fetchEvents = async () => {
    setLoadingEvents(true);
    try {
      const res = await api.get('/events', { params: { status: 'all' } });
      setEvents(res.data || []);
      if (!selectedId && res.data?.length > 0) setSelectedId(res.data[0].id);
    } catch (e) {
      toast.error('Failed to load events');
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchDashboard = async (id) => {
    if (!id) return;
    setLoadingDashboard(true);
    try {
      const res = await api.get(`/events/${id}/dashboard`);
      setDashboard(res.data);
    } catch (e) {
      toast.error('Failed to load event dashboard');
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) fetchDashboard(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectedEvent = useMemo(() => events.find((e) => e.id === selectedId) || null, [events, selectedId]);

  const filteredEvents = useMemo(() => {
    if (platformFilter === 'all') return events;
    return events.filter((e) => Array.isArray(e.platforms) && e.platforms.includes(platformFilter));
  }, [events, platformFilter]);

  useEffect(() => {
    if (!selectedId) {
      if (filteredEvents.length > 0) setSelectedId(filteredEvents[0].id);
      return;
    }

    const selected = events.find((e) => e.id === selectedId);
    const selectedMatches =
      platformFilter === 'all' || (Array.isArray(selected?.platforms) && selected.platforms.includes(platformFilter));

    if (!selected || !selectedMatches) {
      setSelectedId(filteredEvents[0]?.id || null);
      setDashboard(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformFilter, events, filteredEvents.length]);

  const filteredRecentAlerts = useMemo(() => {
    const arr = dashboard?.recent_alerts || [];
    if (platformFilter === 'all') return arr;
    return arr.filter((a) => a.platform === platformFilter);
  }, [dashboard, platformFilter]);

  const filteredRecentContent = useMemo(() => {
    const arr = dashboard?.recent_content || [];
    if (platformFilter === 'all') return arr;
    return arr.filter((c) => c.platform === platformFilter);
  }, [dashboard, platformFilter]);

  const createPayload = () => {
    const kw = [];
    splitKeywords(keywordsTe).forEach((k) => kw.push({ keyword: k, language: 'te' }));
    splitKeywords(keywordsHi).forEach((k) => kw.push({ keyword: k, language: 'hi' }));
    splitKeywords(keywordsEn).forEach((k) => kw.push({ keyword: k, language: 'en' }));

    return {
      name,
      location,
      start_date: startDate,
      end_date: endDate,
      keywords: kw,
      platforms: ['youtube', 'x', 'facebook'],
      auto_archive: true
    };
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name || !startDate || !endDate) {
      toast.error('Name, start date, and end date are required');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post('/events', createPayload());
      toast.success('Event created');
      setName('');
      setLocation('');
      setStartDate('');
      setEndDate('');
      setKeywordsTe('');
      setKeywordsHi('');
      setKeywordsEn('');
      await fetchEvents();
      setSelectedId(res.data?.id);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const handleRunScan = async () => {
    if (!selectedId) return;
    setRunningScan(true);
    try {
      await api.post(`/events/${selectedId}/run`);
      toast.success('Event scan completed');
      await fetchDashboard(selectedId);
      await fetchEvents();
    } catch (e) {
      toast.error(e?.response?.data?.message || 'Failed to run scan');
    } finally {
      setRunningScan(false);
    }
  };

  const handleExportCsv = () => {
    if (!dashboard) return;

    const rows = [];
    rows.push(['Type', 'Time', 'Platform', 'Author', 'Title/Text', 'Risk Level', 'Risk Score', 'Priority', 'Reason', 'URL']);

    filteredRecentAlerts.forEach((a) => {
      rows.push([
        'ALERT',
        a.created_at ? new Date(a.created_at).toISOString() : '',
        a.platform || '',
        a.author || '',
        a.title || '',
        a.risk_level || '',
        '',
        a.is_priority ? 'YES' : 'NO',
        a.priority_reason || '',
        a.content_url || ''
      ]);
    });

    filteredRecentContent.forEach((c) => {
      rows.push([
        'CONTENT',
        c.published_at ? new Date(c.published_at).toISOString() : '',
        c.platform || '',
        c.author || '',
        c.text || '',
        c.risk_level || '',
        c.risk_score ?? '',
        '',
        '',
        c.content_url || ''
      ]);
    });

    // UTF-8 BOM helps Excel render Telugu/Hindi correctly
    const csv = '\uFEFF' + toCsv(rows);
    const filename = `event-${dashboard.event?.id || 'report'}.csv`;
    downloadTextFile(filename, csv, 'text/csv;charset=utf-8');
  };

  const handleExportPdf = () => {
    if (!dashboard) return;
    openPrintableReport({
      event: dashboard.event,
      stats: dashboard.stats,
      content: filteredRecentContent,
      alerts: filteredRecentAlerts
    });
  };

  const handleExport = () => {
    if (exportFormat === 'csv') {
      handleExportCsv();
      return;
    }
    handleExportPdf();
  };

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto space-y-6 min-h-[calc(100vh-120px)]" data-testid="events-page">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7" />
          <h1 className="text-3xl font-heading font-bold tracking-tight">Event Monitoring</h1>
        </div>
        <p className="text-muted-foreground">
          Create time-bound events with multilingual keywords. Active events lower thresholds, increase polling frequency, and generate priority alerts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs defaultValue="browse" className="space-y-4">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="browse">Browse</TabsTrigger>
                <TabsTrigger value="create">Create</TabsTrigger>
              </TabsList>

              <TabsContent value="browse" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Filter by platform</div>
                  <Button variant="ghost" size="icon" onClick={fetchEvents} disabled={loadingEvents} aria-label="Refresh events">
                    {loadingEvents ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </div>
                <Tabs value={platformFilter} onValueChange={setPlatformFilter}>
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="youtube">YT</TabsTrigger>
                    <TabsTrigger value="x">X</TabsTrigger>
                    <TabsTrigger value="facebook">FB</TabsTrigger>
                  </TabsList>
                </Tabs>

                {loadingEvents ? (
                  <div className="py-8 flex items-center justify-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">No events yet.</div>
                ) : (
                  <ScrollArea className="h-[360px] lg:h-[calc(100vh-360px)] pr-2">
                    <div className="space-y-2">
                      {filteredEvents.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setSelectedId(e.id)}
                          className={`w-full text-left rounded-lg border px-3 py-2 transition-all duration-200 ease-out ${selectedId === e.id ? 'bg-secondary/40 border-border shadow-sm' : 'hover:bg-muted/40 hover:shadow-sm'}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold truncate">{e.name}</div>
                            <Badge variant="outline">{(e.status || 'planned').toUpperCase()}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {(Array.isArray(e.platforms) ? e.platforms : []).map((p) => (
                              <Badge key={p} variant="secondary" className="text-[10px]">
                                {(p || '').toUpperCase()}
                              </Badge>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate">{e.location || '—'}</div>
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {new Date(e.start_date).toLocaleDateString()} → {new Date(e.end_date).toLocaleDateString()}
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="create" className="space-y-4">
                <form className="space-y-4" onSubmit={handleCreate}>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Election Day" />
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Punjab" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Start</Label>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>End</Label>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                  </div>

                  <Tabs defaultValue="te">
                    <TabsList className="grid grid-cols-3 w-full">
                      <TabsTrigger value="te">Punjabi</TabsTrigger>
                      <TabsTrigger value="hi">Hindi</TabsTrigger>
                      <TabsTrigger value="en">English</TabsTrigger>
                    </TabsList>
                    <TabsContent value="te" className="mt-3">
                      <Label>Keywords (comma or newline separated)</Label>
                      <Textarea value={keywordsTe} onChange={(e) => setKeywordsTe(e.target.value)} rows={4} placeholder="e.g. ਚੋਣਾਂ, ਵੋਟ ..." />
                    </TabsContent>
                    <TabsContent value="hi" className="mt-3">
                      <Label>Keywords (comma or newline separated)</Label>
                      <Textarea value={keywordsHi} onChange={(e) => setKeywordsHi(e.target.value)} rows={4} placeholder="उदा: चुनाव, वोट..." />
                    </TabsContent>
                    <TabsContent value="en" className="mt-3">
                      <Label>Keywords (comma or newline separated)</Label>
                      <Textarea value={keywordsEn} onChange={(e) => setKeywordsEn(e.target.value)} rows={4} placeholder="e.g. election, vote..." />
                    </TabsContent>
                  </Tabs>

                  <Button type="submit" disabled={creating} className="w-full">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Event Dashboard</CardTitle>
                <div className="text-sm text-muted-foreground mt-1">{selectedEvent ? selectedEvent.name : 'Select an event'}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button className="gap-2" onClick={handleRunScan} disabled={!selectedId || runningScan}>
                  {runningScan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run Scan
                </Button>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger className="w-[120px] h-9">
                    <SelectValue placeholder="Export" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="gap-2" onClick={handleExport} disabled={!dashboard}>
                  <Download className="h-4 w-4" /> Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDashboard ? (
              <div className="py-16 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : !dashboard ? (
              <div className="py-16 text-center text-muted-foreground">No dashboard data.</div>
            ) : (
              <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid grid-cols-3 w-full md:w-[360px]">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="alerts">Priority Alerts</TabsTrigger>
                  <TabsTrigger value="content">Content</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border p-3 transition-all duration-200 ease-out">
                      <div className="text-xs text-muted-foreground">Content</div>
                      <div className="text-2xl font-bold mt-1">{dashboard.stats?.content_total || 0}</div>
                    </div>
                    <div className="rounded-lg border p-3 transition-all duration-200 ease-out">
                      <div className="text-xs text-muted-foreground">Alerts</div>
                      <div className="text-2xl font-bold mt-1">{dashboard.stats?.alerts_total || 0}</div>
                    </div>
                    <div className="rounded-lg border p-3 transition-all duration-200 ease-out">
                      <div className="text-xs text-muted-foreground">Active Alerts</div>
                      <div className="text-2xl font-bold mt-1">{dashboard.stats?.alerts_active || 0}</div>
                    </div>
                    <div className="rounded-lg border p-3 transition-all duration-200 ease-out">
                      <div className="text-xs text-muted-foreground">Priority</div>
                      <div className="text-2xl font-bold mt-1">{dashboard.stats?.alerts_priority || 0}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {Object.entries(dashboard.stats?.content_by_platform || {})
                      .filter(([p]) => platformFilter === 'all' || p === platformFilter)
                      .map(([p, n]) => (
                        <Badge key={p} variant="secondary">{p.toUpperCase()}: {n}</Badge>
                      ))}
                  </div>
                </TabsContent>

                <TabsContent value="alerts" className="space-y-3">
                  {filteredRecentAlerts.filter((a) => a.is_priority).length === 0 ? (
                    <div className="text-sm text-muted-foreground">No priority alerts yet.</div>
                  ) : (
                    <ScrollArea className="h-[360px] lg:h-[calc(100vh-420px)] pr-2">
                      <div className="space-y-2">
                        {filteredRecentAlerts.filter((a) => a.is_priority).map((a) => (
                          <div key={a.id} className="rounded-lg border p-3 transition-all duration-200 ease-out hover:shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold truncate">{a.title}</div>
                              <Badge variant="outline">{a.risk_level}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {(a.platform || '').toUpperCase()} • {new Date(a.created_at).toLocaleString()}
                            </div>
                            {a.priority_reason && (
                              <div className="text-xs mt-2">Reason: <span className="text-muted-foreground">{a.priority_reason}</span></div>
                            )}
                            <a className="text-sm text-primary hover:underline mt-2 inline-block" href={a.content_url} target="_blank" rel="noopener noreferrer">
                              Open source
                            </a>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>

                <TabsContent value="content" className="space-y-3">
                  {filteredRecentContent.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No event content ingested yet.</div>
                  ) : (
                    <ScrollArea className="h-[360px] lg:h-[calc(100vh-420px)] pr-2">
                      <div className="space-y-2">
                        {filteredRecentContent.map((c) => (
                          <div key={c.id} className="rounded-lg border p-3 transition-all duration-200 ease-out hover:shadow-sm">
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-semibold truncate">{c.author}</div>
                              <Badge variant="outline">{String(c.risk_level || 'low').toUpperCase()} {c.risk_score ? `• ${c.risk_score}` : ''}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {(c.platform || '').toUpperCase()} • {new Date(c.published_at).toLocaleString()}
                            </div>
                            <div className="text-sm text-muted-foreground mt-2 line-clamp-3">{c.text}</div>
                            <a className="text-sm text-primary hover:underline mt-2 inline-block" href={c.content_url} target="_blank" rel="noopener noreferrer">
                              Open source
                            </a>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Events;
