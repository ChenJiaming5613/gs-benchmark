from typing import Union
import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import Response

app = FastAPI()

@app.post("/fft")
async def compute_fft(image: UploadFile = File(...)):
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image upload")

    file_array = np.frombuffer(data, dtype=np.uint8)
    frame = cv2.imdecode(file_array, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(status_code=400, detail="Unable to decode image")

    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    frequency = np.fft.fftshift(np.fft.fft2(gray))
    magnitude = 20 * np.log(np.abs(frequency) + 1)
    magnitude_normalized = cv2.normalize(magnitude, None, 0, 255, cv2.NORM_MINMAX)
    magnitude_uint8 = magnitude_normalized.astype(np.uint8)

    success, buffer = cv2.imencode(".png", magnitude_uint8)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode frequency spectrum")

    return Response(content=buffer.tobytes(), media_type="image/png")