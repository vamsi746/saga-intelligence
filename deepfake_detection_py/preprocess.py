import os
import cv2
import torch
from facenet_pytorch import MTCNN
from PIL import Image
from tqdm import tqdm
import multiprocessing
from concurrent.futures import ProcessPoolExecutor, as_completed

# Configuration
BASE_DATASET_DIR = "FaceForensics"
OUTPUT_DIR = "datasets/processed_faces"
FRAME_COUNT_PER_VIDEO = 30
IMAGE_SIZE = 224
MAX_VIDEOS_PER_CATEGORY = 300 # Limit to 300 for sufficient diverse forensic data

# FF++ Specific Paths (c40 compression)
REAL_VIDEOS_DIR = os.path.join(BASE_DATASET_DIR, "original_sequences", "youtube", "c40", "videos")
FAKE_VIDEOS_DIRS = [
    os.path.join(BASE_DATASET_DIR, "manipulated_sequences", "Deepfakes", "c40", "videos"),
    os.path.join(BASE_DATASET_DIR, "manipulated_sequences", "Face2Face", "c40", "videos"),
    os.path.join(BASE_DATASET_DIR, "manipulated_sequences", "FaceSwap", "c40", "videos")
]

# Global MTCNN instance for workers (initialized per process)
_mtcnn = None

def init_worker():
    """Initializes MTCNN once per worker process."""
    global _mtcnn
    # Use CPU for detection to avoid CUDA multiprocessing complexity and memory limits
    # Detection is fast enough on modern CPUs for this offline task
    _mtcnn = MTCNN(image_size=IMAGE_SIZE, margin=20, device='cpu', post_process=False)

def extract_faces_from_video(args):
    """Samples frames from video, detects faces, and saves cropped images."""
    video_path, output_subfolder = args
    
    # Resumability check
    if os.path.exists(output_subfolder) and len(os.listdir(output_subfolder)) >= 20:
        return True

    os.makedirs(output_subfolder, exist_ok=True)
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return False
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if total_frames <= 0:
        cap.release()
        return False
    
    # Calculate interval to sample frames
    interval = max(total_frames // FRAME_COUNT_PER_VIDEO, 1)
    
    frame_idx = 0
    saved_count = 0
    
    global _mtcnn
    if _mtcnn is None:
        init_worker()

    while cap.isOpened() and saved_count < FRAME_COUNT_PER_VIDEO:
        ret, frame = cap.read()
        if not ret:
            break
        
        if frame_idx % interval == 0:
            # Convert BGR to RGB
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            
            # Detect and save face
            save_path = os.path.join(output_subfolder, f"frame_{frame_idx}.jpg")
            try:
                # mtcnn saves the cropped face to save_path if detected
                _mtcnn(pil_img, save_path=save_path)
                if os.path.exists(save_path):
                    saved_count += 1
            except Exception:
                pass
                
        frame_idx += 1
    
    cap.release()
    return True

def process_dataset():
    """Main loop to process REAL and FAKE video categories using parallel workers."""
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        
    num_workers = 4 # Balanced for safety and speed (set to 1 if Windows errors)
    print(f"[*] Starting parallel preprocessing with {num_workers} workers...")
    
    # Collect all tasks
    tasks = []
    
    # REAL videos
    if os.path.exists(REAL_VIDEOS_DIR):
        real_output = os.path.join(OUTPUT_DIR, "REAL")
        os.makedirs(real_output, exist_ok=True)
        videos = [f for f in os.listdir(REAL_VIDEOS_DIR) if f.endswith('.mp4')]
        videos = videos[:MAX_VIDEOS_PER_CATEGORY]
        for video_file in videos:
            video_path = os.path.join(REAL_VIDEOS_DIR, video_file)
            video_name = os.path.splitext(video_file)[0]
            video_output_dir = os.path.join(real_output, video_name)
            tasks.append((video_path, video_output_dir))
    
    # FAKE videos
    for fake_dir in FAKE_VIDEOS_DIRS:
        if os.path.exists(fake_dir):
            fake_output = os.path.join(OUTPUT_DIR, "FAKE")
            os.makedirs(fake_output, exist_ok=True)
            method_name = os.path.basename(os.path.dirname(os.path.dirname(fake_dir)))
            videos = [f for f in os.listdir(fake_dir) if f.endswith('.mp4')]
            videos = videos[:MAX_VIDEOS_PER_CATEGORY]
            for video_file in videos:
                video_path = os.path.join(fake_dir, video_file)
                video_name = f"{method_name}_{os.path.splitext(video_file)[0]}"
                video_output_dir = os.path.join(fake_output, video_name)
                tasks.append((video_path, video_output_dir))

    # Execute tasks in parallel
    print(f"[*] Dispatching {len(tasks)} videos for processing...")
    with ProcessPoolExecutor(max_workers=num_workers, initializer=init_worker) as executor:
        list(tqdm(executor.map(extract_faces_from_video, tasks), total=len(tasks)))

    # Verify results
    total_real = sum([len(files) for r, d, files in os.walk(os.path.join(OUTPUT_DIR, "REAL"))])
    total_fake = sum([len(files) for r, d, files in os.walk(os.path.join(OUTPUT_DIR, "FAKE"))])
    print(f"\n[✔] Preprocessing Complete (Parallel):")
    print(f"    - REAL Faces: {total_real}")
    print(f"    - FAKE Faces: {total_fake}")
    print(f"    - Total Faces: {total_real + total_fake}")

if __name__ == "__main__":
    process_dataset()
