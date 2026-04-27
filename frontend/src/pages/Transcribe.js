import React, { useState, useRef } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { ScrollArea } from '../components/ui/scroll-area';
import { Badge } from '../components/ui/badge';
import { Mic, FileAudio, Video, Languages, ClipboardCopy, Download, Upload, Check, Loader2, AlertTriangle } from 'lucide-react';

const SARVAM_LANGUAGES = [
  { code: 'unknown', label: 'Auto-detect language' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'en-IN', label: 'English (India)' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'od-IN', label: 'Odia' },
  { code: 'pa-IN', label: 'Punjabi' },
];

const ACCEPTED_MEDIA = '.mp3,.wav,.mp4,.mov,.avi,.mkv,.webm,.ogg,.flac,.aac,.m4a,.m4v,.mpeg,.mpg';

const Transcribe = () => {
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('unknown');
  const [transcribing, setTranscribing] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setResult(''); setError(''); }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setResult(''); setError(''); }
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setTranscribing(true);
    setResult('');
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('language', language);
      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:5001'}/api/media-transcribe/transcribe`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: form,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || 'Transcription failed');
      setResult(data.transcript || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setTranscribing(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isVideo = file && file.type.startsWith('video/');
  const fileSizeMB = file ? (file.size / 1024 / 1024).toFixed(1) : null;

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center gap-2 mb-1">
        <Mic className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">Audio / Video Transcription</h2>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 ml-1">Powered by Sarvam AI</Badge>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Upload an audio or video file. The audio will be extracted, converted to 16kHz mono WAV, and sent to the Sarvam AI transcription API.
      </p>

      {/* Language selector */}
      <div className="flex items-center gap-3">
        <Languages className="h-4 w-4 text-muted-foreground shrink-0" />
        <Label className="text-xs font-medium w-24 shrink-0">Language</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="h-8 text-xs w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SARVAM_LANGUAGES.map(l => (
              <SelectItem key={l.code} value={l.code} className="text-xs">{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-secondary/5 hover:bg-secondary/10"
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MEDIA}
          className="hidden"
          onChange={handleFileChange}
        />
        {file ? (
          <div className="flex flex-col items-center gap-1.5">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              {isVideo ? <Video className="h-5 w-5 text-primary" /> : <FileAudio className="h-5 w-5 text-primary" />}
            </div>
            <span className="text-xs font-semibold text-center max-w-xs truncate">{file.name}</span>
            <span className="text-[10px] text-muted-foreground">{fileSizeMB} MB · {isVideo ? 'Video' : 'Audio'}</span>
            <span className="text-[10px] text-primary underline cursor-pointer">Click to change file</span>
          </div>
        ) : (
          <>
            <div className="h-10 w-10 rounded-lg bg-secondary/30 flex items-center justify-center">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-xs font-medium">Drop audio or video here</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">MP3, WAV, MP4, MOV, MKV, WebM, OGG, FLAC and more</p>
            </div>
          </>
        )}
      </div>

      {/* Transcribe button */}
      <Button
        onClick={handleTranscribe}
        disabled={!file || transcribing}
        className="w-full h-9 text-xs font-semibold"
      >
        {transcribing ? (
          <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Transcribing — this may take a minute…</>
        ) : (
          <><Mic className="h-3.5 w-3.5 mr-2" /> Transcribe</>
        )}
      </Button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Transcript</Label>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={handleCopy}>
                {copied
                  ? <><Check className="h-3 w-3 mr-1 text-green-500" /> Copied</>
                  : <><ClipboardCopy className="h-3 w-3 mr-1" /> Copy</>}
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={handleDownload}>
                <Download className="h-3 w-3 mr-1" /> Download
              </Button>
            </div>
          </div>
          <ScrollArea className="h-64 w-full rounded-lg border bg-secondary/5 p-3">
            <p className="text-xs leading-relaxed whitespace-pre-wrap">{result}</p>
          </ScrollArea>
          <p className="text-[10px] text-muted-foreground text-right">
            {result.split(/\s+/).filter(Boolean).length} words
          </p>
        </div>
      )}
    </Card>
  );
};

export default Transcribe;
