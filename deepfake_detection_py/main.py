import os
import cv2
import torch
import torch.nn as nn
import numpy as np
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from typing import Dict, List
import shutil
import tempfile
from facenet_pytorch import MTCNN
from model import get_model
from torchvision import transforms, models
from PIL.ExifTags import TAGS
import subprocess
from video_inference import run_forensic_video_analysis, PreemptedException
import base64
import io
from fastapi.staticfiles import StaticFiles
from urllib.parse import unquote
import re
import sys

import time
import threading

app = FastAPI(title="Deepfake Guard AI - In-House ML Service")

# --- GPU PRIORITY LOCK (Prioritizes UI over Batch processing) ---
from contextlib import asynccontextmanager

# When set, long-running batch GPU work should abort so the UI request can run.
batch_preempt = threading.Event()

class PriorityLock:
    def __init__(self):
        self.queue = asyncio.PriorityQueue()
        self.counter = 0
        self.locked = False
        self.current_priority = None  # track who holds the lock
        
    @asynccontextmanager
    async def acquire(self, priority: int):
        event = asyncio.Event()
        self.counter += 1
        
        if not self.locked and self.queue.empty():
            self.locked = True
            self.current_priority = priority
            event.set()
        else:
            # If a high-priority request arrives while a lower-priority job holds the lock,
            # signal the batch to abort its current item so the lock is released sooner.
            if self.current_priority is not None and priority < self.current_priority:
                batch_preempt.set()
            await self.queue.put((priority, self.counter, event))
            await event.wait()
            self.current_priority = priority
            
        try:
            yield
        finally:
            self.current_priority = None
            if self.queue.empty():
                self.locked = False
            else:
                _, _, next_event = self.queue.get_nowait()
                next_event.set()

gpu_lock = PriorityLock()

# ---AUTO-CLEANUP MONITOR (1-MINUTE POLICY) ---
def forensic_cleanup_task():
    """
    Background thread that deletes forensic previews older than 15 minutes.
    Frames need time to load, cache, and be viewed in the frontend report.
    """
    while True:
        try:
            now = time.time()
            path = "static/forensics"
            if os.path.exists(path):
                for f in os.listdir(path):
                    if f.startswith("ui_preview_"):
                        f_path = os.path.join(path, f)
                        # Delete if older than 120 seconds (2 minutes)
                        if now - os.path.getmtime(f_path) > 120:
                            try:
                                os.remove(f_path)
                                # print(f"[*] Auto-cleanup: Removed {f}")
                            except: pass
        except Exception as e:
            print(f"[!] Cleanup Error: {e}")
        time.sleep(30) # Check every 30s

# Start background cleanup
threading.Thread(target=forensic_cleanup_task, daemon=True).start()

# Create static directory if it doesn't exist
os.makedirs("static/forensics", exist_ok=True)

# Mount static files to serve forensic previews
app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
WEIGHTS_PATH = "xception_spatial.pth"
IMAGE_WEIGHTS_TEXTURE_PATH = "image_detector_v4_realworld.pth"
IMAGE_WEIGHTS_FREQ_PATH = "image_detector_v5_frequency.pth"
TEMPORAL_WEIGHTS_PATH = "video_temporal_model.pth"
IMAGE_SIZE = 224
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Initialize Models
print(f"[*] Initializing In-House System on {DEVICE}...")

# 1. Face Detector (MTCNN) - Only for bounding boxes
mtcnn = MTCNN(keep_all=False, device=DEVICE)

def robust_load_weights(model, path, device="cpu"):
    """
    Handles state_dict key mismatches (e.g., 'backbone.' prefixes or 'head' vs 'fc' names).
    """
    if not os.path.exists(path):
        return False
    
    print(f"[*] Loading weights from {path}...")
    state_dict = torch.load(path, map_location=device)
    
    # Handle nested state dicts
    if isinstance(state_dict, dict) and 'model_state_dict' in state_dict:
        state_dict = state_dict['model_state_dict']
    
    new_state_dict = {}
    for k, v in state_dict.items():
        name = k
        if k.startswith('backbone.'):
            name = k[9:] # remove 'backbone.'
        if k.startswith('model.'):
            name = k[6:] # remove 'model.'
            
        new_state_dict[name] = v
        
    try:
        model.load_state_dict(new_state_dict, strict=False)
        return True
    except Exception as e:
        print(f"[!] Warning: loading failed. Error: {e}")
        return False

# 2. Xception Classifier - STRICT IN-HOUSE LOADING
model = get_model(pretrained=False) # Architecture only
if robust_load_weights(model, WEIGHTS_PATH, DEVICE):
    print(f"[*] Xception initialized successfully.")
else:
    # Strictly forbid startup to ensure "True In-House" compliance
    print(f"[!] In-house weights not found: {WEIGHTS_PATH}")
    raise RuntimeError(f"Weights missing at {WEIGHTS_PATH}")

model = model.to(DEVICE)
model.eval()

# --- FREQUENCY/NOISE EXTRACTION FOR ENSEMBLE ---

class NoiseResidual(object):
    """
    Extracts high-frequency noise fingerprints. 
    Crucial for catching photorealistic AI images.
    """
    def __call__(self, img):
        from PIL import ImageFilter
        img_np = np.array(img).astype(np.float32)
        img_blur = np.array(img.filter(ImageFilter.MedianFilter(size=3))).astype(np.float32)
        residual = img_np - img_blur
        residual = np.clip(residual + 128, 0, 255).astype(np.uint8)
        return Image.fromarray(residual)

# 3. Image Ensemble Modules
def get_image_model(model_type="b4"):
    if model_type == "b4":
        m = models.efficientnet_b4(weights=None)
        num_ftrs = m.classifier[1].in_features
        m.classifier[1] = nn.Sequential(nn.Dropout(0.3), nn.Linear(num_ftrs, 1))
    else: # model_type == "b0" for frequency
        m = models.efficientnet_b0(weights=None)
        num_ftrs = m.classifier[1].in_features
        m.classifier[1] = nn.Sequential(nn.Dropout(0.3), nn.Linear(num_ftrs, 1))
    return m.to(DEVICE)

# Model A: Texture/Artifact Guard
image_model_texture = get_image_model("b4")
if os.path.exists(IMAGE_WEIGHTS_TEXTURE_PATH):
    print(f"[*] Loaded Detector A (Texture): {IMAGE_WEIGHTS_TEXTURE_PATH}")
    image_model_texture.load_state_dict(torch.load(IMAGE_WEIGHTS_TEXTURE_PATH, map_location=DEVICE))
else:
    print(f"[!] Image weights not found: {IMAGE_WEIGHTS_TEXTURE_PATH}. Texture detection might be suboptimal.")
image_model_texture.eval()

# Model B: Frequency-Domain Guard
image_model_freq = get_image_model("b0")
if os.path.exists(IMAGE_WEIGHTS_FREQ_PATH):
    print(f"[*] Loaded Detector B (Frequency): {IMAGE_WEIGHTS_FREQ_PATH}")
    image_model_freq.load_state_dict(torch.load(IMAGE_WEIGHTS_FREQ_PATH, map_location=DEVICE))
else:
    print(f"[!] Image weights not found: {IMAGE_WEIGHTS_FREQ_PATH}. Frequency detection might be suboptimal.")
image_model_freq.eval()

# Image Preprocessing Transform
preprocess = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def get_robust_cap(path):
    """
    Attempt to open video. If OpenCV fails to read a frame (common with modern 
    codecs like AV1), use ffmpeg to transcode to H264 on the fly.
    """
    cap = cv2.VideoCapture(path)
    if cap.isOpened():
        ret, _ = cap.read()
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        if ret:
            return cap, path
    
    import time, random, string
    rand_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
    
    # If path is a URL, don't use it directly as a filename for compat
    if path.startswith("http"):
        compat_path = os.path.join(tempfile.gettempdir(), f"hls_transcode_{int(time.time())}_{rand_id}.mp4")
    else:
        compat_path = path + f"_{rand_id}_compat.mp4"

    try:
        print(f"[*] Detection fail / HLS manifest. Attempting ffmpeg recovery for: {path}")
        # Add -headers to handle potential user-agent issues for Twitter
        cmd = ["ffmpeg", "-i", path, "-c:v", "libx264", "-preset", "ultrafast", "-y", compat_path]
        subprocess.run(cmd, check=True, capture_output=True)
        new_cap = cv2.VideoCapture(compat_path)
        if new_cap.isOpened():
            return new_cap, compat_path
    except Exception as e:
        print(f"[!] Forensic transcoding failure: {e}")
    
    return cap, path


def download_social_video_with_ytdlp(url: str) -> dict:
    """Resolve a social media page URL to a local downloadable video file using yt-dlp.

    Returns a dict with local file path for analysis and a best-effort playback URL.
    """
    temp_dir = tempfile.mkdtemp(prefix="ytdlp_reel_")
    out_tmpl = os.path.join(temp_dir, "%(id)s.%(ext)s")

    lower_url = (url or "").lower()
    referer = ""
    origin = ""
    if "instagram.com" in lower_url:
        referer = "https://www.instagram.com/"
        origin = "https://www.instagram.com"
    elif "facebook.com" in lower_url:
        referer = "https://www.facebook.com/"
        origin = "https://www.facebook.com"
    elif "x.com" in lower_url or "twitter.com" in lower_url:
        referer = "https://x.com/"
        origin = "https://x.com"
    elif "tiktok.com" in lower_url:
        referer = "https://www.tiktok.com/"
        origin = "https://www.tiktok.com"

    args = [
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "--user-agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "-f",
        # Prefer a single progressive MP4 stream so ffmpeg is not required.
        "best[ext=mp4]/best",
        "-o",
        out_tmpl,
    ]

    if referer:
        args.extend(["--add-header", f"Referer:{referer}"])
    if origin:
        args.extend(["--add-header", f"Origin:{origin}"])

    cookie_candidates = []
    env_cookie = os.getenv("YTDLP_COOKIES_FILE")
    if env_cookie:
        cookie_candidates.append(env_cookie)

    local_cookie = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cookies.txt")
    media_download_cookie = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "media-download", "cookies.txt"))
    cookie_candidates.extend([local_cookie, media_download_cookie])

    cookie_candidates = [p for p in cookie_candidates if p and os.path.exists(p)]

    local_ytdlp_exe = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".venv", "Scripts", "yt-dlp.exe")
    runners = [
        [sys.executable, "-m", "yt_dlp"],
        ["yt-dlp"],
        [local_ytdlp_exe],
        ["py", "-m", "yt_dlp"],
        ["python", "-m", "yt_dlp"],
    ]

    filtered_runners = []
    for runner in runners:
        if len(runner) == 1 and os.path.isabs(runner[0]) and not os.path.exists(runner[0]):
            continue
        filtered_runners.append(runner)

    # --cookies-from-browser: yt-dlp reads cookies directly from the installed
    # browser profile on Windows, so Facebook/Instagram auth works without a
    # manually-exported cookies.txt file.
    browser_sources = ["chrome", "edge", "firefox"]

    # For platforms that require login (Facebook, Instagram, X) try browser
    # cookies FIRST — they are the most likely to succeed on a dev machine.
    needs_auth = any(d in lower_url for d in ("facebook.com", "instagram.com", "x.com", "twitter.com"))

    command_variants = []

    # Priority 1 (auth platforms): browser cookie extraction first
    if needs_auth:
        for runner in filtered_runners[:2]:  # only venv runners
            for browser in browser_sources:
                command_variants.append([
                    *runner,
                    *args,
                    "--cookies-from-browser", browser,
                    "--print", "url",
                    "--print", "after_move:filepath",
                    url,
                ])

    # Priority 2: exported cookie file variants (if any files exist)
    for runner in filtered_runners:
        if cookie_candidates:
            for cpath in cookie_candidates:
                command_variants.append([
                    *runner,
                    *args,
                    "--cookies", cpath,
                    "--print", "url",
                    "--print", "after_move:filepath",
                    url,
                ])

    # Priority 3 (non-auth platforms / final fallback): browser cookies
    if not needs_auth:
        for runner in filtered_runners[:2]:
            for browser in browser_sources:
                command_variants.append([
                    *runner,
                    *args,
                    "--cookies-from-browser", browser,
                    "--print", "url",
                    "--print", "after_move:filepath",
                    url,
                ])

    # Priority 4: no cookies (public content / YouTube)
    for runner in filtered_runners:
        command_variants.append([
            *runner,
            *args,
            "--print", "url",
            "--print", "after_move:filepath",
            url,
        ])

    def _is_decodable_video(path: str) -> bool:
        if not path or not os.path.exists(path) or os.path.getsize(path) < 1024:
            return False
        cap = cv2.VideoCapture(path)
        if not cap.isOpened():
            cap.release()
            return False
        ret, _ = cap.read()
        cap.release()
        return bool(ret)

    def _try_repair_video(path: str) -> str | None:
        repaired_copy = os.path.splitext(path)[0] + "_repaired.mp4"
        repaired_transcode = os.path.splitext(path)[0] + "_transcoded.mp4"

        # First try a fast container repair/remux.
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", path, "-c", "copy", repaired_copy],
                check=True,
                capture_output=True,
                text=True,
                timeout=120,
            )
            if _is_decodable_video(repaired_copy):
                return repaired_copy
        except Exception:
            pass

        # Fall back to full transcode if remux failed.
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", path, "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", repaired_transcode],
                check=True,
                capture_output=True,
                text=True,
                timeout=240,
            )
            if _is_decodable_video(repaired_transcode):
                return repaired_transcode
        except Exception:
            pass

        return None

    last_error = None
    error_summaries = []
    for cmd in command_variants:
        try:
            proc = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=240)
            playback_url = None

            # Prefer exact final filepath printed by yt-dlp.
            printed_paths = []
            for ln in (proc.stdout or "").splitlines():
                line = (ln or "").strip().strip('"')
                if line.startswith("http://") or line.startswith("https://"):
                    if not playback_url:
                        playback_url = line
                if line and os.path.exists(line):
                    printed_paths.append(line)

            if printed_paths:
                candidate = sorted(printed_paths, key=lambda p: os.path.getsize(p), reverse=True)[0]
                if _is_decodable_video(candidate):
                    return {"file_path": candidate, "playback_url": playback_url}
                repaired = _try_repair_video(candidate)
                if repaired:
                    return {"file_path": repaired, "playback_url": playback_url}

            files = [
                os.path.join(temp_dir, name)
                for name in os.listdir(temp_dir)
                if name.lower().endswith((".mp4", ".mkv", ".webm", ".mov"))
            ]
            if files:
                files.sort(key=lambda p: os.path.getsize(p), reverse=True)
                for candidate in files:
                    if _is_decodable_video(candidate):
                        return {"file_path": candidate, "playback_url": playback_url}
                    repaired = _try_repair_video(candidate)
                    if repaired:
                        return {"file_path": repaired, "playback_url": playback_url}

            raise RuntimeError("yt-dlp completed but no decodable video file was produced")
        except Exception as e:
            last_error = e
            stderr_text = ""
            if hasattr(e, "stderr") and e.stderr:
                stderr_text = str(e.stderr).strip().splitlines()[-1]
            if not stderr_text:
                stderr_text = str(e)

            cmd_name = " ".join(cmd[:3])
            error_summaries.append(f"{cmd_name}: {stderr_text}")

    details = " | ".join(error_summaries) if error_summaries else str(last_error)
    raise RuntimeError(f"Unable to resolve social video URL via yt-dlp: {details}")

def predict_video_frame(face_pil: Image.Image) -> float:
    """Predict fake probability using ONLY the Xception (FaceForensics++) model."""
    input_tensor = preprocess(face_pil).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        output = model(input_tensor)
        return float(torch.sigmoid(output).item())

def detect_compression_and_source(img_pil: Image.Image, filename: str) -> dict:
    """
    Heuristic-based compression and source detection.
    Identifies high-compression sources like WhatsApp.
    """
    is_whatsapp = "whatsapp" in filename.lower()
    
    # Check for resolution patterns typical of WhatsApp (often capped at 1600 or 1280)
    w, h = img_pil.size
    is_likely_compressed = (w <= 1600 and h <= 1600) or is_whatsapp
    
    # Get JPEG quality if possible (heuristic based on file size vs pixel count)
    # This is a guestimate without direct access to quantization tables
    # Real phone photos are usually > 3MB for 12MP. WhatsApp is ~100KB.
    # Since we only have the PIL image here, we can't check file size easily 
    # unless we pass it. For now, filename + resolution is a strong signal.
    
    return {
        "is_whatsapp": is_whatsapp,
        "is_compressed": is_likely_compressed,
        "source": "WhatsApp" if is_whatsapp else "Generic/Camera"
    }

def is_real_camera_image(img_pil: Image.Image) -> dict:
    """
    Check EXIF for physical camera signatures (Make, Model, Software).
    AI images typically strip these or set them to 'Adobe Photoshop' etc.
    """
    try:
        exif_data = img_pil._getexif()
        if not exif_data:
            return {"is_camera": False, "details": "No EXIF found"}
            
        decoded = {TAGS.get(t, t): v for t, v in exif_data.items()}
        make = str(decoded.get('Make', '')).lower()
        model = str(decoded.get('Model', '')).lower()
        software = str(decoded.get('Software', '')).lower()
        
        # Known phone/camera brands
        brands = ["apple", "samsung", "google", "sony", "nikon", "canon", "huawei", "xiaomi", "oppo", "vivo"]
        has_brand = any(brand in make or brand in model for brand in brands)
        
        # If it has a real brand and no 'stable diffusion' or 'midjourney' in software
        if has_brand and "diffusion" not in software:
             return {"is_camera": True, "details": f"{make} {model}".strip()}
             
        return {"is_camera": False, "details": "No camera signature in EXIF"}
    except Exception as e:
        return {"is_camera": False, "details": f"EXIF error: {e}"}

def predict_face_ensemble(face_pil: Image.Image, detector_type="image") -> float:
    """Predict fake probability using dual-model ensemble (Texture + Frequency) for images,
    enhanced with Xception for videos as a lead forensic signal."""
    try:
        # Standard Face-Crop Scores
        input_texture = preprocess(face_pil).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            prob_texture = torch.sigmoid(image_model_texture(input_texture)).item()
        
        prob_freq = 0.0
        if os.path.exists(IMAGE_WEIGHTS_FREQ_PATH):
            try:
                face_freq = NoiseResidual()(face_pil)
                transform_freq = transforms.Compose([
                    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
                    transforms.ToTensor(),
                    transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
                ])
                input_freq = transform_freq(face_freq).unsqueeze(0).to(DEVICE)
                with torch.no_grad():
                    prob_freq = torch.sigmoid(image_model_freq(input_freq)).item()
            except:
                 prob_freq = 0.0
        
        prob_xception = predict_video_frame(face_pil)

        if detector_type == "video":
            return (prob_xception * 0.6) + (prob_texture * 0.2) + (prob_freq * 0.2)
        else:
            # CONSENSUS SCORING: Require 2+ models to agree before trusting max
            # Prevents single-model false positives (e.g., B4 firing alone on real images)
            scores = [prob_texture, prob_freq, prob_xception]
            high_count = sum(1 for s in scores if s > 0.5)
            if high_count >= 2:
                return max(prob_texture, prob_freq, prob_xception * 0.3)
            else:
                return (prob_texture + prob_freq + prob_xception * 0.3) / 3
            
    except Exception as e:
        print(f"[!] Ensemble Error: {e}")
        return 0.5

def predict_image_fused(img_pil: Image.Image, face_pil: Image.Image, boxes=None) -> float:
    """
    Fusion Logic: Full multi-model ensemble across face crop + full frame.
    All 3 models (Xception, B4 Texture, B0 Frequency) run on both face and full frame.
    Adaptive weighting: multi-face images trust full-frame more (face crops are small/unreliable).
    """
    try:
        faces_detected = len(boxes) if boxes is not None else 1

        # 1. Multi-face scoring: check up to 5 face crops, use max
        face_score = predict_face_ensemble(face_pil, detector_type="image")
        if boxes is not None and len(boxes) > 1:
            for i in range(1, min(len(boxes), 5)):
                x1, y1, x2, y2 = map(int, boxes[i])
                crop = img_pil.crop((max(0, x1), max(0, y1), min(img_pil.width, x2), min(img_pil.height, y2)))
                score = predict_face_ensemble(crop, detector_type="image")
                face_score = max(face_score, score)
        
        # 2. Full-frame Score (All 3 models on the whole image)
        input_full = preprocess(img_pil).unsqueeze(0).to(DEVICE)
        with torch.no_grad():
            full_texture = torch.sigmoid(image_model_texture(input_full)).item()
            full_xception = torch.sigmoid(model(input_full)).item()
        
        # Frequency on full-frame noise residual
        full_freq = 0.0
        try:
            full_noise = NoiseResidual()(img_pil)
            transform_freq = transforms.Compose([
                transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),
                transforms.ToTensor(),
                transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
            ])
            input_freq_full = transform_freq(full_noise).unsqueeze(0).to(DEVICE)
            with torch.no_grad():
                full_freq = torch.sigmoid(image_model_freq(input_freq_full)).item()
        except:
            pass
        
        # Full-frame CONSENSUS SCORING: Require 2+ models to agree
        full_scores = [full_texture, full_freq, full_xception]
        high_count = sum(1 for s in full_scores if s > 0.5)
        if high_count >= 2:
            full_frame_score = max(full_texture, full_freq, full_xception)
        else:
            full_frame_score = full_texture * 0.4 + full_freq * 0.3 + full_xception * 0.3
        
        # 3. Adaptive Fusion based on face count
        # Multi-face images (4+): face crops are small/low-res, unreliable.
        # Full-frame sees patterns across ALL faces â€” trust it when it fires.
        if face_score < 0.15 and full_frame_score > 0.5 and faces_detected >= 4:
            # Face models inconclusive + full-frame suspicious + many faces â†’ trust full-frame
            fused_score = full_frame_score
        else:
            # Normal: face is authoritative (60%), full-frame supports (40%)
            fused_score = face_score * 0.6 + full_frame_score * 0.4
        
        print(f"[*] Fusion Stats - Face: {face_score:.3f}, Full(tex={full_texture:.3f} xcep={full_xception:.3f} freq={full_freq:.3f})={full_frame_score:.3f}, Faces={faces_detected}, Fused: {fused_score:.3f}")
        return fused_score
    except Exception as e:
        print(f"[!] Fusion Error: {e}")
        return predict_face_ensemble(face_pil)

@app.get("/model-info")
async def get_model_info():
    return {
        "architecture": "XceptionNet",
        "trained_in_house": True,
        "device": str(DEVICE),
        "input_resolution": "224x224",
        "primary_dataset": "FaceForensics++",
        "status": "Production-Ready"
    }

def run_forensic_image_analysis(img_pil: Image.Image, filename: str) -> dict:
    """
    CORE IMAGE FORENSIC ENGINE:
    - MTCNN Face Detection
    - Fused Ensemble (Texture + Frequency + Xception)
    - Compression Calibration (WhatsApp/Generic)
    - Metadata Guard (Real Camera Signatures)
    - Calibrated Confidence Scoring
    """
    try:
        # 1. Detect face boxes
        boxes, _ = mtcnn.detect(img_pil)
        
        if boxes is None or len(boxes) == 0:
            return {
                "label": "NEEDS_REVIEW",
                "status": "INCONCLUSIVE",
                "verdict": "INCONCLUSIVE",
                "confidence": 0.0,
                "face_detected": False,
                "message": "No face detected. Forensic model could not be initialized.",
                "type": "image"
            }
        
        # 2. Crop the first detected face
        x1, y1, x2, y2 = map(int, boxes[0])
        face_pil = img_pil.crop((max(0, x1), max(0, y1), min(img_pil.width, x2), min(img_pil.height, y2)))
        
        # 3. Ensemble Prediction
        prob = predict_image_fused(img_pil, face_pil, boxes=boxes)
        
        # 4. Calibration & Guards
        comp_info = detect_compression_and_source(img_pil, filename)
        camera_info = is_real_camera_image(img_pil)
        
        fake_threshold = 0.62
        conservative_bonus = 0.0
        
        if comp_info["is_compressed"]:
            fake_threshold += 0.12 
        
        if camera_info["is_camera"]:
            fake_threshold += 0.08
            conservative_bonus -= 0.1
        
        prob = max(0.0, min(1.0, prob + conservative_bonus))

        # 5. Result Formatting
        if prob >= fake_threshold:
            label = "LIKELY MANIPULATED (IMAGE-ONLY ANALYSIS)"
            status = "DANGER"
            verdict = "FAKE"
            confidence_level = "HIGH" if prob >= (fake_threshold + 0.2) else "MEDIUM"
            message = "Artificial manipulation artifacts identified. Image-only analysis has higher false-positive risk."
        elif prob <= (fake_threshold - 0.15):
            label = "REAL"
            status = "SAFE"
            verdict = "REAL"
            confidence_level = "HIGH" if prob <= 0.3 else "MEDIUM"
            message = "No systemic manipulation detected. Verified with compression-aware forensic analysis."
        else:
            label = "REAL"
            status = "SAFE"
            verdict = "REAL"
            confidence_level = "LOW"
            message = "No strong manipulation detected. Low-confidence results due to image quality/compression."
        
        if prob >= fake_threshold:
            confidence_numerical = 0.5 + (prob - fake_threshold) / (1.0 - fake_threshold) * 0.5
        else:
            confidence_numerical = 0.5 + (fake_threshold - prob) / fake_threshold * 0.5
        
        return {
            "type": "image",
            "label": label,
            "status": status,
            "verdict": verdict,
            "confidence": confidence_numerical,
            "confidence_level": confidence_level,
            "message": message,
            "face_detected": True,
            "faces_detected": len(boxes),
            "forensics": {
                "source": comp_info["source"],
                "is_compressed": comp_info["is_compressed"],
                "camera_metadata": camera_info["details"],
                "adjusted_score": round(prob, 4),
                "dynamic_threshold": round(fake_threshold, 2)
            },
            "scores": {"REAL": round(1-prob, 4), "FAKE": round(prob, 4)},
            "model": "Fused Image Ensemble (Artifact v5 + Contextual Guard)"
        }
    except Exception as e:
        print(f"[!] Image Forensic Error: {e}")
        return {"error": str(e), "status": "FAILED", "type": "image"}

@app.post("/detect/image")
async def detect_image(file: UploadFile = File(...)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    batch_preempt.set()  # Signal any running batch item to pause
    async with gpu_lock.acquire(priority=1): # High priority for manual UI image checks
      try:
        img_pil = await asyncio.to_thread(Image.open, tmp_path)
        img_pil = img_pil.convert("RGB")
        return await asyncio.to_thread(run_forensic_image_analysis, img_pil, file.filename)
      finally:
        batch_preempt.clear()  # Allow batch to resume
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

class BatchItem(Dict):
    url: str
    type: str

class BatchPayload(Dict):
    media_items: List[Dict]

@app.post("/detect/batch")
async def detect_batch(payload: Dict):
    """
    BATCH FORENSIC PIPELINE:
    - Processes items ONE-BY-ONE.
    - Downloads from URL -> Analyzes -> Deletes.
    - Preview frame generation is controlled by payload.include_previews.
    """
    media_items = payload.get("media_items", [])
    include_previews = bool(payload.get("include_previews", False))
    req_priority = int(payload.get("priority", 10))
    results = []

    def maybe_strip_preview_fields(result_obj: Dict) -> Dict:
        if include_previews:
            return result_obj
        if isinstance(result_obj, dict):
            result_obj.pop("top_suspicious_frames", None)
            result_obj.pop("full_forensic_timeline", None)
        return result_obj

    async def _batch_video_analysis(video_path, save_previews_flag):
        """Run video analysis with preemption support.
        If a UI request preempts us, release GPU, wait for UI to finish, then retry.
        UI-priority requests (priority <= 1) are NOT preemptable — they ARE the high-priority caller."""
        # Only background/low-priority batch items should be preemptable.
        # UI link requests (priority=1) should never preempt themselves.
        use_preempt = batch_preempt if req_priority > 1 else None

        # If this IS the UI request that triggered preemption, clear the flag
        # so background batches can eventually resume after we finish.
        if req_priority <= 1 and batch_preempt.is_set():
            batch_preempt.clear()

        while True:
            try:
                async with gpu_lock.acquire(priority=req_priority):
                    cap, verified_path = await asyncio.to_thread(get_robust_cap, video_path)
                    cap.release()
                    result = await asyncio.to_thread(
                        run_forensic_video_analysis, verified_path,
                        save_previews=save_previews_flag, preempt_flag=use_preempt
                    )
                    result = maybe_strip_preview_fields(result)
                    if verified_path != video_path and os.path.exists(verified_path):
                        os.remove(verified_path)
                return result
            except PreemptedException:
                print(f"[*] Batch item preempted by UI request. Waiting to retry...")
                # Wait until the UI request clears the preempt flag
                while batch_preempt.is_set():
                    await asyncio.sleep(0.1)
                print(f"[*] UI request complete. Retrying batch item...")
    
    import requests

    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
    })
    
    for item in media_items:
        url = (item.get("url") or "").strip()
        media_type = item.get("type", "video")
        is_m3u8 = url and ".m3u8" in url.lower()
        is_instagram_page_video = bool(re.search(r"instagram\.com\/(?:reels?|p|tv)\/", url, re.IGNORECASE)) and media_type == "video"
        is_tiktok_video = bool(re.search(r"tiktok\.com\/@[\w.-]+\/video\/\d+|vm\.tiktok\.com|vt\.tiktok\.com", url, re.IGNORECASE)) and media_type == "video"
        is_facebook_video = bool(re.search(r"(facebook\.com\/(watch|video|share\/(?:p|v)|[\w.-]+\/videos?)|fb\.watch\/)", url, re.IGNORECASE)) and media_type == "video"
        is_twitter_video = bool(re.search(r"(x\.com|twitter\.com)\/[\w]+\/status\/\d+", url, re.IGNORECASE)) and media_type == "video"
        is_youtube_video = bool(re.search(r"(youtube\.com|youtu\.be)", url, re.IGNORECASE)) and media_type == "video"

        # Browser-only blob/data URLs cannot be fetched by the backend service.
        if url.startswith("blob:") or url.startswith("data:"):
            results.append({
                "url": url,
                "error": "Unsupported URL scheme (blob/data). Please provide a public http/https media link."
            })
            continue

        # Normalize encoded URLs copied from browsers
        url = unquote(url)
        
        try:
            if media_type == "video" and is_m3u8:
                # --- HLS/m3u8 DIRECT HANDLING ---
                print(f"[*] Batch: Handling HLS manifest directly: {url}")
                result = await _batch_video_analysis(url, include_previews)
                results.append({
                    "url": url,
                    "type": "video",
                    "status": "DANGER" if result.get("verdict") == "FAKE" else "SAFE",
                    **result
                })
                continue 

            if is_instagram_page_video:
                # Reel/post page URL: resolve actual video via yt-dlp.
                print(f"[*] Batch: Resolving Instagram page video via yt-dlp: {url}")
                yt_video_path = None
                playback_url = None
                try:
                    yt_resolved = download_social_video_with_ytdlp(url)
                    yt_video_path = yt_resolved.get("file_path")
                    playback_url = yt_resolved.get("playback_url")
                    result = await _batch_video_analysis(yt_video_path, include_previews)

                    results.append({
                        "url": url,
                        "type": "video",
                        "playbackUrl": playback_url,
                        "status": "DANGER" if result.get("verdict") == "FAKE" else "SAFE",
                        "model": "Multi-Stream Forensic Engine (Face + Global + Freq + Temporal)",
                        **result
                    })
                    continue
                finally:
                    if yt_video_path and os.path.exists(yt_video_path):
                        os.remove(yt_video_path)
                    if yt_video_path:
                        try:
                            shutil.rmtree(os.path.dirname(yt_video_path), ignore_errors=True)
                        except Exception:
                            pass

            if is_tiktok_video:
                print(f"[*] Batch: Resolving TikTok video via yt-dlp: {url}")
                yt_video_path = None
                playback_url = None
                try:
                    yt_resolved = download_social_video_with_ytdlp(url)
                    yt_video_path = yt_resolved.get("file_path")
                    playback_url = yt_resolved.get("playback_url")
                    result = await _batch_video_analysis(yt_video_path, include_previews)

                    results.append({
                        "url": url,
                        "type": "video",
                        "playbackUrl": playback_url,
                        "status": "DANGER" if result.get("verdict") == "FAKE" else "SAFE",
                        "model": "Multi-Stream Forensic Engine (Face + Global + Freq + Temporal)",
                        **result
                    })
                    continue
                except Exception as e:
                    print(f"[!] TikTok video resolution failed: {e}")
                    results.append({"url": url, "error": f"TikTok video resolution failed: {str(e)}"})
                    continue
                finally:
                    if yt_video_path and os.path.exists(yt_video_path):
                        os.remove(yt_video_path)
                    if yt_video_path:
                        try:
                            shutil.rmtree(os.path.dirname(yt_video_path), ignore_errors=True)
                        except Exception:
                            pass

            # FACEBOOK VIDEO RESOLUTION
            if is_facebook_video:
                print(f"[*] Batch: Resolving Facebook video via yt-dlp: {url}")
                yt_video_path = None
                playback_url = None
                try:
                    yt_resolved = download_social_video_with_ytdlp(url)
                    yt_video_path = yt_resolved.get("file_path")
                    playback_url = yt_resolved.get("playback_url")
                    result = await _batch_video_analysis(yt_video_path, include_previews)

                    results.append({
                        "url": url,
                        "type": "video",
                        "playbackUrl": playback_url,
                        "status": "DANGER" if result.get("verdict") == "FAKE" else "SAFE",
                        "model": "Multi-Stream Forensic Engine (Face + Global + Freq + Temporal)",
                        **result
                    })
                    continue
                except Exception as e:
                    print(f"[!] Facebook video resolution failed: {e}")
                    results.append({"url": url, "error": f"Facebook video resolution failed: {str(e)}"})
                    continue
                finally:
                    if yt_video_path and os.path.exists(yt_video_path):
                        os.remove(yt_video_path)
                    if yt_video_path:
                        try:
                            shutil.rmtree(os.path.dirname(yt_video_path), ignore_errors=True)
                        except Exception:
                            pass

            # TWITTER/X VIDEO RESOLUTION
            if is_twitter_video:
                print(f"[*] Batch: Resolving Twitter/X video via yt-dlp: {url}")
                yt_video_path = None
                playback_url = None
                try:
                    yt_resolved = download_social_video_with_ytdlp(url)
                    yt_video_path = yt_resolved.get("file_path")
                    playback_url = yt_resolved.get("playback_url")
                    result = await _batch_video_analysis(yt_video_path, include_previews)

                    results.append({
                        "url": url,
                        "type": "video",
                        "playbackUrl": playback_url,
                        "status": "DANGER" if result.get("verdict") == "FAKE" else "SAFE",
                        "model": "Multi-Stream Forensic Engine (Face + Global + Freq + Temporal)",
                        **result
                    })
                    continue
                except Exception as e:
                    print(f"[!] Twitter/X video resolution failed: {e}")
                    results.append({"url": url, "error": f"Twitter/X video resolution failed: {str(e)}"})
                    continue
                finally:
                    if yt_video_path and os.path.exists(yt_video_path):
                        os.remove(yt_video_path)
                    if yt_video_path:
                        try:
                            shutil.rmtree(os.path.dirname(yt_video_path), ignore_errors=True)
                        except Exception:
                            pass

            # ═══════════════════════════════════════════════════════════
            # ─ YOUTUBE VIDEO RESOLUTION
            # ═══════════════════════════════════════════════════════════
            if is_youtube_video:
                print(f"[*] Batch: Resolving YouTube video via yt-dlp: {url}")
                yt_video_path = None
                playback_url = None
                try:
                    yt_resolved = download_social_video_with_ytdlp(url)
                    yt_video_path = yt_resolved.get("file_path")
                    playback_url = yt_resolved.get("playback_url")
                    result = await _batch_video_analysis(yt_video_path, include_previews)

                    results.append({
                        "url": url,
                        "type": "video",
                        "playbackUrl": playback_url,
                        "status": "DANGER" if result.get("verdict") == "FAKE" else "SAFE",
                        "model": "Multi-Stream Forensic Engine (Face + Global + Freq + Temporal)",
                        **result
                    })
                    continue
                except Exception as e:
                    print(f"[!] YouTube video resolution failed: {e}")
                    results.append({"url": url, "error": f"YouTube video resolution failed: {str(e)}"})
                    continue
                finally:
                    if yt_video_path and os.path.exists(yt_video_path):
                        os.remove(yt_video_path)
                    if yt_video_path:
                        try:
                            shutil.rmtree(os.path.dirname(yt_video_path), ignore_errors=True)
                        except Exception:
                            pass
            
            # Standard Download Flow
            tmp_path = None
            try:
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4" if media_type == "video" else ".jpg") as tmp:
                    print(f"[*] Batch: Downloading {url}")
                    r = session.get(url, stream=True, timeout=45, allow_redirects=True)
                    if r.status_code != 200:
                        raise RuntimeError(f"Failed to download media URL. HTTP {r.status_code}")

                    content_type = str(r.headers.get("content-type", "")).lower()
                    if media_type == "video" and "text/html" in content_type:
                        raise RuntimeError("Video URL returned HTML content. Use a direct media URL or social post URL.")
                    if media_type == "image" and "svg" in content_type:
                        raise RuntimeError("SVG images are not supported for forensic analysis. Use raster images (jpg/png/webp).")

                    bytes_written = 0
                    for chunk in r.iter_content(chunk_size=8192):
                        if not chunk:
                            continue
                        tmp.write(chunk)
                        bytes_written += len(chunk)

                    if bytes_written == 0:
                        raise RuntimeError("Downloaded media is empty")

                    tmp_path = tmp.name
                    tmp.close()
                
                if media_type == "video" and tmp_path:
                    result = await _batch_video_analysis(tmp_path, include_previews)
                    
                    # Align with detect_video response structure
                    results.append({
                        "url": url,
                        "type": "video",
                        "status": "DANGER" if result.get("verdict") == "FAKE" else "SAFE",
                        "model": "Multi-Stream Forensic Engine (Face + Global + Freq + Temporal)",
                        **result
                    })
                
                elif media_type == "image" and tmp_path:
                    async with gpu_lock.acquire(priority=req_priority):
                        img_pil = await asyncio.to_thread(Image.open, tmp_path)
                        img_pil = img_pil.convert("RGB")
                        # Use THE SAME logic as manual uploads
                        result = await asyncio.to_thread(run_forensic_image_analysis, img_pil, url)
                    results.append({"url": url, **result})
            finally:
                if tmp_path and os.path.exists(tmp_path):
                    os.remove(tmp_path)
                    
        except Exception as e:
            print(f"[!] Batch Item Error: {e}")
            results.append({"url": url, "error": str(e)})
                    
    return {"results": results}

@app.post("/detect/video")
async def detect_video(file: UploadFile = File(...)):
    if not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="File must be a video")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    batch_preempt.set()  # Signal any running batch item to pause
    async with gpu_lock.acquire(priority=1): # Priority 1 ensures UI preempts batch
      try:
        # --- OPTIMIZED PRODUCTION LOGIC (FUSION) ---
        print(f"[*] Starting Production Video Forensic Analysis: {file.filename}")
        
        # Use robust capture to handle AV1/H265 decoding issues
        cap, verified_path = await asyncio.to_thread(get_robust_cap, tmp_path)
        cap.release() # Release immediately, inference engine will open it
        
        result = await asyncio.to_thread(run_forensic_video_analysis, verified_path)
        
        # Cleanup compatible transcode if created
        if verified_path != tmp_path and os.path.exists(verified_path):
            os.remove(verified_path)
        
        # Merge results, prioritizing rich forensic data from inference engine
        response = {
            "status": "DANGER" if result.get("verdict") == "FAKE" else "SAFE",
            "model": "Multi-Stream Forensic Engine (Face + Global + Freq + Temporal)",
            **result
        }
        
        return response
        # -------------------------------------------

      except Exception as e:
        print(f"[!] Video Forensic Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
      finally:
        batch_preempt.clear()  # Allow batch to resume
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

if __name__ == "__main__":
    import uvicorn
    # In production, uvicorn should be called from terminal or process manager
    uvicorn.run(app, host="0.0.0.0", port=8001)


