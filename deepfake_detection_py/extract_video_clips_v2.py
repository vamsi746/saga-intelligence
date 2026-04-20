import os
import cv2
import torch
import numpy as np
from facenet_pytorch import MTCNN
from PIL import Image
from tqdm import tqdm
from concurrent.futures import ProcessPoolExecutor, as_completed
import multiprocessing

# --- CONFIG ---
DATA_ROOT = r"C:\Users\LakshmiNarayana\deepfake_detection_py"
RAW_VIDEO_PATH = os.path.join(DATA_ROOT, "FaceForensics")
PROCESSED_CLIP_PATH = os.path.join(DATA_ROOT, "datasets", "video_clips_16f")
CLIP_LENGTH = 16
TARGET_SIZE = (224, 224)
# Use fewer workers if using GPU to avoid OOM, or more if CPU.
NUM_WORKERS = max(1, multiprocessing.cpu_count() // 2) 

def process_single_video(args):
    """Worker function to process one video."""
    video_path, output_dir, label = args
    
    # Initialize MTCNN inside the worker process
    # Force CPU to avoid conflicts with GPU training
    device = torch.device('cpu')
    mtcnn = MTCNN(keep_all=False, device=device, post_process=False)
    
    cap = cv2.VideoCapture(video_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    num_clips = total_frames // CLIP_LENGTH
    video_name = os.path.basename(video_path).split('.')[0]
    
    # --- SKIP CHECK ---
    # If the first clip already exists, assume video is processed
    first_clip_name = f"{video_name}_clip_0.npy"
    if os.path.exists(os.path.join(output_dir, label, first_clip_name)):
        return 0
    # ------------------

    processed_count = 0
    for c in range(num_clips):
        frames = []
        for i in range(CLIP_LENGTH):
            ret, frame = cap.read()
            if not ret: break
            
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            
            if i == 0:
                boxes, _ = mtcnn.detect(pil_img)
                if boxes is None: break
                box = boxes[0]
                
            face = pil_img.crop(box).resize(TARGET_SIZE)
            frames.append(np.array(face))
            
        if len(frames) == CLIP_LENGTH:
            clip_array = np.stack(frames)
            save_name = f"{video_name}_clip_{c}.npy"
            save_path = os.path.join(output_dir, label, save_name)
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            np.save(save_path, clip_array)
            processed_count += 1
            
    cap.release()
    return processed_count

def main():
    print(f"[*] Starting Parallel Clip Extraction (Workers={NUM_WORKERS})...")
    
    folders = {
        'real': 'original_sequences',
        'fake': 'manipulated_sequences'
    }

    pending_tasks = []
    for label, folder_name in folders.items():
        class_path = os.path.expanduser(os.path.join(RAW_VIDEO_PATH, folder_name))
        processed_path = os.path.expanduser(PROCESSED_CLIP_PATH)
        
        if not os.path.exists(class_path):
            continue
            
        for root, dirs, files in os.walk(class_path):
            for vid in files:
                if vid.endswith(('.mp4', '.avi')):
                    full_path = os.path.join(root, vid)
                    pending_tasks.append((full_path, processed_path, label))

    # Run Parallel Pool
    with ProcessPoolExecutor(max_workers=NUM_WORKERS) as executor:
        futures = [executor.submit(process_single_video, task) for task in pending_tasks]
        
        for future in tqdm(as_completed(futures), total=len(futures), desc="Total Progress"):
            try:
                future.result()
            except Exception as e:
                print(f"[!] Error processing video: {e}")

if __name__ == "__main__":
    main()
