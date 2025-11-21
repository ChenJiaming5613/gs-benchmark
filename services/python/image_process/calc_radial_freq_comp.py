import io
import numpy as np
import matplotlib
# Set backend to Agg for non-GUI environments
matplotlib.use('Agg')
from matplotlib.figure import Figure
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from .utils import load_image_to_array, ImageSaveFormat

router = APIRouter()

def compute_radial_profile(image: np.ndarray) -> np.ndarray:
    """
    Private logic: Calculate the Azimuthal Integration (Radial Power Spectrum).
    """
    # Simplified grayscale conversion
    if image.ndim == 3:
        image = np.dot(image[..., :3], [0.299, 0.587, 0.114])
    image = image / 255.0
    
    f = np.fft.fft2(image)
    fshift = np.fft.fftshift(f)
    magnitude = np.abs(fshift)
    
    h, w = magnitude.shape
    center_y, center_x = h // 2, w // 2
    y, x = np.ogrid[:h, :w]
    r = np.sqrt((x - center_x)**2 + (y - center_y)**2).astype(int)
    
    tbin = np.bincount(r.ravel(), magnitude.ravel())
    nr = np.bincount(r.ravel())
    radial = tbin / np.maximum(nr, 1)
    
    if radial[0] != 0: 
        radial = radial / radial[0]
        
    return radial

def plot_graph(gt, a1, a2, l1, l2, fmt: ImageSaveFormat) -> bytes:
    """
    Private logic: Generate the plot using Matplotlib object-oriented API.
    """
    p_gt = compute_radial_profile(gt)
    p_a1 = compute_radial_profile(a1)
    p_a2 = compute_radial_profile(a2)
    
    threshold = 1e-6
    indices = np.where(p_gt < threshold)[0]
    x_limit = int(indices[0] * 1.1) if len(indices) > 0 else len(p_gt)
    x_limit = min(x_limit, len(p_gt))

    fig = Figure(figsize=(10, 6))
    ax = fig.subplots()
    ax.set_yscale('log')
    
    ax.plot(p_gt, color='black', label='Ground Truth', linewidth=1.5, alpha=0.8)
    ax.plot(p_a1, color='blue', label=l1, linewidth=1.0)
    ax.plot(p_a2, color='red', label=l2, linewidth=1.0)
    
    ax.set_title("Azimuthal Integration (Radial Power Spectrum Comparison)", fontsize=14)
    ax.set_xlabel("Spatial Frequency (Radius)", fontsize=12)
    ax.set_ylabel("Log Power Spectrum (Normalized)", fontsize=12)
    ax.legend(fontsize=12)
    ax.grid(True, which="both", ls="-", alpha=0.2)
    ax.set_xlim(0, x_limit)

    buf = io.BytesIO()
    
    # Use the Enum value ('png' or 'svg')
    if fmt == ImageSaveFormat.PNG:
        fig.savefig(buf, format="png", bbox_inches='tight', dpi=150)
    else:
        fig.savefig(buf, format="svg", bbox_inches='tight')
        
    return buf.getvalue()

@router.post("/frequency-compare")
async def freq_comp_endpoint(
    gt: UploadFile = File(...),
    algo1: UploadFile = File(...),
    algo2: UploadFile = File(...),
    label1: str = Form("Algo 1"),
    label2: str = Form("Algo 2"),
    output_format: ImageSaveFormat = Form(ImageSaveFormat.SVG)
):
    img_gt = await run_in_threadpool(load_image_to_array, gt.file)
    img_a1 = await run_in_threadpool(load_image_to_array, algo1.file)
    img_a2 = await run_in_threadpool(load_image_to_array, algo2.file)

    if not (img_gt.shape == img_a1.shape == img_a2.shape):
        raise HTTPException(status_code=400, detail="All images must have the same dimensions")

    plot_bytes = await run_in_threadpool(
        plot_graph, img_gt, img_a1, img_a2, label1, label2, output_format
    )
    
    mime = "image/svg+xml" if output_format == ImageSaveFormat.SVG else "image/png"
    return Response(content=plot_bytes, media_type=mime)