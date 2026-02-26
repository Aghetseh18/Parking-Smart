const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Python OCR microservice URL
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://localhost:5050/ocr';

/* ─────────────────────────────────────────────────────────────────
   recognizePlate(imagePath)
   Sends the image to the Python EasyOCR microservice and returns
   the detected plate string (uppercased, alphanumeric only),
   or null if nothing was read / service unreachable.
───────────────────────────────────────────────────────────────── */
const recognizePlate = async (imagePath) => {
    try {
        console.log(`[OCR] Sending to EasyOCR service: ${path.basename(imagePath)}`);

        const form = new FormData();
        form.append('image', fs.createReadStream(imagePath), {
            filename: path.basename(imagePath),
            contentType: 'image/jpeg'
        });

        const response = await fetch(OCR_SERVICE_URL, {
            method: 'POST',
            body: form,
            headers: form.getHeaders(),
            timeout: 30000   // 30 s — EasyOCR can be slow on first run
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[OCR] Service HTTP ${response.status}: ${errText}`);
            return null;
        }

        const json = await response.json();

        console.log(`[OCR] Plate      : "${json.plate}"`);
        console.log(`[OCR] Confidence : ${(json.confidence * 100).toFixed(1)}%`);

        return json.plate || null;

    } catch (err) {
        console.error(`[OCR] Service unreachable: ${err.message}`);
        console.error(`[OCR] Make sure the Python service is running:`);
        console.error(`[OCR]   cd ocr_service && python main.py`);
        return null;
    }
};

module.exports = { recognizePlate };
