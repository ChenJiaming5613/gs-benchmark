import numpy as np
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from .utils import load_image_to_array, array_to_bytes, ImageSaveFormat

router = APIRouter()

def grayscale(image: np.ndarray) -> np.ndarray:
    """
    Pure business logic: Convert RGB to Grayscale.
    Formula: Y = 0.299R + 0.587G + 0.114B (Perceptual Luminance)
    """
    weights = np.array([0.299, 0.587, 0.114])
    # Perform matrix multiplication on the RGB channels
    gray = np.dot(image[..., :3], weights)
    return gray.astype(np.uint8)

@router.post("/grayscale")
async def grayscale_endpoint(image: UploadFile = File(...)):
    # 1. IO Input
    img_array = await run_in_threadpool(load_image_to_array, image.file)
    
    # 2. Core Logic
    result = await run_in_threadpool(grayscale, img_array)
    
    # 3. IO Output
    content = await run_in_threadpool(array_to_bytes, result, ImageSaveFormat.PNG)
    
    return Response(content=content, media_type="image/png")