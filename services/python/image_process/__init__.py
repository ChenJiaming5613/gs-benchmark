from fastapi import APIRouter

# 1. Import Routers from sub-modules (for Web API)
from .to_grayscale import router as grayscale_router
from .calc_fft import router as fft_router
from .calc_radial_freq_comp import router as freq_comp_router

# 2. Import Core Logic & Enums (for direct library usage)
from .utils import ImageSaveFormat
from .to_grayscale import grayscale
from .calc_fft import fft
from .calc_radial_freq_comp import plot_graph

# 3. Setup Main Router
# This prefix ensures all routes start with /image-process
main_router = APIRouter(prefix="/image-process", tags=["Image Processing"])

# Mount sub-routers
main_router.include_router(grayscale_router)
main_router.include_router(fft_router)
main_router.include_router(freq_comp_router)

# 4. Define Public API
# This controls what is available when running: from image_process import *
__all__ = [
    "main_router",
    "ImageSaveFormat",
    "grayscale",
    "fft",
    "plot_graph",
]