import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import { Save, Plus, Trash2, TrendingUp, ShieldAlert, BrainCircuit, Wand2, FileText, Upload, Star, ChevronDown, ChevronUp, Eye, Pencil, Copy, Check, X, HelpCircle } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { toast } from 'sonner';
import Sources from './Sources';
import { Badge } from '../components/ui/badge';
import RichTextEditor from '../components/RichTextEditor';
import { cn } from '../lib/utils';

const PLACEHOLDERS_GUIDE = [
  { key: 'SERIAL_NUMBER', desc: 'Case ID / Serial (e.g. X-2026-001)' },
  { key: 'DATE', desc: 'Current date (dd.mm.yyyy)' },
  { key: 'DATE_LONG', desc: 'Full date (e.g. 1st January 2026)' },
  { key: 'PLATFORM', desc: 'Platform name (X, YouTube, etc.)' },
  { key: 'PLATFORM_OPERATOR', desc: 'Company name (X Corp., Meta)' },
  { key: 'PLATFORM_DOMAIN', desc: 'URL (www.x.com, www.youtube.com)' },
  { key: 'AUTHOR_NAME', desc: 'Target user display name' },
  { key: 'AUTHOR_HANDLE', desc: 'Target user handle (with @)' },
  { key: 'PROFILE_URL', desc: 'Link to target profile' },
  { key: 'CONTENT_URL', desc: 'Link to the flagged post' },
  { key: 'CONTENT_TEXT', desc: 'Text content of the violation' },
  { key: 'POST_DATE', desc: 'Original post date' },
  { key: 'LEGAL_SECTIONS', desc: 'Full Law/BNS sections' },
  { key: 'LEGAL_SECTIONS_NUMBERS', desc: 'Just section numbers (e.g. 152)' },
  { key: 'CATEGORY', desc: 'Violation category (e.g. Hate Speech)' },
  { key: 'RISK_LEVEL', desc: 'Threat level (HIGH, MEDIUM, LOW)' },
  { key: 'IS_REPOST', desc: 'Repost flag (Yes/No)' },
  { key: 'ALERT_DESCRIPTION', desc: 'Full alert description' },
  { key: 'DEPARTMENT_NAME', desc: 'Police Department name' },
  { key: 'GOVERNMENT_NAME', desc: 'Government name' },
];

const PlaceholderSidebar = ({ onClose }) => {
  const [copiedKey, setCopiedKey] = useState(null);

  const handleCopy = (key) => {
    navigator.clipboard.writeText('{{' + key + '}}');
    setCopiedKey(key);
    toast.success(`Copied {{${key}}}`, {
      description: "Paste into your document",
      duration: 1500,
    });
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="w-56 shrink-0 bg-secondary/5 border-l flex flex-col min-h-0 animate-in slide-in-from-right-2 duration-200">
      <div className="p-2.5 border-b bg-secondary/10 flex items-center justify-between">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <BrainCircuit className="h-3 w-3" /> Data Tags
        </h4>
        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-50 hover:opacity-100" onClick={onClose}>
          <X className="h-3 w-3" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {PLACEHOLDERS_GUIDE.map(p => (
            <div
              key={p.key}
              onClick={() => handleCopy(p.key)}
              className="p-1.5 rounded-md bg-background border border-border/40 hover:border-primary/30 hover:bg-secondary/5 transition-all group cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <code className="text-[9px] font-mono font-bold text-slate-700 dark:text-slate-300 tracking-tight bg-slate-100 dark:bg-slate-800 px-1 rounded">
                  {'{{' + p.key + '}}'}
                </code>
                <div className="flex items-center text-muted-foreground group-hover:text-primary transition-colors">
                  {copiedKey === p.key ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
              <p className="text-[8.5px] text-muted-foreground leading-tight">{p.desc}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-2 border-t bg-secondary/5">
        <div className="flex items-start gap-1.5">
          <div className="h-1 w-1 rounded-full bg-primary mt-1 shrink-0" />
          <p className="text-[8.5px] leading-relaxed text-muted-foreground italic">
            <strong>Click to copy</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

const Settings = () => {
  const [settings, setSettings] = useState(null);
  const [keywords, setKeywords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState({ category: 'violence', language: 'en', keyword: '' });
  const [transliterationEnabled, setTransliterationEnabled] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [thresholds, setThresholds] = useState([]);

  // Report Templates state
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templatePlatform, setTemplatePlatform] = useState('all');
  const [templateIsDefault, setTemplateIsDefault] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  // 2-step upload: parse first, edit, then save
  const [uploadStep, setUploadStep] = useState(1); // 1 = pick file, 2 = edit content
  const [parsedHtml, setParsedHtml] = useState('');
  const [editedHtml, setEditedHtml] = useState('');
  const [showPlaceholderGuide, setShowPlaceholderGuide] = useState(true);
  // Edit existing template
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingHtml, setEditingHtml] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [thresholdsLoading, setThresholdsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // View mode: 'tabs' or 'editor'
  const [viewMode, setViewMode] = useState('tabs');



  // Transliteration logic
  const handleKeywordChange = async (e) => {
    const val = e.target.value;
    setNewKeyword(prev => ({ ...prev, keyword: val }));

    if (transliterationEnabled &&
      newKeyword.language !== 'en' &&
      newKeyword.language !== 'all') {

      const words = val.split(' ');
      const lastWord = words[words.length - 1];
      const isSpace = val.endsWith(' ');

      if (isSpace && words.length > 1) {
        const wordToConvert = words[words.length - 2];
        if (wordToConvert) {
          const langCode = newKeyword.language === 'te' ? 'te-t-i0-und' : 'hi-t-i0-und';
          try {
            const response = await fetch(
              `https://inputtools.google.com/request?text=${encodeURIComponent(wordToConvert)}&itc=${langCode}&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`
            );
            const data = await response.json();
            if (data[0] === 'SUCCESS' && data[1] && data[1][0] && data[1][0][1]) {
              const transliteratedWord = data[1][0][1][0];
              const newVal = val.substring(0, val.lastIndexOf(wordToConvert)) + transliteratedWord + ' ';
              setNewKeyword(prev => ({ ...prev, keyword: newVal }));
            }
          } catch (err) { }
        }
        setSuggestions([]);
        return;
      }

      if (lastWord && lastWord.length > 0) {
        const langCode = newKeyword.language === 'te' ? 'te-t-i0-und' : 'hi-t-i0-und';
        try {
          const response = await fetch(
            `https://inputtools.google.com/request?text=${encodeURIComponent(lastWord)}&itc=${langCode}&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8`
          );
          const data = await response.json();
          if (data[0] === 'SUCCESS' && data[1] && data[1][0] && data[1][0][1]) {
            setSuggestions(data[1][0][1]);
          } else {
            setSuggestions([]);
          }
        } catch (err) {
          setSuggestions([]);
        }
      } else {
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    const val = newKeyword.keyword;
    const words = val.split(' ');
    words.pop();
    words.push(suggestion);
    const newVal = words.join(' ') + ' ';
    setNewKeyword(prev => ({ ...prev, keyword: newVal }));
    setSuggestions([]);

    setTimeout(() => {
      document.querySelector('input[name="keywordInput"]')?.focus();
    }, 10);
  };

  useEffect(() => {
    fetchData();
    fetchThresholds();
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setTemplatesLoading(true);
      const res = await api.get('/templates');
      setTemplates(res.data);
    } catch (error) {
      console.error('Failed to load templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleUploadTemplate = async (e) => {
    e.preventDefault();
    if (!templateFile || !templateName.trim()) {
      toast.error('Please provide a template name and DOCX file');
      return;
    }
    // Step 1: Parse the DOCX first
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('template', templateFile);
      const res = await api.post('/templates/parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setParsedHtml(res.data.html);
      setEditedHtml(res.data.html);
      setUploadStep(2);
      setViewMode('editor');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to parse document');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveWithEditor = async () => {
    try {
      setUploading(true);
      // Re-upload the original file but with the edited HTML
      const formData = new FormData();
      formData.append('template', templateFile);
      formData.append('name', templateName.trim());
      formData.append('platform', templatePlatform);
      formData.append('is_default', templateIsDefault);
      const res = await api.post('/templates/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Now update with edited HTML
      if (editedHtml !== parsedHtml) {
        await api.put(`/templates/${res.data.id}/content`, { html_content: editedHtml });
      }
      toast.success('Template saved successfully');
      resetUploadDialog();
      setViewMode('tabs');
      fetchTemplates();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Save failed');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadDialog = () => {
    setTemplateDialogOpen(false);
    setTemplateName('');
    setTemplatePlatform('all');
    setTemplateIsDefault(false);
    setTemplateFile(null);
    setUploadStep(1);
    setParsedHtml('');
    setEditedHtml('');
    setViewMode('tabs');
  };

  const handleEditTemplate = async (template) => {
    setEditingTemplate(template);
    setEditingHtml(template.html_content);
    setViewMode('editor');
  };

  const handleSaveEditedTemplate = async () => {
    try {
      setSavingEdit(true);
      await api.put(`/templates/${editingTemplate.id}/content`, { html_content: editingHtml });
      toast.success('Template updated');
      setEditingTemplate(null);
      setViewMode('tabs');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to save template');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      await api.delete(`/templates/${id}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to delete template');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await api.put(`/templates/${id}/default`);
      toast.success('Default template updated');
      fetchTemplates();
    } catch (error) {
      toast.error('Failed to set default');
    }
  };

  const handlePreviewTemplate = async (id) => {
    try {
      const res = await api.post(`/templates/${id}/preview`);
      setPreviewHtml(res.data.html);
      setPreviewOpen(true);
    } catch (error) {
      toast.error('Preview failed');
    }
  };

  const fetchData = async () => {
    try {
      const [settingsRes, keywordsRes] = await Promise.all([
        api.get('/settings'),
        api.get('/keywords')
      ]);
      setSettings(settingsRes.data);
      setKeywords(keywordsRes.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchThresholds = async () => {
    try {
      setThresholdsLoading(true);
      const res = await api.get('/alert-thresholds');
      setThresholds(res.data);
    } catch (error) {
      toast.error('Failed to load velocity thresholds');
    } finally {
      setThresholdsLoading(false);
    }
  };

  const handleSaveThresholds = async () => {
    try {
      await api.put('/alert-thresholds/bulk', { thresholds });
      toast.success('Velocity thresholds saved successfully');
    } catch (error) {
      toast.error('Failed to save thresholds');
    }
  };



  const updateThreshold = (platform, metric, field, value) => {
    setThresholds(prev => prev.map(t =>
      t.platform === platform
        ? { ...t, [field]: parseInt(value) || 0 }
        : t
    ));
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await api.put('/settings', settings);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const handleAddKeyword = async (e) => {
    e.preventDefault();
    try {
      await api.post('/keywords', newKeyword);
      toast.success('Keyword added successfully');
      setDialogOpen(false);
      setNewKeyword({ category: 'violence', language: 'en', keyword: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to add keyword');
    }
  };

  const handleDeleteKeyword = async (id) => {
    try {
      await api.delete(`/keywords/${id}`);
      toast.success('Keyword deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete keyword');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (viewMode === 'editor') {
    const isEditing = !!editingTemplate;
    const title = isEditing ? `Edit Template — ${editingTemplate.name}` : `Upload Template — ${templateName}`;
    const handleSave = isEditing ? handleSaveEditedTemplate : handleSaveWithEditor;
    const currentHtml = isEditing ? editingHtml : editedHtml;
    const setCurrentHtml = isEditing ? setEditingHtml : setEditedHtml;
    const isSaving = isEditing ? savingEdit : uploading;

    return (
      <div className="flex flex-col h-[calc(100vh-120px)] bg-background border rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-300">
        {/* Editor Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-none">{title}</h2>
              <p className="text-xs text-gray-500 mt-1">Refine your legal document structure and placeholders.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => isEditing ? setViewMode('tabs') : resetUploadDialog()} className="h-9 px-4">
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
              {isSaving ? 'Saving...' : 'Save Template'}
            </Button>
          </div>
        </div>

        {/* Editor Content Area */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main Editor Surface */}
          <div className="flex-1 min-h-0 overflow-auto bg-white dark:bg-black/40">
            <RichTextEditor
              initialContent={currentHtml}
              onChange={setCurrentHtml}
              minHeight="100%"
              placeholder="Start drafting your template content..."
            />
          </div>

          {/* Integration Sidebar */}
          <PlaceholderSidebar />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 p-4 md:p-6 lg:p-8 max-w-none" data-testid="settings-page">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="h-9 p-1">
          <TabsTrigger value="general" className="text-xs px-4">Risk Thresholds</TabsTrigger>
          <TabsTrigger value="sources" className="text-xs px-4">Profiles</TabsTrigger>
          <TabsTrigger value="keywords" className="text-xs px-4">Keywords</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs px-4">Report Templates</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-4">
          {/* Risk Thresholds */}
          <Card className="p-3">
            <form onSubmit={handleSaveSettings}>
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium whitespace-nowrap">Risk Thresholds</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground">High</Label>
                    <Input
                      type="number" min="0" max="100"
                      value={settings?.risk_threshold_high || 70}
                      onChange={(e) => setSettings({ ...settings, risk_threshold_high: parseInt(e.target.value) })}
                      className="h-7 w-16 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground">Medium</Label>
                    <Input
                      type="number" min="0" max="100"
                      value={settings?.risk_threshold_medium || 40}
                      onChange={(e) => setSettings({ ...settings, risk_threshold_medium: parseInt(e.target.value) })}
                      className="h-7 w-16 text-xs"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Label className="text-[10px] text-muted-foreground">Interval</Label>
                    <Input
                      type="number" min="5" max="1440"
                      value={settings?.monitoring_interval_minutes || 15}
                      onChange={(e) => setSettings({ ...settings, monitoring_interval_minutes: parseInt(e.target.value) })}
                      className="h-7 w-16 text-xs"
                    />
                  </div>
                </div>
                <Button type="submit" size="sm" className="h-7 px-2 text-[10px]">
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
              </div>
            </form>
          </Card>

          {/* Viral Detection */}
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">Viral Detection</h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px]">Enabled</Label>
                    <Switch
                      checked={settings?.velocity_alerts_enabled ?? true}
                      onCheckedChange={(checked) => setSettings({ ...settings, velocity_alerts_enabled: checked })}
                      className="scale-75"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-[11px]">All Posts</Label>
                    <Switch
                      checked={settings?.alert_for_every_post ?? false}
                      onCheckedChange={(checked) => setSettings({ ...settings, alert_for_every_post: checked })}
                      className="scale-75"
                    />
                  </div>
                </div>
              </div>

              {/* Platform Threshold Cards */}
              {['x', 'youtube'].map(platform => {
                const threshold = thresholds.find(t => t.platform === platform);
                if (!threshold) return null;
                return (
                  <div key={platform} className="border rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4" />
                      <h3 className="font-semibold">{platform === 'x' ? 'X (Twitter)' : 'YouTube'}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-4">
                      Alert when ANY metric (likes, retweets, comments, views) crosses these thresholds within the time window
                    </p>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-green-600 font-medium">LOW Threshold</Label>
                        <Input
                          type="number"
                          value={threshold.low_threshold}
                          onChange={(e) => updateThreshold(threshold.platform, null, 'low_threshold', e.target.value)}
                          placeholder="100"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-amber-600 font-medium">MEDIUM Threshold</Label>
                        <Input
                          type="number"
                          value={threshold.medium_threshold}
                          onChange={(e) => updateThreshold(threshold.platform, null, 'medium_threshold', e.target.value)}
                          placeholder="500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-red-600 font-medium">HIGH Threshold</Label>
                        <Input
                          type="number"
                          value={threshold.high_threshold}
                          onChange={(e) => updateThreshold(threshold.platform, null, 'high_threshold', e.target.value)}
                          placeholder="1000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Time Window (min)</Label>
                        <Input
                          type="number"
                          value={threshold.time_window_minutes}
                          onChange={(e) => updateThreshold(threshold.platform, null, 'time_window_minutes', e.target.value)}
                          placeholder="60"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <Button onClick={handleSaveThresholds} variant="secondary">
                <Save className="h-4 w-4 mr-2" />
                Save Thresholds
              </Button>
            </div>
          </Card>
        </TabsContent>



        <TabsContent value="sources" className="mt-2">
          <Sources />
        </TabsContent>

        {/* Keywords */}
        <TabsContent value="keywords" className="space-y-4">
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Keywords</h3>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm" className="h-7 px-2 text-xs"
                    onClick={async () => {
                      try { await api.post('/keywords/scan'); toast.success('Scan started'); }
                      catch { toast.error('Scan failed'); }
                    }}
                  >Scan</Button>
                  <Dialog open={dialogOpen} onOpenChange={(open) => {
                    setDialogOpen(open);
                    if (!open) { setNewKeyword({ category: 'violence', language: 'en', keyword: '' }); setTransliterationEnabled(true); setSuggestions([]); }
                  }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="h-7 px-2 text-xs"><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[400px]">
                      <DialogHeader>
                        <DialogTitle className="text-base">Add Keyword</DialogTitle>
                        <DialogDescription className="text-[10px]">
                          Enter a specific keyword or phrase to monitor for potential violations.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddKeyword} className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Category</Label>
                            <Select value={newKeyword.category} onValueChange={(v) => setNewKeyword({ ...newKeyword, category: v })}>
                              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="violence">Violence</SelectItem>
                                <SelectItem value="threat">Threat</SelectItem>
                                <SelectItem value="hate">Hate</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Language</Label>
                            <Select value={newKeyword.language} onValueChange={(v) => setNewKeyword({ ...newKeyword, language: v })}>
                              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="hi">Hindi</SelectItem>
                                <SelectItem value="te">Telugu</SelectItem>
                                <SelectItem value="all">All</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Keyword</Label>
                          {newKeyword.language !== 'en' && newKeyword.language !== 'all' && (
                            <div className="flex items-center gap-2 mt-1 mb-1">
                              <Switch checked={transliterationEnabled} onCheckedChange={setTransliterationEnabled} className="scale-75" />
                              <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Wand2 className="h-3 w-3" /> Auto-transliterate</span>
                            </div>
                          )}
                          <div className="relative">
                            <Input name="keywordInput" value={newKeyword.keyword} onChange={handleKeywordChange} placeholder="Enter keyword" required className="h-8 text-xs" autoComplete="off" />
                            {suggestions.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg">
                                {suggestions.map((s, i) => (
                                  <button key={i} type="button" onClick={() => handleSuggestionClick(s)} className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent">{s}</button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button type="submit" className="w-full h-8 text-xs">Add</Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              <Tabs defaultValue="violence" className="space-y-2">
                <TabsList className="h-8 p-1">
                  <TabsTrigger value="violence" className="text-xs px-3">Violence</TabsTrigger>
                  <TabsTrigger value="threat" className="text-xs px-3">Threat</TabsTrigger>
                  <TabsTrigger value="hate" className="text-xs px-3">Hate</TabsTrigger>
                </TabsList>
                {['violence', 'threat', 'hate'].map(category => {
                  const catKw = keywords.filter(k => k.category === category);
                  return (
                    <TabsContent key={category} value={category}>
                      {catKw.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">No keywords</p>
                      ) : (
                        <ScrollArea className="h-[200px]">
                          <div className="flex flex-wrap gap-2 pr-2">
                            {catKw.map(kw => (
                              <div key={kw.id} className="group inline-flex items-center gap-1.5 px-2 py-1 rounded border bg-secondary/30 text-xs">
                                <Badge variant="outline" className="text-[10px] px-1 py-0">{kw.language?.toUpperCase() || 'EN'}</Badge>
                                <span>{kw.keyword}</span>
                                <button onClick={() => handleDeleteKeyword(kw.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            </div>
          </Card>
        </TabsContent>

        {/* Report Templates */}
        <TabsContent value="templates" className="space-y-4">
          <Card className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <h3 className="text-sm font-semibold">Report Templates</h3>
                    <p className="text-[10px] text-muted-foreground">Upload any DOCX — edit before saving. Alert data auto-fills when generating reports.</p>
                  </div>
                </div>

                {/* Upload Template Dialog - 2 Step Flow */}
                <Dialog open={templateDialogOpen} onOpenChange={(open) => {
                  if (!open) resetUploadDialog();
                  else setTemplateDialogOpen(true);
                }}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="h-7 px-2 text-xs"><Upload className="h-3 w-3 mr-1" /> Upload Template</Button>
                  </DialogTrigger>
                  <DialogContent className={uploadStep === 2 ? 'sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col' : 'sm:max-w-[450px]'}>
                    <DialogHeader>
                      <DialogTitle className="text-base">
                        {uploadStep === 1 ? 'Upload DOCX Template' : `Edit Template — ${templateName}`}
                      </DialogTitle>
                      <DialogDescription className="text-[10px]">
                        {uploadStep === 1 ? 'Select a DOCX file to use as a report base.' : 'Refine the extracted content before saving.'}
                      </DialogDescription>
                    </DialogHeader>

                    {uploadStep === 1 ? (
                      <form onSubmit={handleUploadTemplate} className="space-y-4">
                        <div>
                          <Label className="text-xs">Template Name</Label>
                          <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. IT Cell Notice - X" className="h-8 text-xs mt-1" required />
                        </div>
                        <div>
                          <Label className="text-xs">Platform</Label>
                          <Select value={templatePlatform} onValueChange={setTemplatePlatform}>
                            <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Platforms</SelectItem>
                              <SelectItem value="x">X (Twitter)</SelectItem>
                              <SelectItem value="youtube">YouTube</SelectItem>
                              <SelectItem value="facebook">Facebook</SelectItem>
                              <SelectItem value="instagram">Instagram</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">DOCX File</Label>
                          <div className="mt-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => document.getElementById('template-file-input').click()}>
                            <input id="template-file-input" type="file" accept=".docx,.doc" className="hidden" onChange={(e) => setTemplateFile(e.target.files[0])} />
                            {templateFile ? (
                              <div className="flex items-center justify-center gap-2">
                                <FileText className="h-4 w-4 text-green-600" />
                                <span className="text-xs font-medium">{templateFile.name}</span>
                              </div>
                            ) : (
                              <div>
                                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                                <p className="text-xs text-muted-foreground">Click to browse or drag a .docx file</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={templateIsDefault} onCheckedChange={setTemplateIsDefault} className="scale-75" />
                          <Label className="text-xs">Set as default for this platform</Label>
                        </div>
                        <Button type="submit" className="w-full h-8 text-xs" disabled={uploading}>
                          {uploading ? 'Parsing document...' : 'Next — Parse & Edit ▸'}
                        </Button>
                      </form>
                    ) : (
                      /* Step 2: Edit parsed content */
                      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        <p className="text-[11px] text-muted-foreground mb-2">Review and edit the extracted content before saving. You can modify text, formatting, and layout.</p>

                        <div className="flex flex-1 min-h-0 border rounded-lg overflow-hidden bg-background">
                          {/* Main Editor */}
                          <div className="flex-1 min-h-0 overflow-auto relative group">
                            <RichTextEditor
                              initialContent={parsedHtml}
                              onChange={setEditedHtml}
                              minHeight="100%"
                              placeholder="Parsed document content will appear here..."
                            />
                            {!showPlaceholderGuide && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowPlaceholderGuide(true)}
                                className="absolute top-2 right-2 h-7 px-2 text-[10px] gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/50 backdrop-blur-sm z-10"
                              >
                                <HelpCircle className="h-3 w-3" /> Show Guide
                              </Button>
                            )}
                          </div>

                          {/* Placeholder Sidebar */}
                          {showPlaceholderGuide && (
                            <PlaceholderSidebar onClose={() => setShowPlaceholderGuide(false)} />
                          )}
                        </div>

                        <div className="flex gap-2 mt-3 pt-2 border-t">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setUploadStep(1)}>
                            ◂ Back
                          </Button>
                          <Button size="sm" className="h-8 text-xs flex-1" onClick={handleSaveWithEditor} disabled={uploading}>
                            {uploading ? 'Saving...' : 'Save Template'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>

              {/* Placeholder Reference */}
              <div className="border rounded-lg">
                <button onClick={() => setShowPlaceholders(!showPlaceholders)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium hover:bg-accent/50 transition-colors">
                  <span className="flex items-center gap-1.5"><BrainCircuit className="h-3.5 w-3.5" /> Placeholders Reference</span>
                  {showPlaceholders ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {showPlaceholders && (
                  <div className="px-3 pb-3 border-t">
                    <p className="text-[10px] text-muted-foreground mt-2 mb-2">For advanced control, add these placeholders in your DOCX</p>
                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { key: 'SERIAL_NUMBER', desc: 'Report serial number' },
                        { key: 'DATE', desc: 'Current date (dd.mm.yyyy)' },
                        { key: 'DATE_LONG', desc: 'Full date format' },
                        { key: 'PLATFORM', desc: 'Platform name' },
                        { key: 'PLATFORM_OPERATOR', desc: 'Platform company' },
                        { key: 'PLATFORM_DOMAIN', desc: 'Platform URL' },
                        { key: 'AUTHOR_NAME', desc: 'User display name' },
                        { key: 'AUTHOR_HANDLE', desc: 'User handle (@)' },
                        { key: 'PROFILE_URL', desc: 'Profile URL' },
                        { key: 'CONTENT_URL', desc: 'Flagged post URL' },
                        { key: 'CONTENT_TEXT', desc: 'Flagged content text' },
                        { key: 'POST_DATE', desc: 'Post publish date' },
                        { key: 'LEGAL_SECTIONS', desc: 'Full legal sections' },
                        { key: 'LEGAL_SECTIONS_NUMBERS', desc: 'Section numbers' },
                        { key: 'CATEGORY', desc: 'Alert category' },
                        { key: 'RISK_LEVEL', desc: 'Risk level' },
                        { key: 'IS_REPOST', desc: 'Repost flag (Yes/No)' },
                        { key: 'ORIGINAL_AUTHOR', desc: 'Original author' },
                        { key: 'INTENT', desc: 'Detected intent' },
                        { key: 'ALERT_DESCRIPTION', desc: 'Alert description' },
                      ].map(p => (
                        <div key={p.key} className="flex items-center gap-1.5 px-2 py-1 rounded bg-secondary/30 text-[10px]">
                          <code className="font-mono font-bold text-primary">{'{{' + p.key + '}}'}</code>
                          <span className="text-muted-foreground truncate">{p.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Template List */}
              {templates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-xs text-muted-foreground">No templates uploaded yet</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Upload any DOCX to get started — no placeholders needed!</p>
                </div>
              ) : (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-2">
                    {templates.map(t => (
                      <div key={t.id} className="group flex items-center justify-between p-3 rounded-lg border hover:border-primary/30 transition-colors bg-background">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold truncate">{t.name}</span>
                              {t.is_default && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-300 text-amber-600 shrink-0">
                                  <Star className="h-2 w-2 mr-0.5 fill-current" /> Default
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                                {t.platform === 'all' ? 'All Platforms' : t.platform.charAt(0).toUpperCase() + t.platform.slice(1)}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {(t.placeholders?.length || 0) > 0 ? `${t.placeholders.length} placeholders` : 'Auto-fill mode'}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{t.original_filename}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditTemplate(t)} title="Edit Template">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditTemplate(t)} title="View / Edit Template">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {!t.is_default && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleSetDefault(t.id)} title="Set as default">
                              <Star className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteTemplate(t.id)} title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* Template Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">Template Preview</DialogTitle>
              <DialogDescription className="sr-only">Visual preview of how the report will look with sample data.</DialogDescription>
            </DialogHeader>
            <div className="border rounded-lg p-6 bg-white text-black prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </DialogContent>
        </Dialog>

        {/* Edit Existing Template Dialog replaced by Full-Page Editor */}
      </Tabs>
    </div>
  );
};

export default Settings;