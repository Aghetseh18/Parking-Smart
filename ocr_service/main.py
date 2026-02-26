"""
============================================================
 OCR Microservice  —  Parking Smart System
============================================================
 Same logic as the standalone script:
   img → greyscale → easyocr.readtext(gray)

 Endpoint:
   POST /ocr
   Body: multipart/form-data  field = "image"
   Returns: { "plate": "LT1234AB", "confidence": 0.94 }
            { "plate": null,       "confidence": 0 }

 Run:
   python main.py
============================================================
"""

import cv2
import easyocr
import numpy as np
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
import uvicorn

# ── Load EasyOCR ONCE at startup (heavy — takes a few seconds) ───
print("🔄 Loading EasyOCR model...")
reader = easyocr.Reader(['en'], gpu=False, verbose=False)
print("✅ EasyOCR ready.")

app = FastAPI(title="Parking Smart OCR Service")



# ─────────────────────────────────────────────────────────────────
#  POST /ocr
# ─────────────────────────────────────────────────────────────────
@app.post("/ocr")
async def ocr_plate(image: UploadFile = File(...)):
    # 1. Read bytes → OpenCV image  (same as cv2.imread in the script)
    try:
        contents = await image.read()
        np_arr   = np.frombuffer(contents, np.uint8)
        img      = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot decode image: {e}")

    if img is None:
        raise HTTPException(status_code=400, detail="Empty or unreadable image")

    print(f"\n🔍 Image received: {img.shape[1]}×{img.shape[0]}px — '{image.filename}'")

    # 2. Greyscale  (exactly as in the standalone script)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 3. EasyOCR readtext  (exactly as in the standalone script)
    results = reader.readtext(gray)

    # 4. Show Results  (same as the standalone for-loop)
    best_plate = None
    best_conf  = 0.0

    for (_, text, prob) in results:
        cleaned = text.upper().replace(' ', '')
        cleaned = ''.join(c for c in cleaned if c.isalnum())
        print(f"📝 Detected: '{text}'  →  '{cleaned}'  (conf: {prob:.2f})")

        # Keep highest-confidence non-empty result — no minimum threshold
        if cleaned and prob > best_conf:
            best_plate = cleaned
            best_conf  = prob

    if best_plate:
        print(f"✅ Best result: '{best_plate}'  conf: {best_conf:.2f}")
    else:
        print("❌ No text detected in image")

    return JSONResponse({
        "plate":      best_plate,
        "confidence": round(float(best_conf), 3)
    })


# ── Health check ──────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok", "service": "parking-smart-ocr"}


# ── Entry point ───────────────────────────────────────────────────
if __name__ == "__main__":
    print("🚀 Starting OCR service on http://localhost:5050")
    uvicorn.run("main:app", host="0.0.0.0", port=5050, reload=False)
