import sys
import os
# Path fix for server deployment - MUST be before local imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import shutil
import time
from training.train import train

FEEDBACK_FILE = "data/feedback_samples.jsonl"
TRAIN_FILE = "data/train.jsonl"
MIN_SAMPLES_FOR_RETRAIN = 100

def check_and_retrain():
    if not os.path.exists(FEEDBACK_FILE):
        return

    # count lines (filter empty lines)
    with open(FEEDBACK_FILE, 'r', encoding='utf-8') as f:
        lines = [l for l in f.readlines() if l.strip()]
    
    if len(lines) >= MIN_SAMPLES_FOR_RETRAIN:
        print(f"Found {len(lines)} feedback samples. Triggering retraining...")
        
        # Merge feedback into training data
        with open(TRAIN_FILE, 'a', encoding='utf-8') as f_train:
            for line in lines:
                f_train.write(line)
        
        # Clear feedback file
        open(FEEDBACK_FILE, 'w', encoding='utf-8').close()
        
        # Trigger Training
        train()
        print("Retraining Complete. Feedback Merged.")
        
        # Notify API to reload the new model
        try:
            import urllib.request
            print("Notifying API to reload model...")
            req = urllib.request.Request("http://localhost:8006/reload-model", method="POST")
            with urllib.request.urlopen(req) as response:
                print(f"Reload Status: {response.read().decode()}")
        except Exception as e:
            print(f"Failed to notify API for reload: {e}")
    else:
        print(f"Insufficient samples for retraining ({len(lines)}/{MIN_SAMPLES_FOR_RETRAIN})")

if __name__ == "__main__":
    import sys
    
    if "--run-once" in sys.argv:
        print("Running in single-pass mode...")
        check_and_retrain()
    else:
        print(f"Starting Retraining Monitor... (Threshold: {MIN_SAMPLES_FOR_RETRAIN} samples)")
        print("Checking for feedback every 60 minutes.")
        
        while True:
            try:
                check_and_retrain()
            except Exception as e:
                print(f"Error in retraining loop: {e}")
            
            # Sleep for 1 hour
            time.sleep(3600)
