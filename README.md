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
   - Drag-and-drop sound file upload zone (.wav, .mp3).
   - Direct integration with Google Cloud Storage buckets (`gs://...`).
