import torch
import torch.nn as nn
import cv2
import numpy as np
from PIL import Image, ImageFilter
from model import DeepfakeTemporalCNN, get_model 
from torchvision import transforms
import os
from facenet_pytorch import MTCNN

class PreemptedException(Exception):
    """Raised when batch processing should yield to a higher-priority UI request."""
    pass

# --- 🔒 OPTIMIZED CONFIG ---
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SPATIAL_WEIGHTS = "xception_spatial.pth"
TEMPORAL_WEIGHTS = "video_temporal_model.pth"
GLOBAL_WEIGHTS = "image_detector_v4_realworld.pth"   # EfficientNet-B4 (full-frame texture)
FREQ_WEIGHTS = "image_detector_v5_frequency.pth"      # EfficientNet-B0 (noise residuals)
NUM_FRAMES = 16
CLIP_THRESHOLD = 0.50 
USE_TEMPORAL = True # ✅ Re-enabled for motion consistency
# ----------------------------------------

def robust_load_weights(model, path, device="cpu"):
    """
    Handles state_dict key mismatches.
    """
    if not os.path.exists(path):
        print(f"[!] Warning: Weights path not found: {path}")
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
        print(f"[*] WEIGHTS LOADED FROM: {path}")
        return True
    except Exception as e:
        print(f"[!] Warning: loading failed for {path}. Error: {e}")
        return False

# --- 🔒 PERSISTENT MODEL SINGLETON ---
GLOBAL_SPATIAL_MODEL = None
GLOBAL_GLOBAL_MODEL = None  # EfficientNet-B4 for full-frame
GLOBAL_TEMPORAL_MODEL = None
GLOBAL_FREQ_MODEL = None    # EfficientNet-B0 for frequency
GLOBAL_MTCNN = None

def _build_efficientnet_b4():
    """EfficientNet-B4 with custom head matching main.py / training."""
    from torchvision import models as tv_models
    m = tv_models.efficientnet_b4(weights=None)
    num_ftrs = m.classifier[1].in_features
    m.classifier[1] = nn.Sequential(nn.Dropout(0.3), nn.Linear(num_ftrs, 1))
    return m

def _build_efficientnet_b0():
    """EfficientNet-B0 with custom head matching main.py / training."""
    from torchvision import models as tv_models
    m = tv_models.efficientnet_b0(weights=None)
    num_ftrs = m.classifier[1].in_features
    m.classifier[1] = nn.Sequential(nn.Dropout(0.3), nn.Linear(num_ftrs, 1))
    return m

def get_fusion_system():
    global GLOBAL_SPATIAL_MODEL, GLOBAL_GLOBAL_MODEL, GLOBAL_TEMPORAL_MODEL, GLOBAL_MTCNN, GLOBAL_FREQ_MODEL
    
    if GLOBAL_SPATIAL_MODEL is None:
        print("[*] Performing one-time model initialization...")
        # 1. Face Detector (MTCNN)
        GLOBAL_MTCNN = MTCNN(keep_all=False, device=DEVICE)
        
        # 2. Spatial Model (Xception) — for face crops
        GLOBAL_SPATIAL_MODEL = get_model(name="xception", pretrained=False).to(DEVICE)
        robust_load_weights(GLOBAL_SPATIAL_MODEL, SPATIAL_WEIGHTS, DEVICE)
        GLOBAL_SPATIAL_MODEL.eval()

        # 3. Global Model (EfficientNet-B4) — for full-frame texture analysis
        GLOBAL_GLOBAL_MODEL = _build_efficientnet_b4().to(DEVICE)
        GLOBAL_GLOBAL_MODEL.load_state_dict(torch.load(GLOBAL_WEIGHTS, map_location=DEVICE))
        GLOBAL_GLOBAL_MODEL.eval()
        print(f"[*] Loaded Global (B4): {GLOBAL_WEIGHTS}")

        # 4. Frequency Model (EfficientNet-B0) — for noise residual analysis
        GLOBAL_FREQ_MODEL = _build_efficientnet_b0().to(DEVICE)
        GLOBAL_FREQ_MODEL.load_state_dict(torch.load(FREQ_WEIGHTS, map_location=DEVICE))
        GLOBAL_FREQ_MODEL.eval()
        print(f"[*] Loaded Freq (B0): {FREQ_WEIGHTS}")

        if USE_TEMPORAL:
            # 5. Temporal Model (R3D-18 pretrained on Kinetics-400)
            GLOBAL_TEMPORAL_MODEL = DeepfakeTemporalCNN(pretrained=False, num_frames=NUM_FRAMES).to(DEVICE)
            robust_load_weights(GLOBAL_TEMPORAL_MODEL, TEMPORAL_WEIGHTS, DEVICE)
            GLOBAL_TEMPORAL_MODEL.eval()
        
        print("[*] All 4 video streams cached in VRAM.")
        
    return GLOBAL_SPATIAL_MODEL, GLOBAL_GLOBAL_MODEL, GLOBAL_FREQ_MODEL, GLOBAL_TEMPORAL_MODEL, GLOBAL_MTCNN

# Preprocessing Specs — must match training normalization
spatial_preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

freq_preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5])
])

# Temporal stream uses ImageNet normalization (must match R3D-18 training)
temporal_preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def get_noise_residual(image_pil):
    """
    Extracts high-frequency noise residuals for AI generation detection.
    """
    img_np = np.array(image_pil).astype(np.float32)
    img_blur = np.array(image_pil.filter(ImageFilter.MedianFilter(size=3))).astype(np.float32)
    residual = np.clip((img_np - img_blur) + 128, 0, 255).astype(np.uint8)
    return Image.fromarray(residual)

def run_forensic_video_analysis(video_path, save_previews=True, preempt_flag=None):
    """
    MULTI-STREAM FORENSIC PIPELINE:
    - Face Stream (Xception Face Crops) -> Detects Swaps
    - Global Stream (EfficientNet-B4 Full Frame) -> Detects Background/Scene Synthesis
    - Frequency Stream (EfficientNet-B0 Noise Residuals) -> Detects Generative Textures
    - Temporal Stream (R3D-18 Kinetics-400) -> Detects Motion Artifacts
    
    preempt_flag: optional threading.Event — when set, raises PreemptedException
                  so batch processing yields the GPU to a higher-priority UI request.
    """
    spatial_model, global_model, freq_model, temporal_model, mtcnn = get_fusion_system()
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {"error": "Could not open video file"}
        
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    duration_secs = total_frames / fps if fps > 0 else 0

    # TIERED SAMPLING STRATEGY (Based on User Requirements)
    if duration_secs < 60:
        # Below 1 minute: 1 frame/clip every 2 seconds
        sample_interval_secs = 2
    elif duration_secs < 300:
        # Below 5 minutes: 1 frame/clip every 5 seconds
        sample_interval_secs = 5
    else:
        # Above 5 minutes: 1 frame/clip every 10 seconds
        sample_interval_secs = 10
    
    # Calculate step_size in frames
    step_size = max(1, int(sample_interval_secs * fps))
    
    print(f"[*] Tiered Sampling: Duration={duration_secs:.1f}s, Interval={sample_interval_secs}s, StepSize={step_size} frames")
    
    clip_details = []
    total_clips_analyzed = 0
    
    for start_frame in range(0, total_frames - NUM_FRAMES, step_size):
        # --- PREEMPTION CHECK: Yield GPU when a UI request is waiting ---
        if preempt_flag is not None and preempt_flag.is_set():
            cap.release()
            raise PreemptedException("Batch video analysis preempted by UI request")
        
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        face_frames = []
        global_frames = []
        freq_frames = []
        temporal_frames = []
        
        face_box = None
        
        for i in range(NUM_FRAMES):
            ret, frame = cap.read()
            if not ret: break
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            
            # --- Stream 1 & 2 & 3: Frames ---
            if i % 4 == 0: # Sparse spatial sampling
                # Global Stream Frame
                global_frames.append(spatial_preprocess(pil_img))
                
                # Frequency Stream Frame
                residual = get_noise_residual(pil_img)
                freq_frames.append(freq_preprocess(residual))
                
                # Face Detection (Search once per clip)
                if face_box is None:
                    boxes, _ = mtcnn.detect(pil_img)
                    if boxes is not None: face_box = boxes[0]
                
                if face_box is not None:
                    x1, y1, x2, y2 = map(int, face_box)
                    face_crop = pil_img.crop((max(0, x1), max(0, y1), min(pil_img.width, x2), min(pil_img.height, y2)))
                    face_frames.append(spatial_preprocess(face_crop))
            
            # --- Stream 4: Temporal ---
            if USE_TEMPORAL:
                temporal_frames.append(temporal_preprocess(pil_img)) # R3D-18 uses ImageNet norm

        if len(global_frames) > 0:
            total_clips_analyzed += 1
            
            with torch.no_grad():
                # 1. Face Score (Xception on face crops)
                avg_face = 0.0
                if len(face_frames) > 0:
                    f_input = torch.stack(face_frames).to(DEVICE)
                    f_scores = torch.sigmoid(spatial_model(f_input)).cpu().numpy()
                    avg_face = float(np.mean(f_scores))
                
                # 2. Global Score (EfficientNet-B4 on full frames)
                g_input = torch.stack(global_frames).to(DEVICE)
                g_scores = torch.sigmoid(global_model(g_input)).cpu().numpy()
                avg_global = float(np.mean(g_scores))
                
                # 3. Frequency Score (EfficientNet-B0 on noise residuals, sigmoid 1-logit)
                freq_input = torch.stack(freq_frames).to(DEVICE)
                freq_scores = torch.sigmoid(freq_model(freq_input)).cpu().numpy()
                avg_freq = float(np.mean(freq_scores))
                
                # 3. Temporal Score
                t_score = 0.0
                if USE_TEMPORAL and len(temporal_frames) == NUM_FRAMES:
                    try:
                        t_input = torch.stack(temporal_frames).unsqueeze(0).to(DEVICE)
                        t_output = temporal_model(t_input)
                        t_score = torch.softmax(t_output, dim=1)[0, 1].item()
                    except Exception as e:
                        print(f"[*] Temporal error: {e}")

            # --- ADVANCED FUSION LOGIC (Matching Old Production System) ---
            if avg_face < 0.01:
                # No meaningful face signal → redistribute face weight to global
                combined_clip_score = (t_score * 0.55) + (avg_global * 0.35) + (avg_freq * 0.10)
            else:
                # Normal: 70% Temporal + 15% Face + 10% Global + 5% Frequency
                combined_clip_score = (t_score * 0.70) + (avg_face * 0.15) + (avg_global * 0.10) + (avg_freq * 0.05)
            
            #  GENERATIVE GUARD: Only override when face ALSO shows manipulation signal.
            #  Global/freq alone fire on compressed video, TV graphics, text overlays → false positives.
            if (avg_global > 0.85 or avg_freq > 0.85) and avg_face > 0.3:
                combined_clip_score = max(combined_clip_score, 0.85)
            
            is_fake = combined_clip_score >= CLIP_THRESHOLD
            
            # --- 📸 FORENSIC PREVIEW GENERATION (1-Min Life) ---
            # Save a representative frame for the UI. (Face if found, else Global)
            image_url = None
            if save_previews:
                try:
                    import time, random, string
                    rand_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=6))
                    filename = f"ui_preview_{int(time.time())}_{rand_id}_frame.jpg"
                    save_path = os.path.join("static/forensics", filename)
                    
                    # Use the last frame from the clip as the preview
                    # Convert back to BGR for OpenCV
                    preview_frame = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
                    
                    # If a face was found, we could draw a bounding box (optional)
                    if face_box is not None:
                        x1, y1, x2, y2 = map(int, face_box)
                        cv2.rectangle(preview_frame, (x1, y1), (x2, y2), (0, 0, 255) if is_fake else (0, 255, 0), 2)
                    
                    cv2.imwrite(save_path, preview_frame)
                    image_url = f"/static/forensics/{filename}"
                except Exception as e:
                    print(f"[*] Preview Save Fail: {e}")

            clip_details.append({
                "start_frame": start_frame,
                "timestamp": round(float(start_frame / fps), 2) if fps > 0 else 0,
                "imageUrl": image_url,
                "face_score": round(avg_face, 4),
                "global_score": round(avg_global, 4),
                "freq_score": round(avg_freq, 4),
                "temporal_score": round(t_score, 4),
                "score": round(float(combined_clip_score), 4), 
                "label": "FAKE" if is_fake else "REAL"
            })
                
    cap.release()
    
    if total_clips_analyzed == 0:
        return {"verdict": "NEEDS_REVIEW", "status": "INCONCLUSIVE", "confidence": 0.0, "message": "Insufficient data for forensic analysis."}

    # --- 🔒 ROBUST AGGREGATION ---
    all_scores = [c["score"] for c in clip_details]
    mean_score = float(np.mean(all_scores))
    
    # Clip-Level Voting
    fake_clips_list = [c for c in clip_details if c["label"] == "FAKE"]
    fake_ratio = len(fake_clips_list) / total_clips_analyzed if total_clips_analyzed > 0 else 0
    
    # 🛡️ TEMPORAL DENSITY CHECK: Detect high-motion content (dance, sports, action).
    # When temporal fires on >50% of clips, it's likely reacting to fast motion, not manipulation.
    # Real deepfakes have temporal artifacts in SPECIFIC segments, not across the entire video.
    temporal_scores = [c["temporal_score"] for c in clip_details]
    high_temporal_clips = sum(1 for t in temporal_scores if t > 0.6)
    temporal_density = high_temporal_clips / total_clips_analyzed if total_clips_analyzed > 0 else 0
    
    if temporal_density > 0.35:
        # HIGH-MOTION MODE: Fast-cut / action / compressed content — temporal is unreliable
        # Require very strong evidence to call FAKE
        is_systemic_fake = fake_ratio >= 0.70 or mean_score >= 0.65
        print(f"[*] High-motion content detected (temporal density={temporal_density:.0%}). Raising thresholds.")
    else:
        # STANDARD MODE: Normal content — trust temporal signal
        is_systemic_fake = fake_ratio >= 0.20 or mean_score >= 0.40
    
    if is_systemic_fake:
        verdict = "FAKE"
        message = f"Synthetic artifacts detected in {round(fake_ratio*100)}% of analyzed segments. Forensic indicators: Temporal/motion stream flagged manipulation."
        # Confidence scales based on fake ratio
        conf = 0.65 + (fake_ratio * 0.35)
    else:
        verdict = "REAL"
        message = "No systemic manipulations detected. Natural grain and motion consistencies verified across all forensic streams."
        # Confidence increases as mean score stays low
        conf = 0.85 + (0.40 - mean_score) * 0.25
    
    # Penalties for sparse evidence or inconclusive frames
    if total_clips_analyzed < 5: 
        conf *= (total_clips_analyzed / 5.0)
    
    # Return ALL evidence points for full transparency
    top_suspicious = sorted(clip_details, key=lambda x: x["score"], reverse=True)
    
    return {
        "verdict": verdict,
        "label": verdict,
        "type": "video",
        "domain": "MULTI_STREAM_FUSION",
        "weighted_score": round(mean_score, 4),
        "fake_ratio": round(fake_ratio, 4),
        "clips_analyzed": int(total_clips_analyzed),
        "fake_clips": len(fake_clips_list),
        "full_forensic_timeline": clip_details,
        "top_suspicious_frames": top_suspicious,
        "confidence": round(min(0.99, max(0.1, conf)), 4),
        "message": message
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        result = run_forensic_video_analysis(sys.argv[1])
        print(result)
