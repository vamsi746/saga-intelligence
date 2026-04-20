import requests, json, sys, time

url = "http://localhost:8001/detect/video"

videos = [
    (r"C:\Users\LakshmiNarayana\Downloads\Tom_Cruise_is_Iron_Man_DeepFake_720P.mp4", "FAKE (Tom Cruise deepfake)"),
]

for video_path, expected in videos:
    name = video_path.split("\\")[-1][:40]
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print(f"Expected: {expected}")
    
    with open(video_path, "rb") as f:
        files = {"file": ("test.mp4", f, "video/mp4")}
        resp = requests.post(url, files=files, timeout=600)

    d = resp.json()
    verdict = d.get("verdict")
    score = d.get("weighted_score")
    fake_ratio = d.get("fake_ratio")
    clips = d.get("clips_analyzed")
    fake_clips = d.get("fake_clips")
    
    status = "PASS" if expected.startswith(verdict) else "FAIL"
    print(f"Result:   {verdict} | Score={score} | FakeRatio={fake_ratio} | Clips={clips} ({fake_clips} fake)")
    print(f"Status:   [{status}]")
    print(f"{'='*60}")
