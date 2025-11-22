import numpy as np
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from .utils import load_image_to_array, array_to_bytes, ImageSaveFormat
from .to_grayscale import grayscale

router = APIRouter()

def fft(image: np.ndarray, scale: float) -> np.ndarray:
    """
    Pure business logic: Compute FFT magnitude spectrum.
    """
    # Convert to grayscale first
    gray = grayscale(image)
    
    # 1. Fast Fourier Transform
    f_transform = np.fft.fft2(gray)
    f_shift = np.fft.fftshift(f_transform) # Shift zero frequency to center
    
    # 2. Log transformation to enhance visibility
    magnitude = scale * np.log(np.abs(f_shift) + 1)
    
    # 3. Normalize to 0-255
    m_min, m_max = magnitude.min(), magnitude.max()
    if m_max - m_min == 0:
        return np.zeros_like(magnitude, dtype=np.uint8)
    
    norm = (magnitude - m_min) / (m_max - m_min)
    return (norm * 255).astype(np.uint8)

@router.post("/fft")
async def fft_endpoint(image: UploadFile = File(...), scale: float = 20.0):
    img_array = await run_in_threadpool(load_image_to_array, image.file)
    
    result = await run_in_threadpool(fft, img_array, scale)
    
    content = await run_in_threadpool(array_to_bytes, result, ImageSaveFormat.PNG)
    
    return Response(content=content, media_type="image/png")