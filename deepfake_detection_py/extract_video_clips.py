import os
import cv2
import torch
import numpy as np
from facenet_pytorch import MTCNN
from PIL import Image
from tqdm import tqdm

# --- CONFIG ---
DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
RAW_VIDEO_PATH = os.path.join(DATA_ROOT, "FaceForensics")
PROCESSED_CLIP_PATH = os.path.join(DATA_ROOT, "datasets", "video_clips_16f")
CLIP_LENGTH = 16  # As per Locked Plan (16-32 frames)
TARGET_SIZE = (224, 224)
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

# Initialize MTCNN for face tracking/extraction
mtcnn = MTCNN(keep_all=False, device=DEVICE, post_process=False)

def extract_clips_from_video(video_path, output_dir, label):
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    # Calculate how many non-overlapping clips we can get
    num_clips = total_frames // CLIP_LENGTH
    
    video_name = os.path.basename(video_path).split('.')[0]
    
    for c in range(num_clips):
        frames = []
        # Extract consecutive frames for the clip
        for i in range(CLIP_LENGTH):
            ret, frame = cap.read()
            if not ret: break
            
            # Detect and crop face (ensuring consistency)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            
            # For the first frame of the clip, we find the face bounding box
            if i == 0:
                boxes, _ = mtcnn.detect(pil_img)
                if boxes is None:
                    break # Skip clip if no face in first frame
                box = boxes[0] # Track primary face
                
            # Crop to the tracked face box
            face = pil_img.crop(box).resize(TARGET_SIZE)
            frames.append(np.array(face))
            
        if len(frames) == CLIP_LENGTH:
            # Save the clip as a numpy tensor (T, H, W, C)
            clip_array = np.stack(frames)
            save_name = f"{video_name}_clip_{c}.npy"
            save_path = os.path.join(output_dir, label, save_name)
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            np.save(save_path, clip_array)
            
    cap.release()

def main():
    # Setup directories
    for label in ['real', 'fake']:
        os.makedirs(os.path.join(PROCESSED_CLIP_PATH, label), exist_ok=True)
        
    # Example walk-through (Assuming FaceForensics++ structure)
    # This should be executed on the AWS GPU server
    print(f"[*] Starting Clip Extraction (CLIP_LENGTH={CLIP_LENGTH})...")
    
    # Mapping FaceForensics structure to classes
    folders = {
        'real': 'original_sequences',
        'fake': 'manipulated_sequences'
    }

    # Iterate through real and fake folders
    for label, folder_name in folders.items():
        class_path = os.path.expanduser(os.path.join(RAW_VIDEO_PATH, folder_name))
        if not os.path.exists(class_path):
            print(f"[!] Warning: Path not found: {class_path}")
            continue
        
        # FF++ often has nested structures (e.g., youtube/c23/videos)
        # We will search recursively for videos
        for root, dirs, files in os.walk(class_path):
            videos = [f for f in files if f.endswith(('.mp4', '.avi'))]
            for vid in tqdm(videos, desc=f"Processing {label} ({folder_name})"):
                extract_clips_from_video(
                    os.path.join(root, vid), 
                    os.path.expanduser(PROCESSED_CLIP_PATH),
                    label
                )

if __name__ == "__main__":
    main()
