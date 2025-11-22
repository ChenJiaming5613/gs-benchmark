from fastapi import APIRouter

from .convert_gs_to_pc import router as router_convert_gs_to_pc

main_router = APIRouter(prefix="/gaussian-splatting", tags=["Gaussian Splatting"])

main_router.include_router(router_convert_gs_to_pc)