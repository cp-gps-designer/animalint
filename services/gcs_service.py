import os
import time
import logging
from typing import Dict, Any, Optional

try:
    from google.cloud import storage
    GCS_AVAILABLE = True
except ImportError:
    GCS_AVAILABLE = False

logger = logging.getLogger("animalint.gcs")

class GCSService:
    def __init__(self, bucket_name: str = "animalint"):
        self.bucket_name = os.environ.get("GCS_BUCKET_NAME", bucket_name)
        self.credentials_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")
        self.client = None
        self._init_client()

    def _init_client(self):
        if GCS_AVAILABLE:
            try:
                self.client = storage.Client()
                logger.info("Google Cloud Storage client initialized successfully.")
            except Exception as e:
                logger.warning(f"Could not initialize GCS client: {e}. Running in simulation mode.")
                self.client = None
        else:
            logger.info("google-cloud-storage library not available. Running in simulation mode.")

    def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str,
        destination_folder: str = "raw_emissions",
        custom_bucket: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Uploads a file to GCS or simulates an upload if GCS credentials are missing.
        """
        target_bucket = custom_bucket or self.bucket_name
        timestamp = int(time.time())
        blob_name = f"{destination_folder}/{timestamp}_{filename}"
        gcs_uri = f"gs://{target_bucket}/{blob_name}"
        public_url = f"https://storage.googleapis.com/{target_bucket}/{blob_name}"

        is_real_upload = False
        error_message = None

        if self.client:
            try:
                bucket = self.client.bucket(target_bucket)
                blob = bucket.blob(blob_name)
                blob.upload_from_string(file_bytes, content_type=content_type)
                is_real_upload = True
            except Exception as e:
                error_message = f"GCS Upload failed ({str(e)}). Fallback to simulated upload mode."
                logger.warning(error_message)

        return {
            "success": True,
            "is_simulated": not is_real_upload,
            "filename": filename,
            "size_bytes": len(file_bytes),
            "content_type": content_type,
            "bucket": target_bucket,
            "blob_path": blob_name,
            "gcs_uri": gcs_uri,
            "public_url": public_url,
            "timestamp": timestamp,
            "notice": error_message if error_message else ("Real GCS upload succeeded" if is_real_upload else "Simulated GCS upload (Set GOOGLE_APPLICATION_CREDENTIALS for live GCS integration)")
        }

    def check_bucket_status(self, bucket_name: Optional[str] = None) -> Dict[str, Any]:
        target = bucket_name or self.bucket_name
        if self.client:
            try:
                bucket = self.client.get_bucket(target)
                return {
                    "connected": True,
                    "bucket_name": target,
                    "location": bucket.location,
                    "storage_class": bucket.storage_class,
                    "is_simulated": False
                }
            except Exception as e:
                return {
                    "connected": False,
                    "bucket_name": target,
                    "error": str(e),
                    "is_simulated": True,
                    "message": "Bucket connection failed or permission denied. Front-end will run in interactive mock GCS mode."
                }
        return {
            "connected": False,
            "bucket_name": target,
            "is_simulated": True,
            "message": "GCS client not authenticated. Set GOOGLE_APPLICATION_CREDENTIALS for GCP connectivity."
        }
