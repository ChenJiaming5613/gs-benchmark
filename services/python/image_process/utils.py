import io
import numpy as np
from enum import Enum
from PIL import Image, UnidentifiedImageError
from fastapi import HTTPException

class ImageSaveFormat(str, Enum):
    """
    Enum for supported image save formats.
    """
    PNG = "png"
    SVG = "svg"

def load_image_to_array(file_obj) -> np.ndarray:
    """
    Common Utility: Read an UploadFile stream and convert it to an RGB Numpy array.
    """
    try:
        pil_image = Image.open(file_obj)
        # Convert to RGB to handle RGBA or Grayscale inputs consistently
        return np.array(pil_image.convert("RGB"))
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="Unable to decode image")

def array_to_bytes(image: np.ndarray, fmt: ImageSaveFormat = ImageSaveFormat.PNG, dpi: int = 72) -> bytes:
    """
    Common Utility: Encode a Numpy array into an image byte stream.
    Args:
        image: Numpy array (H, W, C)
        fmt: ImageSaveFormat Enum (PNG/SVG)
        dpi: Dots per inch (for PNG)
    """
    buffer = io.BytesIO()
    
    # Ensure the data type is uint8 for Pillow compatibility
    if image.dtype != np.uint8:
        image = image.astype(np.uint8)
    
    # Prepare saving parameters
    # fmt.value retrieves the string "png", "svg", etc.
    save_kwargs = {"format": fmt.value}
    
    if fmt == ImageSaveFormat.PNG:
        save_kwargs["dpi"] = (dpi, dpi)
        
    Image.fromarray(image).save(buffer, **save_kwargs)
    return buffer.getvalue()