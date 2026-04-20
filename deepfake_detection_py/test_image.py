import requests, json

url = "http://localhost:8001/detect/image"
image_path = r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_86k5g486k5g486k5.png"

with open(image_path, "rb") as f:
    files = {"file": (image_path.split("\\")[-1], f, "image/png")}
    resp = requests.post(url, files=files, timeout=120)

d = resp.json()
print(json.dumps(d, indent=2))
