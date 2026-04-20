import sys
import os

# Path fix for server deployment - MUST be before local imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import List, Optional
import torch
import datetime
import subprocess
import json
from risk_model.model import RiskScoringModel
from risk_model.tokenizer import RiskTokenizer
from risk_model.features import FeatureProcessor
import uvicorn

app = FastAPI(title="Blura Risk Scoring Service")

# Paths
MODEL_PATH = "artifacts/risk_model"

# Global Model Vars
model = None
tokenizer = None
feature_processor = None
# Force CPU if requested or if CUDA has compatibility issues
FORCE_CPU = os.getenv("FORCE_CPU", "false").lower() == "true"
device = torch.device('cpu') if FORCE_CPU else torch.device('cuda' if torch.cuda.is_available() else 'cpu')
if FORCE_CPU:
    print("[*] Manual Override: Forcing CPU Mode.")

class RiskRequest(BaseModel):
    text: str
    category: str
    legal_sections: List[str]

class RiskResponse(BaseModel):
    risk: str
    confidence: float
    method: str  # "ML" or "Rule-Based"

from transformers import pipeline

# Global Zero-Shot Pipeline
zero_shot_classifier = None

def load_model():
    global model, tokenizer, feature_processor, zero_shot_classifier
    
    # 1. Load Zero-Shot Classifier (Small & Multilingual)
    try:
        model_name = "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli"
        print(f"Loading Zero-Shot Classifier ({model_name})...")
        
        # Try GPU first, fallback to CPU
        try:
            use_gpu = torch.cuda.is_available() and not FORCE_CPU
            zero_shot_classifier = pipeline(
                "zero-shot-classification", 
                model=model_name,
                device=0 if use_gpu else -1
            )
        except Exception as cu_err:
            print(f"GPU Load failed ({cu_err}), falling back to CPU...")
            zero_shot_classifier = pipeline(
                "zero-shot-classification", 
                model=model_name,
                device=-1
            )
            
        print("Zero-Shot Classifier Loaded Successfully.")
    except Exception as e:
        print(f"CRITICAL: Failed to load Zero-Shot Classifier: {e}")

    # 2. Load fine-tuned model if exists
    try:
        if os.path.exists(os.path.join(MODEL_PATH, "pytorch_model.bin")):
            print("Loading Fine-tuned ML Model...")
            tokenizer = RiskTokenizer.from_pretrained(MODEL_PATH)
            feature_processor = FeatureProcessor()
            model = RiskScoringModel(num_categorical_features=feature_processor.get_input_dim())
            model.load_state_dict(torch.load(os.path.join(MODEL_PATH, "pytorch_model.bin"), map_location=device))
            model.to(device)
            model.eval()
            print("Fine-tuned ML Model Loaded Successfully.")
            return True
    except Exception as e:
        print(f"Failed to load fine-tuned model: {e}")
    
    return zero_shot_classifier is not None

# Initialize on startup (Startup event is deprecated in newer FastAPI, but keeping for compatibility)
@app.on_event("startup")
async def startup_event():
    load_model()

def rule_based_fallback(category: str, legal_sections: List[str]) -> (str, float):
    """
    Fallback logic until ML model is trained.
    """
    high_risk_cats = ["Threat", "Sexual_Violence", "Hate_Speech_Threat", "Hate_Speech_Threat_Extremist", "threat_incitement"]
    medium_risk_cats = ["Hate_Speech", "Harassment", "Abusive", "Sexual_Harassment", "Communal_Violence"]
    
    if category in high_risk_cats:
        return "HIGH", 0.95
    elif category in medium_risk_cats:
        return "MEDIUM", 0.80
    elif len(legal_sections) > 0:
        return "MEDIUM", 0.75
    else:
        return "LOW", 0.99

def calculate_zero_shot_risk(text: str) -> dict:
    """
    Independent intent reading using Zero-Shot.
    """
    global zero_shot_classifier, device, FORCE_CPU
    
    if not zero_shot_classifier:
        return {"risk": "LOW", "confidence": 0.0, "intent": "Neutral"}

    labels = ["Violence", "Hate Speech", "Threat", "Neutral"]
    
    try:
        # Hypothesis template for better accuracy
        result = zero_shot_classifier(text, labels, hypothesis_template="This text expresses {}.")
        
        intent = result['labels'][0]
        confidence = result['scores'][0]
        
        # Logic: High confidence in an unsafe intent = High risk
        risk_level = "LOW"
        if intent in ["Violence", "Hate Speech", "Threat"]:
            if confidence > 0.7:
                 risk_level = "HIGH"
            elif confidence > 0.4:
                 risk_level = "MEDIUM"
                 
        # Special Case: If Neutral is clearly dominant, it's LOW
        neutral_idx = result['labels'].index("Neutral")
        if result['scores'][neutral_idx] > 0.8:
            risk_level = "LOW"
            confidence = result['scores'][neutral_idx]

        return {
            "risk": risk_level,
            "confidence": confidence,
            "intent": intent
        }
    except RuntimeError as e:
        if "CUDA error" in str(e):
            print(f"[!] CUDA EXECUTION ERROR: {e}")
            print("[*] Automatically switching to CPU mode for stability...")
            
            # Switch global state
            FORCE_CPU = True
            device = torch.device('cpu')
            
            # Re-initialize classifier on CPU
            model_name = "MoritzLaurer/mDeBERTa-v3-base-mnli-xnli"
            zero_shot_classifier = pipeline(
                "zero-shot-classification", 
                model=model_name,
                device=-1
            )
            
            # Retry once on CPU
            return calculate_zero_shot_risk(text)
        else:
            raise e

def run_finetuned_inference(text: str, category: str, legal_sections: List[str]):
    global model, tokenizer, feature_processor, device
    try:
        inputs = tokenizer.encode([text])
        input_ids = inputs['input_ids'].to(device)
        attention_mask = inputs['attention_mask'].to(device)
        
        cat_features = feature_processor.process(category, legal_sections)
        cat_tensor = torch.tensor([cat_features], dtype=torch.float32).to(device)
        
        with torch.no_grad():
            logits = model(input_ids, attention_mask, cat_tensor)
            probs = torch.softmax(logits, dim=1)
            ft_conf, pred = torch.max(probs, dim=1)
            
        ft_risk = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}.get(pred.item(), "LOW")
        return ft_risk, ft_conf.item(), "ML-Fused"
    except Exception as e:
        print(f"Fine-tuned Inference Technical Failure: {e}")
        return None

@app.post("/score-risk", response_model=RiskResponse)
async def score_risk(request: RiskRequest):
    global model
    
    # 1. Primary Zero-Shot Intelligence (Final Word on Intent)
    # Use run_in_threadpool to prevent blocking the event loop during heavy ML inference
    zs_result = await run_in_threadpool(calculate_zero_shot_risk, request.text)
    
    # 2. Refine with Fine-tuned Model (if available)
    final_risk = zs_result["risk"]
    final_confidence = zs_result["confidence"]
    method = "Zero-Shot"

    if model:
        # Run fine-tuned inference in threadpool as well
        ft_results = await run_in_threadpool(run_finetuned_inference, request.text, request.category, request.legal_sections)
        if ft_results:
            ft_risk, ft_conf, ft_method = ft_results
            # Blend: If fine-tuned model is very confident, let it influence or override
            if ft_conf > 0.9 and ft_risk != final_risk:
                final_risk = ft_risk
                final_confidence = ft_conf
                method = ft_method

    return {
        "risk": final_risk,
        "confidence": final_confidence,
        "method": method
    }

@app.post("/reload-model")
async def reload_model():
    """Hot-reload the ML model after retraining without restarting the service."""
    success = load_model()
    # Also reload the escalation detector to pick up new training data
    escalation_detector.load_data()
    return {
        "success": success,
        "method": "ML" if success else "Rule-Based",
        "message": "Model reloaded successfully." if success else "No model found. Using Rule-Based Fallback."
    }

class FeedbackRequest(BaseModel):
    text: str
    category: Optional[str] = "Normal"
    legal_sections: Optional[List[str]] = []
    review_status: str
    current_risk: Optional[str] = None

@app.post("/record-feedback")
async def record_feedback_endpoint(request: FeedbackRequest):
    try:
        # Simple risk mapping
        final_risk = "LOW"
        if request.review_status == 'false_positive':
            final_risk = "HIGH" if (request.current_risk or "").upper() == "LOW" else "LOW"
        elif request.review_status == 'escalated':
            final_risk = "HIGH"
        elif request.review_status == 'acknowledged':
            final_risk = request.current_risk if (request.current_risk or "").upper() in ["HIGH", "MEDIUM"] else "MEDIUM"

        sample = {
            "text": request.text,
            "category": request.category or "Normal",
            "legal_sections": request.legal_sections or [],
            "final_risk": final_risk,
            "timestamp": datetime.datetime.now().isoformat(),
            "source_feedback": request.review_status
        }

        with open(FEEDBACK_DATA_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(sample, ensure_ascii=False) + '\n')
            
        # Check count for retraining
        with open(FEEDBACK_DATA_PATH, 'r', encoding='utf-8') as f:
            count = sum(1 for line in f)
        
        retraining = False
        if count >= 100:
            retraining = True
            subprocess.Popen(["venv/bin/python", "training/retrain_job.py", "--run-once"])

        return {"status": "success", "message": f"Recorded. Count: {count}", "retraining_triggered": retraining}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import json
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# ... (existing imports)

# Dataset Path
TRAIN_DATA_PATH = os.path.join(os.path.dirname(__file__), "../data/train.jsonl")
FEEDBACK_DATA_PATH = os.path.join(os.path.dirname(__file__), "../data/feedback_samples.jsonl")

class EscalationDetector:
    def __init__(self):
        self.vectorizer = None
        self.escalated_texts = []
        self.escalated_vectors = None
        self.load_data()

    def load_data(self):
        try:
            texts = []
            # 1. Load from Training Data
            if os.path.exists(TRAIN_DATA_PATH):
                with open(TRAIN_DATA_PATH, 'r', encoding='utf-8') as f:
                    for line in f:
                        try:
                            record = json.loads(line)
                            if record.get('source_feedback') == 'escalated':
                                if isinstance(record.get('text'), str):
                                    texts.append(record['text'])
                        except:
                            continue
            
            # 2. Load from Recent Feedback (Not yet trained)
            if os.path.exists(FEEDBACK_DATA_PATH):
                with open(FEEDBACK_DATA_PATH, 'r', encoding='utf-8') as f:
                    for line in f:
                        try:
                            record = json.loads(line)
                            if record.get('source_feedback') == 'escalated':
                                if isinstance(record.get('text'), str):
                                    texts.append(record['text'])
                        except:
                            continue

            if texts:
                self.escalated_texts = texts
                self.vectorizer = TfidfVectorizer(stop_words='english')
                self.escalated_vectors = self.vectorizer.fit_transform(texts)
                print(f"Loaded {len(texts)} escalated samples for similarity check (Train + Feedback).")
            else:
                print("No escalated samples found in data.")
        except Exception as e:
            print(f"Error loading escalation data: {e}")

    def check_similarity(self, text, threshold=0.85):
        if not self.vectorizer or self.escalated_vectors is None:
            return 0.0, None

        try:
            print(f"Checking similarity for: {text[:50]}...")
            input_vec = self.vectorizer.transform([text])
            similarities = cosine_similarity(input_vec, self.escalated_vectors).flatten()
            
            # Find best match
            if len(similarities) == 0:
                print("No similarities computed.")
                return 0.0, None

            best_idx = np.argmax(similarities)
            max_score = float(similarities[best_idx])
            
            print(f"Max Similarity Score: {max_score}")

            if max_score >= threshold:
                matched_text = self.escalated_texts[best_idx]
                print(f"MATCH FOUND! Score: {max_score}")
                print(f"Matched against: {matched_text[:50]}...")
                return max_score, matched_text
            return max_score, None
        except Exception as e:
            print(f"Similarity check failed: {e}")
            return 0.0, None

# Initialize Detector
escalation_detector = EscalationDetector()

class SimilarityRequest(BaseModel):
    text: str

@app.post("/similar-escalated")
async def check_escalated_similarity(request: SimilarityRequest):
    score, match = escalation_detector.check_similarity(request.text, threshold=0.85)
    return {
        "is_similar": score >= 0.85,
        "score": score,
        "matched_text": match
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8006)
