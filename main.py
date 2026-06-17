"""
Markify — File to Markdown Converter
Backend: FastAPI + Microsoft MarkItDown
"""

import os
import tempfile
import traceback
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from markitdown import MarkItDown

# --- Configuration ---
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".pptx", ".ppt", ".xlsx", ".xls",
    ".html", ".htm", ".csv", ".json", ".xml",
    ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp",
    ".wav", ".mp3",
    ".zip", ".epub", ".msg", ".txt", ".md", ".rst",
    ".ipynb", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    ".py", ".js", ".ts", ".java", ".c", ".cpp", ".go", ".rs",
}

app = FastAPI(title="Markify", description="Convert files to Markdown")

# CORS — allow all origins since frontend is served from the same origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MarkItDown converter
md_converter = MarkItDown()


@app.get("/api/health")
async def health_check():
    """Health check endpoint for UptimeRobot to keep Render awake."""
    return {"status": "ok", "service": "markify"}


@app.post("/api/convert")
async def convert_file(file: UploadFile = File(...)):
    """
    Convert an uploaded file to Markdown.
    Accepts multipart form upload, returns JSON with markdown content.
    """
    # Validate file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB.",
        )

    # Validate file extension
    original_name = file.filename or "unknown"
    ext = Path(original_name).suffix.lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. See supported formats on the home page.",
        )

    # Write to temp file and convert
    tmp_path = None
    try:
        suffix = ext if ext else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        result = md_converter.convert_local(tmp_path)
        markdown_text = result.text_content or ""

        if not markdown_text.strip():
            return JSONResponse(
                content={
                    "success": True,
                    "filename": original_name,
                    "markdown": "",
                    "warning": "The file was processed but no text content was extracted. "
                    "The file may be empty or contain only images/unsupported content.",
                }
            )

        return JSONResponse(
            content={
                "success": True,
                "filename": original_name,
                "markdown": markdown_text,
            }
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Conversion failed: {str(e)}",
        )
    finally:
        # Always clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/api/convert-url")
async def convert_url(url: str = Form(...)):
    """
    Convert a file from a URL to Markdown.
    Downloads the file, converts it, and returns the markdown.
    """
    if not url or not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Please provide a valid HTTP/HTTPS URL.")

    tmp_path = None
    try:
        # Download the file
        async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()

        contents = response.content
        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB.",
            )

        # Try to determine extension from URL or content-type
        url_path = url.split("?")[0].split("#")[0]
        ext = Path(url_path).suffix.lower()
        if not ext:
            content_type = response.headers.get("content-type", "")
            ext = _content_type_to_ext(content_type)

        suffix = ext if ext else ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        result = md_converter.convert_local(tmp_path)
        markdown_text = result.text_content or ""

        # Derive a filename from the URL
        filename = Path(url_path).name or "downloaded-file"

        if not markdown_text.strip():
            return JSONResponse(
                content={
                    "success": True,
                    "filename": filename,
                    "markdown": "",
                    "warning": "The URL was fetched but no text content was extracted.",
                }
            )

        return JSONResponse(
            content={
                "success": True,
                "filename": filename,
                "markdown": markdown_text,
            }
        )

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to download file: HTTP {e.response.status_code}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to reach URL: {str(e)}",
        )
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Conversion failed: {str(e)}",
        )
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


def _content_type_to_ext(content_type: str) -> str:
    """Map common content types to file extensions."""
    ct = content_type.lower().split(";")[0].strip()
    mapping = {
        "application/pdf": ".pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
        "application/vnd.ms-excel": ".xls",
        "application/vnd.ms-powerpoint": ".ppt",
        "application/msword": ".doc",
        "text/html": ".html",
        "text/csv": ".csv",
        "application/json": ".json",
        "application/xml": ".xml",
        "text/xml": ".xml",
        "text/plain": ".txt",
        "application/zip": ".zip",
        "application/epub+zip": ".epub",
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "audio/wav": ".wav",
        "audio/mpeg": ".mp3",
    }
    return mapping.get(ct, "")


# Serve static files (frontend)
# Mount at root so ./styles.css and ./app.js resolve from index.html
# API routes registered above take priority over the static mount.
static_dir = Path(__file__).parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
