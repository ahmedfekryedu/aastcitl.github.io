# Local PDF extraction runtime

Pyodide 0.29.3 runs the user's existing CITL Python extractor in a Web Worker. No remote PDF conversion endpoint is used.

Unmodified extractor modules and corrections are in extractor.zip and the source package tools/pdf-extractor. SHA-256 hashes are recorded in manifest.json. Source: the user-provided desktop program citl schedule extractor.

Build: `python tools/build-pdf-runtime.py "path/to/citl schedule extractor"`.

Dependencies: Pyodide 0.29.3, Python 3.13, pdfplumber 0.11.9, pdfminer.six 20251230, micropip and dependencies in pyodide-lock.json. Wheel distributions contain license metadata. Pyodide and Python licenses are included alongside this file.

Official projects: https://pyodide.org/ and https://github.com/jsvine/pdfplumber and https://github.com/pdfminer/pdfminer.six . This uses original text/table extraction, not OCR. Renderer/Pillow integration is not loaded by the text extraction path.
