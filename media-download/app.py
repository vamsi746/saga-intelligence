from __future__ import annotations
import ssl
import zipfile
# Global workaround for SSL certificate issues on macOS (must be early)
ssl._create_default_https_context = ssl._create_unverified_context
import datetime as dt
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import threading
import uuid
import mimetypes
import urllib.request
import urllib.parse
import http.cookiejar
import re
from pytubefix import YouTube
from pathlib import Path
from typing import Any, Optional, Tuple

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
import whisper
from pydantic import BaseModel, Field, HttpUrl

PROJECT_ROOT = Path(__file__).resolve().parent
TEMP_ROOT = PROJECT_ROOT / "temp"
PERSIST_DOWNLOADS = os.getenv("PERSIST_DOWNLOADS", "0") in {"1", "true", "True"}
DOWNLOADS_ROOT = Path(
    os.getenv(
        "DOWNLOADS_ROOT",
        str(PROJECT_ROOT / "downloads" if PERSIST_DOWNLOADS else TEMP_ROOT / "downloads"),
    )
)
DB_PATH = Path(os.getenv("TRANSCRIPTS_DB_PATH", str(PROJECT_ROOT / "transcripts.sqlite3")))
TEMP_TTL_SECONDS = int(os.getenv("TEMP_TTL_SECONDS", str(6 * 60 * 60)))
DOWNLOADS_TTL_SECONDS = int(os.getenv("DOWNLOADS_TTL_SECONDS", str(7 * 24 * 60 * 60)))  # 7 days
MAX_VIDEO_SECONDS = int(os.getenv("MAX_VIDEO_SECONDS", "1800"))  # 30 minutes (increased from 5 min)
YTDLP_METADATA_TIMEOUT_SECONDS = int(os.getenv("YTDLP_METADATA_TIMEOUT_SECONDS", "30"))
YTDLP_DOWNLOAD_TIMEOUT_SECONDS = int(os.getenv("YTDLP_DOWNLOAD_TIMEOUT_SECONDS", "600"))  # 10 min timeout for longer downloads
_ENV_COOKIES = os.getenv("YTDLP_COOKIES_FILE")
DEFAULT_COOKIES_PATH = PROJECT_ROOT / "cookies.txt"
YTDLP_COOKIES_FILE = _ENV_COOKIES or (str(DEFAULT_COOKIES_PATH) if DEFAULT_COOKIES_PATH.exists() else None)
YTDLP_USER_AGENT = os.getenv(
    "YTDLP_USER_AGENT",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
)

WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
WARMUP_MODEL_ON_STARTUP = os.getenv("WARMUP_MODEL_ON_STARTUP", "1") not in {"0", "false", "False"}
_model = None
_model_lock = threading.Lock()
_model_error: Optional[str] = None

import os
import shutil
from pathlib import Path

def clean_downloads_folder(downloads_path: str):
    """
    Remove all files and folders inside the given downloads_path.
    """
    downloads_dir = Path(downloads_path)
    if downloads_dir.exists() and downloads_dir.is_dir():
        for item in downloads_dir.iterdir():
            try:
                if item.is_file() or item.is_symlink():
                    item.unlink()
                elif item.is_dir():
                    shutil.rmtree(item)
            except Exception as e:
                print(f"Failed to delete {item}: {e}")

clean_downloads_folder("./temp/downloads")

def _require_binaries() -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("ffmpeg is not available on PATH. Install with `brew install ffmpeg`.")


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = whisper.load_model(WHISPER_MODEL_NAME)
    return _model


def _ensure_model_ready() -> None:
    global _model_error
    if _model_error is not None:
        raise RuntimeError(_model_error)
    try:
        _get_model()
    except Exception as e:
        _model_error = str(e).strip() or "Failed to initialize Whisper model"
        raise


def _db_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    with _db_connect() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS transcripts (
                id TEXT PRIMARY KEY,
                youtube_url TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL,
                model TEXT NOT NULL,
                duration_seconds INTEGER,
                language TEXT,
                title TEXT,
                video_id TEXT,
                transcript TEXT,
                error TEXT
            )
            """
        )
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_transcripts_created_at ON transcripts(created_at)"
        )
        clean_downloads_folder("./temp/downloads")
        cols = {row[1] for row in conn.execute("PRAGMA table_info(transcripts)").fetchall()}
        if "duration_seconds" not in cols:
            conn.execute("ALTER TABLE transcripts ADD COLUMN duration_seconds INTEGER")


def _cleanup_temp_root() -> None:
    if not TEMP_ROOT.exists():
        return

    now = dt.datetime.now(tz=dt.timezone.utc).timestamp()
    for entry in TEMP_ROOT.iterdir():
        try:
            stat = entry.stat()
        except FileNotFoundError:
            continue

        age_seconds = max(0.0, now - stat.st_mtime)
        if age_seconds < TEMP_TTL_SECONDS:
            continue

        if entry.is_dir():
            shutil.rmtree(entry, ignore_errors=True)
        else:
            try:
                entry.unlink()
            except FileNotFoundError:
                pass
    clean_downloads_folder("./temp/downloads")


def _cleanup_downloads() -> None:
    """Clean up old downloaded videos after TTL expires."""
    if not DOWNLOADS_ROOT.exists():
        return

    now = dt.datetime.now(tz=dt.timezone.utc).timestamp()
    for entry in DOWNLOADS_ROOT.iterdir():
        try:
            stat = entry.stat()
        except FileNotFoundError:
            continue

        age_seconds = max(0.0, now - stat.st_mtime)
        if age_seconds < DOWNLOADS_TTL_SECONDS:
            continue

        try:
            entry.unlink()
        except FileNotFoundError:
            pass
    clean_downloads_folder("./temp/downloads")

def _insert_started(*, transcript_id: str, youtube_url: str) -> None:
    with _db_connect() as conn:
        conn.execute(
            """
            INSERT INTO transcripts (id, youtube_url, created_at, status, model)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                transcript_id,
                youtube_url,
                dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc).isoformat(),
                "started",
                WHISPER_MODEL_NAME,
            ),
        )

def _zip_media(files: list[Path], zip_name: str) -> Path:
    zip_path = DOWNLOADS_ROOT / zip_name
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in files:
            zf.write(file, file.name)
    return zip_path


def _set_duration_seconds(*, transcript_id: str, duration_seconds: Optional[int]) -> None:
    with _db_connect() as conn:
        conn.execute(
            "UPDATE transcripts SET duration_seconds = ? WHERE id = ?",
            (duration_seconds, transcript_id),
        )


def _update_completed(
    *,
    transcript_id: str,
    language: Optional[str],
    transcript: str,
    title: Optional[str],
    video_id: Optional[str],
) -> None:
    with _db_connect() as conn:
        conn.execute(
            """
            UPDATE transcripts
            SET status = ?, language = ?, transcript = ?, title = ?, video_id = ?, error = NULL
            WHERE id = ?
            """,
            ("completed", language, transcript, title, video_id, transcript_id),
        )


def _update_failed(*, transcript_id: str, error: str) -> None:
    with _db_connect() as conn:
        conn.execute(
            "UPDATE transcripts SET status = ?, error = ? WHERE id = ?",
            ("failed", error, transcript_id),
        )


def _is_x_url(url: str) -> bool:
    return "twitter.com" in url or "x.com" in url
    clean_downloads_folder("./temp/downloads")


def _is_instagram_url(url: str) -> bool:
    host = urllib.parse.urlparse(url).netloc.lower()
    return "instagram.com" in host or "instagr.am" in host


def _is_instagram_story_url(url: str) -> bool:
    return bool(re.search(r"instagram\.com\/stories\/", url, re.IGNORECASE))


def _is_instagram_reel_url(url: str) -> bool:
    return bool(re.search(r"instagram\.com\/reels?\/", url, re.IGNORECASE))


def _extract_instagram_media_id(url: str) -> Optional[str]:
    story_match = re.search(r"instagram\.com\/stories\/([^\/?#]+)\/([0-9]+)", url, re.IGNORECASE)
    if story_match:
        handle = re.sub(r"[^A-Za-z0-9_]", "", story_match.group(1))
        story_id = story_match.group(2)
        return f"ig_story_{handle}_{story_id}"[:96]

    reel_or_post_match = re.search(r"instagram\.com\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)", url, re.IGNORECASE)
    if reel_or_post_match:
        token = reel_or_post_match.group(1)
        if _is_instagram_reel_url(url):
            return f"ig_reel_{token}"[:96]
        return f"ig_post_{token}"[:96]

    return None


def _ytdlp_base_args(media_url: str) -> list[str]:
    is_youtube = "youtube.com" in media_url or "youtu.be" in media_url
    is_instagram = _is_instagram_url(media_url)
    args = [
        sys.executable,
        "-m",
        "yt_dlp",
        "--verbose", # TEMPORARY: for debugging 403
        "--no-playlist",
        "--force-ipv4",
        "--no-cache-dir",
    ]
    
    # For non-YouTube URLs, use our custom UA/Referer
    # YouTube often blocks if these don't match their expected fingerprints
    if not is_youtube:
        referer = "https://www.instagram.com/" if is_instagram else media_url
        args.extend([
            "--user-agent", YTDLP_USER_AGENT,
            "--referer", referer,
        ])
        if is_instagram:
            args.extend([
                "--add-header", "Origin:https://www.instagram.com",
                "--add-header", "X-IG-App-ID:936619743392459",
            ])
    else:
        # Specific extractor args for YouTube to help with 403 blocks
        args.extend(["--extractor-args", "youtube:player_client=ios,tv,web"])
        
    # Use Node.js as JS runtime if available for better extraction
    node_path = "/Users/bhaskarlekkala/.nvm/versions/node/v24.12.0/bin/node"
    if os.path.exists(node_path):
        args.extend(["--js-runtime", f"node:{node_path}"])

    if YTDLP_COOKIES_FILE:
        args.extend(["--cookies", YTDLP_COOKIES_FILE])

    if _is_x_url(media_url):
        args.extend(["--extractor-args", "twitter:api=syndication"])
    return args


def _ytdlp_dump_metadata(media_url: str) -> Tuple[Optional[dict[str, Any]], Optional[str]]:
    try:
        args = _ytdlp_base_args(media_url) + ["--dump-single-json", media_url]
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            check=True,
            timeout=YTDLP_METADATA_TIMEOUT_SECONDS,
        )
        return json.loads(result.stdout), None
    except Exception as exc:
        err = None
        if hasattr(exc, "stderr") and exc.stderr:
            err = str(exc.stderr).strip()
        elif hasattr(exc, "stdout") and exc.stdout:
            err = str(exc.stdout).strip()
        else:
            err = str(exc).strip()
        return None, err


def _extract_tweet_id(url: str) -> Optional[str]:
    clean_downloads_folder("./temp/downloads")
    match = re.search(r"/status/(\d+)", url)
    if match:
        return match.group(1)
    return None


def _fetch_x_syndication(tweet_id: str) -> Optional[dict[str, Any]]:
    clean_downloads_folder("./temp/downloads")
    try:
        syndication_url = f"https://cdn.syndication.twimg.com/tweet-result?id={tweet_id}"
        req = urllib.request.Request(syndication_url, headers={"User-Agent": YTDLP_USER_AGENT})
        with _urllib_open(req) as response:
            data = response.read().decode("utf-8")
        return json.loads(data)
    except Exception:
        return None
    clean_downloads_folder("./temp/downloads")


def _extract_media_items(payload: dict[str, Any], prefix: str) -> list[tuple[str, str, str]]:
    """
    Extract media items (images/videos) from a Tweet payload.
    Returns: list of (url, type, filename_stem)
    """
    items = []
    # 1. Look in mediaDetails (standard location)
    media_objects = payload.get("mediaDetails") \
        or (payload.get("entities") or {}).get("media") \
        or []

    for idx, media in enumerate(media_objects, start=1):
        m_type = media.get("type")
        if m_type == "photo":
            url = media.get("media_url_https") or media.get("media_url")
            if url:
                items.append((url, "photo", f"{prefix}_img_{idx}"))
        elif m_type in {"video", "animated_gif"}:
            variants = media.get("video_info", {}).get("variants", [])
            # Prefer mp4, high bitrate
            mp4s = [v for v in variants if v.get("content_type") == "video/mp4"]
            if mp4s:
                best = max(mp4s, key=lambda v: v.get("bitrate", 0) or 0)
                if best.get("url"):
                    items.append((best.get("url"), "video", f"{prefix}_vid_{idx}"))

    return items


def _download_from_x_syndication(payload: dict[str, Any], tweet_id: str) -> list[Path]:
    DOWNLOADS_ROOT.mkdir(parents=True, exist_ok=True)
    downloaded: list[Path] = []
    
    tasks = []
    
    # 1. Main Tweet Media
    tasks.extend(_extract_media_items(payload, f"{tweet_id}"))

    # 2. Quoted Tweet Media (Nested)
    quoted = payload.get("quoted_tweet")
    if quoted:
        q_id = quoted.get("id_str") or "quoted"
        tasks.extend(_extract_media_items(quoted, f"{tweet_id}_quote_{q_id}"))

    # 3. Retweeted Status (Often syndication returns the original tweet as the main object with a 'retweeted_status' field if it's a RT)
    retweeted = payload.get("retweeted_status")
    if retweeted:
        r_id = retweeted.get("id_str") or "retweet"
        tasks.extend(_extract_media_items(retweeted, f"{tweet_id}_rt_{r_id}"))

        # Re-check quoted inside retweet
        rt_quoted = retweeted.get("quoted_tweet")
        if rt_quoted:
             rq_id = rt_quoted.get("id_str") or "rt_quoted"
             tasks.extend(_extract_media_items(rt_quoted, f"{tweet_id}_rt_quote_{rq_id}"))

    # 4. Check 'parent' field (Thread/Reply context sometimes)
    parent = payload.get("parent")
    if parent:
        p_id = parent.get("id_str") or "parent"
        tasks.extend(_extract_media_items(parent, f"{tweet_id}_parent_{p_id}"))
    
    # 5. Check if the payload itself IS the retweet (some endpoints return data of original)
    # If the payload has no media, but has a "source" that might be relevant? 
    # Usually syndication returns what is displayed.
    
    # Dedup by URL to avoid downloading same file twice
    unique_tasks = {}
    for url, mtype, stem in tasks:
        if url not in unique_tasks:
            unique_tasks[url] = (mtype, stem)
    
    for url, (mtype, stem) in unique_tasks.items():
        try:
            # For images, verify ?name=orig
            final_url = url
            if mtype == "photo":
                if "?" in final_url:
                    final_url += "&name=orig"
                else:
                    final_url += "?name=orig"
                ext = ".jpg"
            else:
                ext = ".mp4"

            # Try to keep original extension if present in URL path
            path_part = url.split("?")[0]
            if path_part.endswith((".png", ".jpg", ".jpeg", ".webp")):
                ext = Path(path_part).suffix

            filename = f"{stem}{ext}"
            dest = DOWNLOADS_ROOT / filename
            _download_url_to_file(final_url, dest)
            downloaded.append(dest)
        except Exception as e:
            print(f"Failed X download {url}: {e}")

    return downloaded

def _duration_seconds_from_metadata(metadata: Optional[dict[str, Any]]) -> Optional[int]:
    if not isinstance(metadata, dict):
        return None
    duration = metadata.get("duration")
    if isinstance(duration, int) and duration > 0:
        return duration
    if isinstance(duration, float) and duration > 0:
        return int(duration)
    return None


def _ytdlp_download_audio_mp3(*, youtube_url: str, work_dir: Path, uid: str) -> Path:
    output_template = str(work_dir / f"{uid}.%(ext)s")
    subprocess.run(
        [
            sys.executable,
            "-m",
            "yt_dlp",
            "--no-playlist",
            "-f",
            "bestaudio/best",
            "-x",
            "--audio-format",
            "mp3",
            "--audio-quality",
            "0",
            "-o",
            output_template,
            youtube_url,
        ],
        check=True,
        timeout=YTDLP_DOWNLOAD_TIMEOUT_SECONDS,
    )

    expected = work_dir / f"{uid}.mp3"
    if expected.exists():
        return expected

    matches = list(work_dir.glob(f"{uid}.*"))
    if matches:
        return matches[0]

    raise RuntimeError("yt-dlp finished but the audio file was not found")


def _ytdlp_download_video(*, media_url: str, video_id: str) -> Path:
    clean_downloads_folder("./temp/downloads")
    """Download video to persistent downloads folder."""
    DOWNLOADS_ROOT.mkdir(parents=True, exist_ok=True)
    
    # Check if already downloaded
    existing = list(DOWNLOADS_ROOT.glob(f"{video_id}.*"))
    video_extensions = {'.mp4', '.webm', '.mkv', '.avi', '.mov'}
    for f in existing:
        if f.suffix.lower() in video_extensions:
            return f
    
    output_template = str(DOWNLOADS_ROOT / f"{video_id}.%(ext)s")
    args = _ytdlp_base_args(media_url) + [
        "-f",
        "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "--merge-output-format",
        "mp4",
        "-o",
        output_template,
        media_url,
    ]
    try:
        subprocess.run(
            args,
            capture_output=True,
            check=True,
            timeout=YTDLP_DOWNLOAD_TIMEOUT_SECONDS * 2,  # Video takes longer
        )
    except subprocess.CalledProcessError as e:
        # Cleanup partial files on failure to avoid 403 session-resume issues
        for p in DOWNLOADS_ROOT.glob(f"{video_id}.*"):
            try:
                if p.suffix.lower() in {'.part', '.ytdl'}:
                    p.unlink()
            except: 
                pass
        raise e

    # Find the downloaded file
    matches = list(DOWNLOADS_ROOT.glob(f"{video_id}.*"))
    for f in matches:
        if f.suffix.lower() in video_extensions:
            return f

    raise RuntimeError("yt-dlp finished but the video file was not found")


def _pytubefix_download_video(media_url: str, video_id: str) -> DownloadResponse:
    """Download YouTube video using pytubefix."""
    clean_downloads_folder("./temp/downloads")
    yt = YouTube(media_url)
    title = yt.title
    duration_seconds = yt.length
    
    # Check duration limit
    if duration_seconds and duration_seconds > MAX_VIDEO_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"Video too long ({duration_seconds}s). Max allowed is {MAX_VIDEO_SECONDS}s (5 minutes).",
        )
    
    # Try to get best progressive mp4 stream
    stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
    if not stream:
        # Fallback to any mp4 stream
        stream = yt.streams.filter(file_extension='mp4').order_by('resolution').desc().first()
    
    if not stream:
        raise RuntimeError("No suitable mp4 stream found via pytubefix")
        
    DOWNLOADS_ROOT.mkdir(parents=True, exist_ok=True)
    filename = f"{video_id}.mp4"
    dest = DOWNLOADS_ROOT / filename
    
    stream.download(output_path=str(DOWNLOADS_ROOT), filename=filename)
    
    return DownloadResponse(
        video_id=video_id,
        filename=filename,
        download_url=f"/videos/{video_id}",
        title=title,
        duration_seconds=duration_seconds,
    )


def _download_url_to_file(url: str, dest_path: Path) -> None:
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": YTDLP_USER_AGENT})
    with _urllib_open(req) as response:
        dest_path.write_bytes(response.read())


def _urllib_open(req: urllib.request.Request):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    if not YTDLP_COOKIES_FILE:
        return urllib.request.urlopen(req, context=ctx)
    jar = http.cookiejar.MozillaCookieJar(YTDLP_COOKIES_FILE)
    try:
        jar.load(ignore_discard=True, ignore_expires=True)
    except Exception:
        return urllib.request.urlopen(req, context=ctx)
    
    opener = urllib.request.build_opener(
        urllib.request.HTTPCookieProcessor(jar),
        urllib.request.HTTPSHandler(context=ctx)
    )
    return opener.open(req)


def _pick_best_thumbnail(thumbnails: list[dict[str, Any]]) -> Optional[str]:
    if not thumbnails:
        return None
    best = None
    best_score = -1
    for t in thumbnails:
        url = t.get("url")
        if not url:
            continue
        width = t.get("width") or 0
        height = t.get("height") or 0
        score = width * height
        if score >= best_score:
            best = url
            best_score = score
    return best


def _download_images_from_metadata(metadata: dict[str, Any], media_id: str) -> list[Path]:
    image_urls: list[str] = []

    # Try direct thumbnails
    thumbs = metadata.get("thumbnails") or []
    best_thumb = _pick_best_thumbnail(thumbs)
    if best_thumb:
        image_urls.append(best_thumb)

    # Try gallery/entries (multiple images)
    entries = metadata.get("entries") or []
    for entry in entries:
        entry_thumbs = entry.get("thumbnails") or []
        entry_best = _pick_best_thumbnail(entry_thumbs)
        if entry_best:
            image_urls.append(entry_best)

    # Deduplicate
    image_urls = list(dict.fromkeys(image_urls))

    downloaded: list[Path] = []
    for idx, url in enumerate(image_urls):
        ext = Path(url).suffix or ".jpg"
        filename = f"{media_id}_{idx + 1}{ext}"
        dest = DOWNLOADS_ROOT / filename
        _download_url_to_file(url, dest)
        downloaded.append(dest)

    return downloaded


def _has_video_in_metadata(metadata: dict[str, Any]) -> bool:
    formats = metadata.get("formats") or []
    video_exts = {"mp4", "webm", "mkv", "avi", "mov"}
    return any(
        f.get("vcodec") not in (None, "none") or (f.get("ext") in video_exts)
        for f in formats
    )


def _transcribe_audio(audio_path: Path) -> Tuple[Optional[str], str]:
    model = _get_model()
    result = model.transcribe(str(audio_path))
    transcript = result.get("text", "").strip()
    language = result.get("language")
    return language, transcript


app = FastAPI(title="Media Analyzer", version="0.1.0")

# Add CORS middleware to allow cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins - adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],  # Allow browsers to see the filename header
)


@app.on_event("startup")
def _startup() -> None:
    TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    DOWNLOADS_ROOT.mkdir(parents=True, exist_ok=True)
    _cleanup_temp_root()
    if PERSIST_DOWNLOADS:
        _cleanup_downloads()
    _init_db()
    _require_binaries()
    if WARMUP_MODEL_ON_STARTUP:
        try:
            _ensure_model_ready()
        except Exception:
            # Keep the API up so /health can report the issue clearly.
            pass


class TranscribeRequest(BaseModel):
    youtube_url: HttpUrl = Field(..., description="YouTube URL to transcribe")


class TranscribeResponse(BaseModel):
    transcript_id: str
    youtube_url: str
    title: Optional[str] = None
    video_id: Optional[str] = None
    duration_seconds: Optional[int] = None
    language: Optional[str] = None
    transcript: str


@app.get("/health")
def health() -> dict[str, str]:
    print("DEBUG: Health check called")
    model_status = "ready"
    if _model is None:
        model_status = "not_loaded"
    if _model_error is not None:
        model_status = "error"
    return {"status": "ok", "model": model_status}


@app.post("/cookies")
def upload_cookies(file: UploadFile = File(...)) -> dict[str, str]:
    """Upload a Netscape cookies.txt for X/Twitter access."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    if not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Cookies file must be .txt")
    content = file.file.read()
    DEFAULT_COOKIES_PATH.write_bytes(content)
    global YTDLP_COOKIES_FILE
    YTDLP_COOKIES_FILE = str(DEFAULT_COOKIES_PATH)
    return {"status": "ok", "cookies_path": str(DEFAULT_COOKIES_PATH)}


@app.post("/transcribe", response_model=TranscribeResponse)
def transcribe(req: TranscribeRequest) -> TranscribeResponse:
    if _model_error is not None:
        raise HTTPException(
            status_code=503,
            detail=f"Model not available: {_model_error}",
        )

    transcript_id = str(uuid.uuid4())
    youtube_url = str(req.youtube_url)

    _insert_started(transcript_id=transcript_id, youtube_url=youtube_url)

    metadata = _ytdlp_dump_metadata(youtube_url)
    title = metadata.get("title") if isinstance(metadata, dict) else None
    video_id = metadata.get("id") if isinstance(metadata, dict) else None
    duration_seconds = _duration_seconds_from_metadata(metadata)
    _set_duration_seconds(transcript_id=transcript_id, duration_seconds=duration_seconds)

    if duration_seconds is None:
        _update_failed(
            transcript_id=transcript_id,
            error="Unable to determine video duration; rejecting per policy",
        )
        raise HTTPException(
            status_code=400,
            detail="Unable to determine video duration; this service only accepts videos <= 5 minutes.",
        )

    if duration_seconds > MAX_VIDEO_SECONDS:
        _update_failed(
            transcript_id=transcript_id,
            error=f"Video too long: {duration_seconds}s > {MAX_VIDEO_SECONDS}s",
        )
        raise HTTPException(
            status_code=400,
            detail=f"Video too long ({duration_seconds}s). Max allowed is {MAX_VIDEO_SECONDS}s (5 minutes).",
        )

    try:
        with tempfile.TemporaryDirectory(prefix="media-analyzer-", dir=TEMP_ROOT) as tmp:
            work_dir = Path(tmp)
            audio_path = _ytdlp_download_audio_mp3(youtube_url=youtube_url, work_dir=work_dir, uid=transcript_id)
            language, transcript_text = _transcribe_audio(audio_path)

        _update_completed(
            transcript_id=transcript_id,
            language=language,
            transcript=transcript_text,
            title=title,
            video_id=video_id,
        )

        return TranscribeResponse(
            transcript_id=transcript_id,
            youtube_url=youtube_url,
            title=title,
            video_id=video_id,
            duration_seconds=duration_seconds,
            language=language,
            transcript=transcript_text,
        )
    except subprocess.CalledProcessError as e:
        error = (e.stderr or str(e)).strip() or "external command failed"
        _update_failed(transcript_id=transcript_id, error=error)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {error}")
    except Exception as e:
        error = str(e).strip() or "unknown error"
        _update_failed(transcript_id=transcript_id, error=error)
        raise HTTPException(status_code=500, detail=f"Transcription failed: {error}")


@app.post("/analyze", response_model=TranscribeResponse)
def analyze_video(req: TranscribeRequest) -> TranscribeResponse:
    return transcribe(req)


@app.get("/transcripts/{transcript_id}")
def get_transcript(transcript_id: str) -> dict[str, Any]:
    with _db_connect() as conn:
        row = conn.execute("SELECT * FROM transcripts WHERE id = ?", (transcript_id,)).fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="Transcript not found")

    return dict(row)


class DownloadRequest(BaseModel):
    url: Optional[HttpUrl] = Field(None, description="Media URL to download (YouTube/X/etc)")
    media_url: Optional[HttpUrl] = Field(None, description="Media URL to download")
    youtube_url: Optional[HttpUrl] = Field(None, description="Legacy YouTube URL")
    content_url: Optional[HttpUrl] = Field(None, description="Legacy content URL")
    video_id: Optional[str] = Field(None, description="Optional video ID for filename")


class DownloadResponse(BaseModel):
    video_id: str
    filename: str
    download_url: str
    title: Optional[str] = None
    duration_seconds: Optional[int] = None


class DownloadImagesRequest(BaseModel):
    clean_downloads_folder("./temp/downloads")
    image_urls: list[HttpUrl] = Field(..., description="List of image URLs to download")
    content_id: Optional[str] = Field(None, description="Content ID for filename prefix")


class DownloadImagesResponse(BaseModel):
    clean_downloads_folder("./temp/downloads")
    items: list[DownloadResponse]
    media_count: int


@app.post("/download-images", response_model=DownloadImagesResponse)
def download_images(req: DownloadImagesRequest) -> DownloadImagesResponse:
    clean_downloads_folder("./temp/downloads")
    """Download multiple images and return their metadata."""
    if not req.image_urls:
        raise HTTPException(status_code=400, detail="image_urls list is required")

    DOWNLOADS_ROOT.mkdir(parents=True, exist_ok=True)
    content_id = req.content_id or str(uuid.uuid4())[:8]
    downloaded_items = []

    for idx, url in enumerate(req.image_urls):
        url_str = str(url)
        # Normalize Twitter images
        if "pbs.twimg.com" in url_str and "name=" not in url_str:
            url_str = f"{url_str}{'&' if '?' in url_str else '?'}name=orig"

        try:
            # Determine extension
            ext = Path(url_str.split('?')[0]).suffix or ".jpg"
            if ext.lower() not in {'.jpg', '.jpeg', '.png', '.gif', '.webp'}:
                ext = ".jpg"

            media_id = f"{content_id}_{idx + 1}"
            filename = f"{media_id}{ext}"
            dest = DOWNLOADS_ROOT / filename

            _download_url_to_file(url_str, dest)

            downloaded_items.append(DownloadResponse(
                video_id=media_id,
                filename=filename,
                download_url=f"/videos/{media_id}",
                title=f"Image {idx + 1}"
            ))
        except Exception as e:
            print(f"Failed to download image {url_str}: {e}")
            continue

    if not downloaded_items:
        raise HTTPException(status_code=400, detail="Failed to download any images")

    return DownloadImagesResponse(
        items=downloaded_items,
        media_count=len(downloaded_items)
    )


@app.post("/download", response_model=DownloadResponse)
def download_video(req: DownloadRequest) -> DownloadResponse:
    clean_downloads_folder("./temp/downloads")
    """Download a video and return download URL for admin access."""
    media_url = req.url or req.media_url or req.youtube_url or req.content_url
    if not media_url:
        raise HTTPException(status_code=400, detail="media url is required")
    media_url = str(media_url)
    is_youtube = "youtube.com" in media_url or "youtu.be" in media_url
    is_instagram = _is_instagram_url(media_url)

    # Generate a sensible video_id earlier
    video_id = req.video_id or str(uuid.uuid4())[:8]
    video_id_from_instagram_url = False
    if is_youtube:
        import re
        match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", media_url)
        if match:
            video_id = match.group(1)
    elif is_instagram:
        parsed_instagram_id = _extract_instagram_media_id(media_url)
        if parsed_instagram_id:
            video_id = parsed_instagram_id
            video_id_from_instagram_url = True
    
    if is_youtube:
        try:
            return _pytubefix_download_video(media_url, video_id)
        except Exception as e:
            print(f"Pytubefix failed for {media_url}: {e}. Falling back to yt-dlp...")
            # Fall through to yt-dlp

    # Prioritize custom X logic to ensure "everything" (quoted tweets, multiple media) is captured
    # yt-dlp often misses quoted media or requires complex config
    if _is_x_url(media_url):
        tweet_id = _extract_tweet_id(media_url)
        if not tweet_id:
            raise HTTPException(status_code=400, detail="Invalid tweet URL")

        payload = _fetch_x_syndication(tweet_id)
        if not payload:
             # If syndication fails (e.g. sensitive/age-gated), try yt-dlp as fallback if cookies present, 
             # otherwise error.
             # But if cookies are present, yt-dlp uses them. 
             # Can we use yt-dlp if this fails? Yes.
             pass 
        else:
            files = _download_from_x_syndication(payload, tweet_id)
            if files:
                # Success via custom logic
                if len(files) == 1:
                    media_path = files[0]
                else:
                    media_path = _zip_media(files, f"{tweet_id}_all_media.zip")

                return DownloadResponse(
                    video_id=tweet_id,
                    filename=media_path.name,
                    download_url=f"/videos/{media_path.stem}",
                    title=payload.get("text"),
                    duration_seconds=None,
                )
            # If payload found but no files, maybe it's text-only. 
            # Check if we should fall through to yt-dlp? 
            # Probably not, since our custom logic is thorough.
            # But let's fall through just in case.

    # Get metadata first (Generic / yt-dlp fallback)
    metadata, metadata_error = _ytdlp_dump_metadata(media_url)
    
    # Check if we should fallback to custom X syndication logic (Legacy check or if first attempt failed)
    # If we already tried above and failed (payload is None), we are here.
    should_fallback_x = False
    if _is_x_url(media_url) and not metadata:
        should_fallback_x = True # Try again? No, we already tried.

    # Simplify: If X logic above succeeded, we returned.
    # If we are here, either it's not X, OR X syndication failed/found nothing.
    # So we proceed with yt-dlp.

    if not metadata:
        detail = "Could not fetch video metadata"
        if is_instagram:
            detail = "Could not fetch Instagram media metadata"
            lowered = (metadata_error or "").lower()
            if _is_instagram_story_url(media_url) and any(token in lowered for token in ["not found", "404", "expired", "unavailable"]):
                detail = "Instagram story is unavailable or expired"
            elif any(token in lowered for token in ["private", "login", "sign in", "forbidden", "403"]):
                detail = "Instagram media is private or requires authentication"
        if metadata_error:
            detail = f"{detail}: {metadata_error}"
        raise HTTPException(status_code=400, detail=detail)

    metadata_video_id = metadata.get("id")
    if metadata_video_id and not video_id_from_instagram_url:
        video_id = metadata_video_id

    title = metadata.get("title")
    duration_seconds = _duration_seconds_from_metadata(metadata)
    
    # Check duration limit
    if duration_seconds and duration_seconds > MAX_VIDEO_SECONDS:
        raise HTTPException(
            status_code=400,
            detail=f"Video too long ({duration_seconds}s). Max allowed is {MAX_VIDEO_SECONDS}s (5 minutes).",
        )
    
    try:
        entries = metadata.get("entries") or []
        if entries:
            downloaded_files: list[Path] = []
            for idx, entry in enumerate(entries):
                # Prefer entry.get("url") over webpage_url because webpage_url often 
                # points back to the main post, causing duplicates.
                entry_url = entry.get("url") or entry.get("webpage_url") or media_url
                entry_id = f"{video_id}_{idx + 1}"
                if _has_video_in_metadata(entry):
                    downloaded_files.append(_ytdlp_download_video(media_url=entry_url, video_id=entry_id))
                else:
                    downloaded_files.extend(_download_images_from_metadata(entry, entry_id))

            if not downloaded_files:
                raise HTTPException(status_code=400, detail="No downloadable media found in post")

            if len(downloaded_files) == 1:
                media_path = downloaded_files[0]
            else:
                zip_path = DOWNLOADS_ROOT / f"{video_id}.zip"
                with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                    for file_path in downloaded_files:
                        zf.write(file_path, file_path.name)
                media_path = zip_path
        else:
            if not _has_video_in_metadata(metadata):
                images = _download_images_from_metadata(metadata, video_id)
                if not images:
                    raise HTTPException(status_code=400, detail="No downloadable media found in post")

                if len(images) == 1:
                    media_path = images[0]
                else:
                    zip_path = DOWNLOADS_ROOT / f"{video_id}.zip"
                    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
                        for img in images:
                            zf.write(img, img.name)
                    media_path = zip_path
            else:
                media_path = _ytdlp_download_video(media_url=media_url, video_id=video_id)

        return DownloadResponse(
            video_id=video_id,
            filename=media_path.name,
            download_url=f"/videos/{video_id}",
            title=title,
            duration_seconds=duration_seconds,
        )
    except subprocess.CalledProcessError as e:
        raw_error = e.stderr or e.stdout or str(e)
        if isinstance(raw_error, (bytes, bytearray)):
            error = raw_error.decode(errors="ignore").strip() or "Download failed"
        else:
            error = str(raw_error).strip() or "Download failed"
        lowered = error.lower()
        if is_instagram and any(token in lowered for token in ["private", "login", "sign in", "forbidden", "403", "story"]):
            raise HTTPException(status_code=400, detail=f"Instagram media is unavailable: {error}")
        raise HTTPException(status_code=500, detail=f"Download failed: {error}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)}")


@app.get("/videos/{video_id}")
def serve_video(video_id: str):
    """Serve a downloaded media file for admin download."""
    # Sanitize video_id to prevent path traversal (allow dots for extensions)
    safe_video_id = "".join(c for c in video_id if c.isalnum() or c in "-_.")
    if not safe_video_id:
        raise HTTPException(status_code=400, detail="Invalid video ID")
    
    # Prioritize exact matches to avoid prefix collisions (e.g. abc_1 matching abc_10)
    # Try exact filename matches first
    matches = list(DOWNLOADS_ROOT.glob(safe_video_id))
    if not matches:
        # Match by stem (filename without extension)
        matches = [f for f in DOWNLOADS_ROOT.iterdir() if f.is_file() and f.stem == safe_video_id]
    if not matches:
        # Fallback to prefix match as last resort
        matches = list(DOWNLOADS_ROOT.glob(f"{safe_video_id}*"))
        
    for media_path in matches:
        if media_path.is_file() and not media_path.name.endswith(('.part', '.ytdl')):
            media_type, _ = mimetypes.guess_type(media_path.name)
            
            # Additional mime mapping for common formats if lookup fails or returns generic
            if not media_type or media_type == "application/octet-stream":
                ext_map = {
                    '.mp4': 'video/mp4',
                    '.webm': 'video/webm',
                    '.mkv': 'video/x-matroska',
                    '.avi': 'video/x-msvideo',
                    '.mov': 'video/quicktime',
                    '.zip': 'application/zip',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.webp': 'image/webp'
                }
                media_type = ext_map.get(media_path.suffix.lower(), media_type or "application/octet-stream")

            return FileResponse(
                path=str(media_path),
                filename=media_path.name,
                media_type=media_type,
            )
    
    raise HTTPException(status_code=404, detail="Video not found. It may have been cleaned up or not yet downloaded.")


@app.post("/download-direct")
def download_video_direct(req: DownloadRequest):
    clean_downloads_folder("./temp/downloads")
    """Stream a YouTube video directly to the user without saving to disk."""
    media_url = req.url or req.media_url or req.youtube_url or req.content_url
    if not media_url:
        raise HTTPException(status_code=400, detail="media url is required")
    media_url = str(media_url)
    is_youtube = "youtube.com" in media_url or "youtu.be" in media_url

    if not is_youtube:
        raise HTTPException(status_code=400, detail="Only YouTube direct streaming is supported.")

    import re
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", media_url)
    video_id = match.group(1) if match else str(uuid.uuid4())[:8]

    yt = YouTube(media_url)
    stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
    if not stream:
        raise HTTPException(status_code=404, detail="No suitable mp4 stream found via pytubefix")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
        temp_path = tmp_file.name
    stream.download(output_path=os.path.dirname(temp_path), filename=os.path.basename(temp_path))

    def iterfile():
        with open(temp_path, mode="rb") as file_like:
            yield from file_like
        try:
            os.remove(temp_path)
        except Exception as e:
            print(f"Error deleting temp file {temp_path}: {e}")

    return StreamingResponse(
        iterfile(),
        media_type="video/mp4",
        headers={
            "Content-Disposition": f"attachment; filename=\"{yt.title}.mp4\""
        }
    )
