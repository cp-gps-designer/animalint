# AnimalInt MLOps Platform & Bio-Acoustic Intelligence

AnimalInt is an MLOps platform that uses bio-acoustic emissions from the animal kingdom as real-world examples of how to collect different types of intelligences (**COMINT**, **ELINT**, **ACINT**, **MASINT**).

## Features

1. **Description of AnimalInt**:
   - Comprehensive documentation of SIGINT (COMINT & ELINT), ACINT, and MASINT.
   - Comparative matrix mapping INT types, Animal Examples, Human Examples, Data Types, and ML Model Development architectures (e.g., Multimodal Gemini, Chirp + LLM Adapter, YAMNet/AST CNNs, 1D CNN, LSTM).

2. **Pipeline Architecture**:
   - Interactive 5-stage MLOps Pipeline Explorer (GCS Landing -> Feature Extraction -> Model Training -> Serving API -> Monitoring & Drift Detection).
   - Deep-dive telemetry, latency metrics, code snippets, and dataset contracts for each pipeline stage.

3. **Application (Google Cloud Storage Ingestion & Classifier)**:
   - Drag-and-drop sound file upload zone (.wav, .mp3, .flac, .ogg, .iq, .pdw).
   - Direct integration with Google Cloud Storage buckets (`gs://...`).
   - Real-time audio waveform visualizer canvas.
   - Automatic INT classification, ML model recommendations, and JSON telemetry payload inspector.

## Running the Application

### 1. Start the FastAPI Web Server
```bash
python3 main.py
```
Or using uvicorn directly:
```bash
uvicorn main:app --reload --port 8000
```

### 2. Access the Web Front-End
Open your browser to: `http://localhost:8000`

### 3. Google Cloud Storage Setup (Optional)
To stream uploads directly to a live GCP bucket:
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your-gcp-service-account-key.json"
export GCS_BUCKET_NAME="your-custom-gcs-bucket"
```
*(Note: If GCP credentials are not set, the application operates in interactive GCS simulation mode with full waveform visualization and metadata inspection).*
# animalint
