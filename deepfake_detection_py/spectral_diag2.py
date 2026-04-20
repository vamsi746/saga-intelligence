"""
Extended spectral diagnostics with noise uniformity analysis.
Real cameras: noise varies with brightness (dark areas are noisier).
AI generators: noise is artificially uniform regardless of brightness.
"""
import numpy as np
from PIL import Image, ImageFilter
import os

def compute_noise_uniformity(img_pil):
    """
    Measure how uniform the noise level is across different brightness bands.
    Real camera photos: noise varies with exposure (dark=noisier due to photon shot noise).
    AI images: noise is artificially uniform (no sensor physics).
    Returns a score 0-1 where HIGHER = more uniform = more likely AI.
    """
    gray = np.array(img_pil.convert("L"), dtype=np.float64)
    
    # Compute noise residual
    blur = np.array(img_pil.convert("L").filter(ImageFilter.GaussianBlur(radius=2)), dtype=np.float64)
    noise = gray - blur
    
    # Split into brightness bands
    bands = [(0, 50), (50, 100), (100, 150), (150, 200), (200, 256)]
    band_stds = []
    
    for low, high in bands:
        mask = (gray >= low) & (gray < high)
        if mask.sum() > 100:  # Need enough pixels
            band_noise = noise[mask]
            band_stds.append(np.std(band_noise))
    
    if len(band_stds) < 3:
        return 0.5  # Not enough bands to judge
    
    # Coefficient of variation of noise std across bands
    # Low CV = uniform noise = likely AI
    # High CV = varying noise = likely real camera
    mean_std = np.mean(band_stds)
    cv_noise = np.std(band_stds) / mean_std if mean_std > 0 else 0
    
    return {
        "noise_cv": round(cv_noise, 4),
        "band_stds": [round(s, 3) for s in band_stds],
        "mean_noise_std": round(mean_std, 3),
    }

def compute_color_channel_correlation(img_pil):
    """
    Real cameras have correlated noise across R/G/B (from Bayer demosaicing).
    AI generators produce more independent channel noise.
    """
    arr = np.array(img_pil.convert("RGB"), dtype=np.float64)
    blur = np.array(img_pil.convert("RGB").filter(ImageFilter.GaussianBlur(radius=2)), dtype=np.float64)
    noise = arr - blur
    
    # Flatten and compute cross-channel correlations
    r_noise = noise[:,:,0].flatten()
    g_noise = noise[:,:,1].flatten()
    b_noise = noise[:,:,2].flatten()
    
    # Subsample for speed
    n = min(100000, len(r_noise))
    idx = np.random.choice(len(r_noise), n, replace=False)
    r, g, b = r_noise[idx], g_noise[idx], b_noise[idx]
    
    rg_corr = np.corrcoef(r, g)[0, 1]
    rb_corr = np.corrcoef(r, b)[0, 1]
    gb_corr = np.corrcoef(g, b)[0, 1]
    
    mean_corr = (rg_corr + rb_corr + gb_corr) / 3
    
    return {
        "rg_corr": round(rg_corr, 4),
        "rb_corr": round(rb_corr, 4),
        "gb_corr": round(gb_corr, 4),
        "mean_channel_corr": round(mean_corr, 4),
    }

def compute_local_variance_consistency(img_pil):
    """
    Real photos: Local noise variance varies spatially (textures, edges, flat areas).
    AI photos: More uniform local statistics.
    """
    gray = np.array(img_pil.convert("L"), dtype=np.float64)
    blur = np.array(img_pil.convert("L").filter(ImageFilter.GaussianBlur(radius=2)), dtype=np.float64)
    noise = gray - blur
    
    # Divide into 8x8 grid of patches
    h, w = noise.shape
    ph, pw = h // 8, w // 8
    
    patch_vars = []
    for i in range(8):
        for j in range(8):
            patch = noise[i*ph:(i+1)*ph, j*pw:(j+1)*pw]
            patch_vars.append(np.var(patch))
    
    patch_vars = np.array(patch_vars)
    mean_var = np.mean(patch_vars)
    cv_patches = np.std(patch_vars) / mean_var if mean_var > 0 else 0
    
    return {
        "patch_var_cv": round(cv_patches, 4),
        "patch_var_mean": round(mean_var, 3),
        "patch_var_std": round(np.std(patch_vars), 3),
    }


if __name__ == "__main__":
    np.random.seed(42)
    
    images = [
        (r"C:\Users\LakshmiNarayana\Downloads\testnow.jpeg", "REAL"),
        (r"C:\Users\LakshmiNarayana\Downloads\WhatsApp Image 2026-02-26 at 6.33.03 PM.jpeg", "REAL-WA"),
        (r"C:\Users\LakshmiNarayana\Downloads\WhatsApp Image 2026-02-28 at 8.32.52 PM.jpeg", "REAL-WA2"),
        (r"C:\Users\LakshmiNarayana\Downloads\real4.jpg", "REAL4"),
        (r"C:\Users\LakshmiNarayana\Downloads\ii4.jpg", "REAL-ii4"),
        (r"C:\Users\LakshmiNarayana\Downloads\gemtest.png", "FAKE-Gem"),
        (r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_86k5g486k5g486k5.png", "FAKE-Gem2"),
        (r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_otibwzotibwzotib.png", "FAKE-Gem3"),
        (r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_pkd4ospkd4ospkd4.png", "FAKE-Gem4"),
        (r"C:\Users\LakshmiNarayana\Downloads\ChatGPT Image Feb 18, 2026, 09_28_24 PM.png", "FAKE-GPT1"),
        (r"C:\Users\LakshmiNarayana\Downloads\ChatGPT Image Feb 23, 2026, 10_56_28 AM.png", "FAKE-GPT2"),
    ]
    
    print("{:<12} {:>8} {:>8} {:>8} {:>8} {:>8}".format(
        "Label", "NoiseCV", "ChanCorr", "PatchCV", "MeanNoise", "PatchMean"))
    print("-" * 60)
    
    for path, label in images:
        if not os.path.exists(path):
            print("{:<12} FILE NOT FOUND".format(label))
            continue
        img = Image.open(path).convert("RGB")
        nu = compute_noise_uniformity(img)
        cc = compute_color_channel_correlation(img)
        lv = compute_local_variance_consistency(img)
        print("{:<12} {:>8.4f} {:>8.4f} {:>8.4f} {:>8.3f} {:>8.3f}".format(
            label, nu["noise_cv"], cc["mean_channel_corr"], lv["patch_var_cv"],
            nu["mean_noise_std"], lv["patch_var_mean"]))
