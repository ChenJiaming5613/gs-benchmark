from fastapi import FastAPI

# Import the aggregated router from our new package
# This router already includes routes for grayscale, fft, and frequency comparison
from image_process import main_router as image_router

app = FastAPI(
    title="Image Processing Service",
    description="A modular FastAPI service for image analysis and processing.",
    version="1.0.0"
)

# Register the router
# All endpoints defined in image_process will be available under /image-process prefix
app.include_router(image_router)

@app.get("/")
async def root():
    """
    Health check endpoint.
    """
    return {
        "message": "Image Processing Service is running",
        "docs_url": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    # Run the server using uvicorn when executing this script directly
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)