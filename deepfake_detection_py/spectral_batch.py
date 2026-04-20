from spectral_diag import compute_spectral_features
from PIL import Image
import os

images = [
    # REAL images
    (r"C:\Users\LakshmiNarayana\Downloads\testnow.jpeg", "REAL"),
    (r"C:\Users\LakshmiNarayana\Downloads\WhatsApp Image 2026-02-26 at 6.33.03 PM.jpeg", "REAL-WA"),
    (r"C:\Users\LakshmiNarayana\Downloads\WhatsApp Image 2026-02-28 at 8.32.52 PM.jpeg", "REAL-WA"),
    (r"C:\Users\LakshmiNarayana\Downloads\real4.jpg", "REAL"),
    (r"C:\Users\LakshmiNarayana\Downloads\ii4.jpg", "REAL"),
    # AI-generated
    (r"C:\Users\LakshmiNarayana\Downloads\gemtest.png", "FAKE-Gemini"),
    (r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_86k5g486k5g486k5.png", "FAKE-Gemini"),
    (r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_otibwzotibwzotib.png", "FAKE-Gemini"),
    (r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_pkd4ospkd4ospkd4.png", "FAKE-Gemini"),
    (r"C:\Users\LakshmiNarayana\Downloads\ChatGPT Image Feb 18, 2026, 09_28_24 PM.png", "FAKE-ChatGPT"),
    (r"C:\Users\LakshmiNarayana\Downloads\ChatGPT Image Feb 23, 2026, 10_56_28 AM.png", "FAKE-ChatGPT"),
]

header = "{:<15} {:>7} {:>7} {:>8} {:>8} {:>10} {}".format("Label", "Beta", "Rough", "MidFlat", "NoiseR", "HfR", "Res")
print(header)
print("-" * 75)
for path, label in images:
    if os.path.exists(path):
        img = Image.open(path).convert("RGB")
        f = compute_spectral_features(img)
        row = "{:<15} {:>7.3f} {:>7.4f} {:>8.4f} {:>8.5f} {:>10.7f} {}".format(
            label, f["beta"], f["spectral_roughness"], f["mid_flatness"],
            f["noise_floor_ratio"], f["hf_ratio"], f["resolution"]
        )
        print(row)
    else:
        print("{:<15} FILE NOT FOUND: {}".format(label, os.path.basename(path)))
