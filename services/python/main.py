from fastapi import FastAPI

from image_process import main_router as router_image_process
from gaussian_splatting import main_router as router_gaussian_splatting

app = FastAPI(
    title="Python Service",
    description="",
    version="1.0.0"
)

# Register the router
app.include_router(router_image_process)
app.include_router(router_gaussian_splatting)

@app.get("/")
async def root():
    """
    Health check endpoint.
    """
    return {
        "message": "Python Service is running",
        "docs_url": "/docs"
    }
