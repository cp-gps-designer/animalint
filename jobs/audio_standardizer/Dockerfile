FROM python:3.11-slim

# Install system audio dependencies (libsndfile & ffmpeg for librosa MP3/WAV decoding)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

ENV GCS_BUCKET="gs://animalint-bioacoustics"

CMD ["python", "main.py"]
