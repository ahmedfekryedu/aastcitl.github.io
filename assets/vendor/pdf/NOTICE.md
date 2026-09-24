# Local PDF extraction runtime

Pyodide 0.29.3 runs the user's existing CITL Python extractor in a Web Worker. No remote PDF conversion endpoint is used.

Extractor modules and corrections are in extractor.zip and the source package tools/pdf-extractor. SHA-256 hashes are recorded in manifest.json. As of R6.6.1, the study ROOM_RE exactly matches the user-provided CITL_Schedule_Extractor_v2_RoomFix.exe. Compiled code/constants for common, term_extractor, and exam_extractor were compared to that executable. All other extraction logic is unchanged.

Build from the checked-in, updated source: `python tools/build-pdf-runtime.py tools/pdf-extractor`.

Dependencies: Pyodide 0.29.3, Python 3.13, pdfplumber 0.11.9, pdfminer.six 20251230, micropip and dependencies in pyodide-lock.json. Wheel distributions contain license metadata. Pyodide and Python licenses are included alongside this file.

Official projects: https://pyodide.org/ and https://github.com/jsvine/pdfplumber and https://github.com/pdfminer/pdfminer.six . This uses original text/table extraction, not OCR. Renderer/Pillow integration is not loaded by the text extraction path.
