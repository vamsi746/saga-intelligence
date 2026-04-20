"""
Spectral diagnostics: Measure FFT-based features on real vs AI images.
Helps calibrate the spectral AI detection heuristic.
"""
import numpy as np
from PIL import Image
import sys

def compute_spectral_features(img_pil):
    """Compute frequency-domain features from an image."""
    # Convert to grayscale float
    gray = np.array(img_pil.convert("L"), dtype=np.float64)
    h, w = gray.shape
    
    # 2D FFT
    f_transform = np.fft.fft2(gray)
    f_shift = np.fft.fftshift(f_transform)
    magnitude = np.abs(f_shift) + 1e-10  # avoid log(0)
    
    # Radial power spectrum (azimuthal average)
    cy, cx = h // 2, w // 2
    max_radius = min(cy, cx)
    
    # Create radial distance map
    y_coords, x_coords = np.ogrid[:h, :w]
    r = np.sqrt((y_coords - cy)**2 + (x_coords - cx)**2).astype(int)
    
    # Azimuthal average in radial bins
    radial_power = np.zeros(max_radius)
    for radius in range(1, max_radius):
        mask = r == radius
        if mask.any():
            radial_power[radius] = np.mean(magnitude[mask]**2)
    
    # --- Feature 1: Spectral Slope (β) ---
    # Fit log(power) = -β * log(freq) + c
    # Use mid-range frequencies (10% to 80% of Nyquist) to avoid DC and aliasing
    low_bin = max(2, int(max_radius * 0.10))
    high_bin = int(max_radius * 0.80)
    
    freqs = np.arange(low_bin, high_bin, dtype=np.float64)
    powers = radial_power[low_bin:high_bin]
    
    valid = powers > 0
    if valid.sum() > 10:
        log_f = np.log10(freqs[valid])
        log_p = np.log10(powers[valid])
        # Linear fit: log_p = slope * log_f + intercept
        slope, intercept = np.polyfit(log_f, log_p, 1)
        beta = -slope  # β is the negative slope
        
        # Residuals from power law fit
        fitted = slope * log_f + intercept
        residuals = log_p - fitted
    else:
        beta = 0.0
        residuals = np.array([0.0])
    
    # --- Feature 2: High-Frequency Energy Ratio ---
    # Ratio of energy in top 25% frequencies vs total
    cutoff_75 = int(max_radius * 0.75)
    hf_energy = np.sum(radial_power[cutoff_75:])
    total_energy = np.sum(radial_power[1:])
    hf_ratio = hf_energy / total_energy if total_energy > 0 else 0
    
    # --- Feature 3: Spectral Roughness ---
    # Variance of residuals after power law fit (real noise is rougher)
    spectral_roughness = np.std(residuals)
    
    # --- Feature 4: Mid-High Band Flatness ---
    # How flat/uniform the spectrum is in 40-70% band (AI tends to be smoother)
    mid_low = int(max_radius * 0.40)
    mid_high = int(max_radius * 0.70)
    mid_band = radial_power[mid_low:mid_high]
    if len(mid_band) > 0 and np.mean(mid_band) > 0:
        mid_flatness = np.std(mid_band) / np.mean(mid_band)  # coefficient of variation
    else:
        mid_flatness = 0.0
    
    # --- Feature 5: Noise Floor Analysis ---
    # Look at the very highest frequencies (90-98%) — sensor noise lives here
    noise_low = int(max_radius * 0.90)
    noise_high = int(max_radius * 0.98)
    noise_band = radial_power[noise_low:noise_high]
    mid_ref_band = radial_power[int(max_radius*0.50):int(max_radius*0.60)]
    
    if len(noise_band) > 0 and len(mid_ref_band) > 0 and np.mean(mid_ref_band) > 0:
        noise_floor_ratio = np.mean(noise_band) / np.mean(mid_ref_band)
    else:
        noise_floor_ratio = 0.0
    
    return {
        "beta": round(beta, 4),
        "hf_ratio": round(hf_ratio, 6),
        "spectral_roughness": round(spectral_roughness, 4),
        "mid_flatness": round(mid_flatness, 4),
        "noise_floor_ratio": round(noise_floor_ratio, 6),
        "resolution": f"{w}x{h}",
    }

if __name__ == "__main__":
    images = [
        (r"C:\Users\LakshmiNarayana\Downloads\testnow.jpeg", "REAL (testnow.jpeg)"),
        (r"C:\Users\LakshmiNarayana\Downloads\gemtest.png", "FAKE/AI (gemtest.png - Gemini)"),
    ]
    
    # Also test the earlier Gemini image if it exists
    import os
    gemini_old = r"C:\Users\LakshmiNarayana\Downloads\Gemini_Generated_Image_86k5g486k5g486k5.png"
    if os.path.exists(gemini_old):
        images.append((gemini_old, "FAKE/AI (Gemini single portrait)"))
    
    for path, label in images:
        try:
            img = Image.open(path).convert("RGB")
            features = compute_spectral_features(img)
            print(f"\n{'='*60}")
            print(f"  {label}")
            print(f"  {path}")
            print(f"{'='*60}")
            for k, v in features.items():
                print(f"  {k:25s}: {v}")
        except Exception as e:
            print(f"ERROR on {path}: {e}")
