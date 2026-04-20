import torch
import cv2
import numpy as np
from PIL import Image
from model import DeepfakeTimeSformer, get_model # get_model returns the Xception
from torchvision import transforms

# --- CONFIG ---
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
SPATIAL_WEIGHTS = "xception_spatial.pth"
TEMPORAL_WEIGHTS = "video_temporal_model.pth"
NUM_FRAMES = 16
CLIP_THRESHOLD = 0.55 # Logic: individual clip score
VIDEO_VERDICT_RATIO = 0.35 # Logic: 35% clips fake = FAKE video

# --- MODELS ---
def load_fusion_system():
    # 1. Spatial Model (Xception)
    spatial_model = get_model(pretrained=False).to(DEVICE)
    spatial_model.load_state_dict(torch.load(SPATIAL_WEIGHTS, map_location=DEVICE))
    spatial_model.eval()

    # 2. Temporal Model (TimeSformer)
    temporal_model = DeepfakeTimeSformer(num_frames=NUM_FRAMES).to(DEVICE)
    temporal_model.load_state_dict(torch.load(TEMPORAL_WEIGHTS, map_location=DEVICE))
    temporal_model.eval()
    
    return spatial_model, temporal_model

# --- PREPROCESSING ---
preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def run_fusion_inference(video_path):
    spatial_model, temporal_model = load_fusion_system()
    
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    # Step 1: Smart Sampling (8-12 clips across duration)
    # Each clip is 16 consecutive frames
    num_total_clips = 12 
    step_size = max(1, (total_frames - NUM_FRAMES) // num_total_clips)
    
    fake_clips_count = 0
    total_clips_analyzed = 0
    
    print(f"[*] Analyzing video: {video_path}...")
    
    for start_frame in range(0, total_frames - NUM_FRAMES, step_size):
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        clip_frames = []
        spatial_scores = []
        
        for _ in range(NUM_FRAMES):
            ret, frame = cap.read()
            if not ret: break
            
            # TODO: Add MTCNN face detection/cropping here for production
            # For logic demo, we assume the video is centered on a face
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            img_tensor = preprocess(pil_img).to(DEVICE)
            
            # Individual Spatial Score (Xception)
            with torch.no_grad():
                s_score = torch.sigmoid(spatial_model(img_tensor.unsqueeze(0))).item()
                spatial_scores.append(s_score)
            
            clip_frames.append(img_tensor)
            
        if len(clip_frames) == NUM_FRAMES:
            total_clips_analyzed += 1
            clip_tensor = torch.stack(clip_frames).to(DEVICE) # (T, C, H, W)
            
            # Temporal Score (TimeSformer)
            with torch.no_grad():
                # TimeSformer expects (B, T, C, H, W)
                t_output = temporal_model(clip_tensor.unsqueeze(0))
                t_score = torch.softmax(t_output, dim=1)[0, 1].item() # Prob of class 1 (FAKE)
            
            # Fusion: Clip is FAKE if (Temporal High) OR (Spatial consistently High)
            avg_spatial = np.mean(spatial_scores)
            
            # Simple Fusion Rule: Prioritize Temporal, use Spatial as Artifact signal
            combined_clip_score = 0.7 * t_score + 0.3 * avg_spatial
            
            if combined_clip_score >= CLIP_THRESHOLD:
                fake_clips_count += 1
                
    cap.release()
    
    # Step 3: Video-Level Aggregation
    fake_ratio = fake_clips_count / total_clips_analyzed if total_clips_analyzed > 0 else 0
    verdict = "FAKE" if fake_ratio >= VIDEO_VERDICT_RATIO else "REAL"
    
    return {
        "verdict": verdict,
        "fake_ratio": round(fake_ratio, 4),
        "clips_analyzed": total_clips_analyzed,
        "fake_clips": fake_clips_count
    }

if __name__ == "__main__":
    # Example usage
    # res = run_fusion_inference("sample_video.mp4")
    # print(res)
    pass
