from fastapi import APIRouter

from .to_grayscale import router as router_to_grayscale
from .calc_fft import router as router_calc_fft
from .calc_radial_freq_comp import router as router_calc_radial_freq_comp

main_router = APIRouter(prefix="/image-process", tags=["Image Processing"])

main_router.include_router(router_to_grayscale)
main_router.include_router(router_calc_fft)
main_router.include_router(router_calc_radial_freq_comp)
