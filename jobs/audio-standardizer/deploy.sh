#!/usr/bin/env bash
set -e

# Configuration Variables
PROJECT_ID=$(gcloud config get-value project)
REGION="us-central1"
JOB_NAME="animalint-audio-standardizer"
BUCKET_NAME="animalint-bioacoustics"
IMAGE_URI="gcr.io/${PROJECT_ID}/${JOB_NAME}:latest"

echo "============================================================"
echo " Deploying Cloud Run Job: ${JOB_NAME}"
echo " GCP Project: ${PROJECT_ID}"
echo " GCS Bucket:  gs://${BUCKET_NAME}"
echo "============================================================"

# 1. Enable Required GCP APIs
echo "1. Enabling required Google Cloud APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    eventarc.googleapis.com \
    pubsub.googleapis.com \
    storage.googleapis.com

# 2. Build Container Image via Cloud Build
echo "2. Building container image via Google Cloud Build..."
gcloud builds submit --tag "${IMAGE_URI}" .

# 3. Create or Update Cloud Run Job
echo "3. Creating Cloud Run Job..."
gcloud run jobs create "${JOB_NAME}" \
    --image="${IMAGE_URI}" \
    --region="${REGION}" \
    --set-env-vars="GCS_BUCKET=gs://${BUCKET_NAME}" \
    --cpu=2 \
    --memory=4Gi \
    --max-retries=3 \
    --task-timeout=10m \
    || gcloud run jobs update "${JOB_NAME}" \
        --image="${IMAGE_URI}" \
        --region="${REGION}" \
        --set-env-vars="GCS_BUCKET=gs://${BUCKET_NAME}" \
        --cpu=2 \
        --memory=4Gi

# 4. Create Eventarc Trigger for GCS Object Creation
echo "4. Creating Eventarc trigger on GCS bucket object creation..."
TRIGGER_NAME="${JOB_NAME}-trigger"

# Grant Pub/Sub Publisher role to GCS Service Account for Eventarc
GCS_SERVICE_ACCOUNT=$(gcloud storage service-agent --project="${PROJECT_ID}")
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${GCS_SERVICE_ACCOUNT}" \
    --role="roles/pubsub.publisher" || true

gcloud eventarc triggers create "${TRIGGER_NAME}" \
    --location="${REGION}" \
    --destination-run-job="${JOB_NAME}" \
    --event-filters="type=google.cloud.storage.object.v1.finalized" \
    --event-filters="bucket=${BUCKET_NAME}" \
    --service-account="${PROJECT_ID}-compute@developer.gserviceaccount.com" || true

echo "============================================================"
echo " ✅ Deployment completed successfully!"
echo " Cloud Run Job Name: ${JOB_NAME}"
echo " Eventarc Trigger:   ${TRIGGER_NAME}"
echo " Automated Action: Standardizes MP3/WAV files uploaded to gs://${BUCKET_NAME}/raw-audio/"
echo "============================================================"
