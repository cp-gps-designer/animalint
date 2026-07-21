import os
import uvicorn
from typing import Optional
from fastapi import FastAPI, Request, File, UploadFile, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from services.gcs_service import GCSService
from services.pipeline_service import PipelineService

app = FastAPI(
    title="AnimalInt MLOps Platform",
    description="Bio-Acoustic Signal Processing & MLOps Pipeline Web Application",
    version="1.0.0"
)

# Mounting static files & templates
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

gcs_service = GCSService()

SPECIES_FOLDER_MAP = {
    "North-Island-Brown-Kiwi": "animalint-bioacoustics/raw-audio/North-Island-Brown-Kiwi",
    "canadian_goose": "animalint-bioacoustics/raw-audio/canadian_goose",
    "mallard_duck": "animalint-bioacoustics/raw-audio/mallard_duck"
}

@app.get("/")
async def get_index(request: Request):
    """
    Renders the AnimalInt Web Application main page with 3 tabs:
    1. Description of AnimalInt
    2. Pipeline Architecture
    3. COMINT (Classification) Application
    """
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/gcs/upload")
async def upload_sound_emission(
    file: UploadFile = File(...),
    species: str = Form("North-Island-Brown-Kiwi"),
    bucket: str = Form("animalint"),
    folder: Optional[str] = Form(None),
    int_type: str = Form("COMINT")
):
    """
    Ingests bio-acoustic recording files (.mp3, .wav), uploads them to GCS bucket folders:
    - gs://animalint/animalint-bioacoustics/raw-audio/North-Island-Brown-Kiwi
    - gs://animalint/animalint-bioacoustics/raw-audio/canadian_goose
    - gs://animalint/animalint-bioacoustics/raw-audio/mallard_duck
    """
    filename = file.filename or "recording.wav"
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    if ext not in ["mp3", "wav"]:
        raise HTTPException(
            status_code=400,
            detail="Only .mp3 or .wav files are allowed."
        )

    destination_folder = folder or SPECIES_FOLDER_MAP.get(species, f"animalint-bioacoustics/raw-audio/{species}")
    target_bucket = bucket or "animalint"

    contents = await file.read()
    content_type = file.content_type
    if not content_type or content_type == "application/octet-stream":
        content_type = "audio/mpeg" if ext == "mp3" else "audio/wav"
    
    # Upload to GCS
    upload_res = gcs_service.upload_file(
        file_bytes=contents,
        filename=filename,
        content_type=content_type,
        destination_folder=destination_folder,
        custom_bucket=target_bucket
    )
    
    # Run bio-acoustic pipeline analysis
    analysis_res = PipelineService.analyze_audio_emission(
        filename=filename,
        file_bytes=contents,
        user_int_type=int_type
    )

    return {
        "status": "success",
        "upload_info": upload_res,
        "analysis": analysis_res
    }

@app.post("/api/pipeline/identify")
async def identify_bird_species(file: UploadFile = File(...)):
    """
    Ingests unknown bio-acoustic recording (.mp3, .wav) and classifies the bird species.
    """
    filename = file.filename or "recording.wav"
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    if ext not in ["mp3", "wav"]:
        raise HTTPException(
            status_code=400,
            detail="Only .mp3 or .wav files are allowed."
        )

    contents = await file.read()
    analysis_res = PipelineService.identify_bird_species(
        filename=filename,
        file_bytes=contents
    )

    return {
        "status": "success",
        "action": "bird_identification",
        "analysis": analysis_res
    }

@app.get("/api/pipeline/status")
async def get_pipeline_status():
    """
    Returns step-by-step MLOps pipeline architecture specifications & metrics.
    """
    return {
        "pipeline_name": "AnimalInt Bio-Acoustic Processing Pipeline",
        "status": "Operational",
        "steps": PipelineService.get_pipeline_specs()
    }

@app.get("/api/gcs/health")
async def check_gcs_health(bucket: str = "animalint"):
    """
    Checks GCS bucket status and connectivity.
    """
    return gcs_service.check_bucket_status(bucket)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
