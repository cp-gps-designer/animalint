import os
import sys
import tempfile
import numpy as np
import librosa
import soundfile as sf
import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.svm import SVC
from sklearn.metrics import classification_report, accuracy_score
import tensorflow_hub as hub

TARGET_SAMPLE_RATE = 16000 # Hard requirement for YAMNet
GCS_BUCKET = os.environ.get("GCS_BUCKET", "gs://animalint-bioacoustics")

# Define raw audio sources and where to write extracted features
RAW_MP3_DIR = f"{GCS_BUCKET}/raw-audio"
CLEAN_WAV_DIR = f"{GCS_BUCKET}/clean-wav"
EMBEDDINGS_PATH = f"{GCS_BUCKET}/embeddings"

# Target classes (subfolders inside your raw-audio directory)
CLASSES = ["North-Island-Brown-Kiwi", "canadian_goose", "mallard_duck"]

# Load YAMNet model from GCS path if available
YAMNET_GCS_URL = f"{GCS_BUCKET}/models/yamnet"
yamnet_model = None
try:
    print("Loading YAMNet model from GCS...")
    yamnet_model = tf.saved_model.load(YAMNET_GCS_URL)
    print("YAMNet model loaded successfully.")
except Exception as e:
    print(f"⚠️ Notice: Could not load YAMNet model from {YAMNET_GCS_URL}: {e}")

def standardize_audio_gcs(gcs_source_path, gcs_destination_path, target_sr=16000):
    """
    Checks if a file is WAV or MP3.
    - If WAV: Directly copies it to GCS (extremely fast).
    - If MP3: Downloads, decodes/resamples to WAV, and uploads back to GCS.
    """
    ext = os.path.splitext(gcs_source_path)[1].lower()
    
    # ----------------------------------------------------
    # Case A: File is already WAV -> Direct Move/Copy
    # ----------------------------------------------------
    if ext == '.wav':
        try:
            print(f"  ⚡ Directly copying WAV: {os.path.basename(gcs_source_path)}")
            tf.io.gfile.copy(gcs_source_path, gcs_destination_path, overwrite=True)
            return True
        except Exception as e:
            print(f"❌ Failed to copy WAV {gcs_source_path}: {e}")
            return False

    # ----------------------------------------------------
    # Case B: File is MP3 -> Convert & Resample
    # ----------------------------------------------------
    elif ext == '.mp3':
        temp_mp3 = None
        temp_wav = None
        try:
            print(f"  🛠️ Decoding/Converting MP3: {os.path.basename(gcs_source_path)}")
            # Create local temp files
            fd_in, temp_mp3 = tempfile.mkstemp(suffix=".mp3")
            os.close(fd_in)
            
            # Copy GCS MP3 to local disk
            tf.io.gfile.copy(gcs_source_path, temp_mp3, overwrite=True)

            # Load and resample using librosa
            wav_data, sr = librosa.load(temp_mp3, sr=target_sr, mono=True)

            # Write standard WAV locally
            fd_out, temp_wav = tempfile.mkstemp(suffix=".wav")
            os.close(fd_out)
            sf.write(temp_wav, wav_data, target_sr, format='WAV', subtype='PCM_16')

            # Upload back to GCS
            tf.io.gfile.copy(temp_wav, gcs_destination_path, overwrite=True)
            return True

        except Exception as e:
            print(f"❌ Failed to convert MP3 {gcs_source_path}: {e}")
            return False

        finally:
            # Clean up local disk
            for temp_file in [temp_mp3, temp_wav]:
                if temp_file and os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                    except Exception:
                        pass
    else:
        print(f"⚠️ Skipping unsupported format ({ext}): {gcs_source_path}")
        return False

def run_batch_standardization():
    """
    Scans raw-audio directories for all classes and standardizes all audio files.
    """
    raw_dir = f"{GCS_BUCKET}/raw-audio"
    clean_dir = f"{GCS_BUCKET}/clean-wav"
    
    print("🚀 Starting batch audio standardization pipeline...")
    for class_label in CLASSES:
        # Ensure GCS output folder exists
        tf.io.gfile.makedirs(f"{clean_dir}/{class_label}")
        
        # Scan directory and list ALL contents
        all_gcs_paths = tf.io.gfile.glob(f"{raw_dir}/{class_label}/*")
        
        # Case-insensitive filtering for both wav and mp3 formats
        valid_audio_files = [
            path for path in all_gcs_paths 
            if os.path.splitext(path)[1].lower() in ['.mp3', '.wav']
        ]
        
        print(f"\nProcessing folder: {class_label} ({len(valid_audio_files)} files found)")
        
        for source_path in valid_audio_files:
            original_filename = os.path.basename(source_path)
            ext = os.path.splitext(source_path)[1].lower()
            
            # Determine the standardized destination filename (always ends in .wav)
            if ext == '.mp3':
                clean_filename = original_filename.replace(ext, ".wav")
            else:
                clean_filename = original_filename
                
            destination_path = f"{clean_dir}/{class_label}/{clean_filename}"
            
            # Run standardizer
            standardize_audio_gcs(source_path, destination_path, target_sr=TARGET_SAMPLE_RATE)

    print("\n✅ All audio files successfully standardized and consolidated!")

if __name__ == "__main__":
    # Check if triggered for a specific file via environment variable (Eventarc / PubSub)
    single_file = os.environ.get("SINGLE_FILE_PATH") or os.environ.get("GCS_FILE_PATH")
    if single_file:
        print(f"🎯 Triggered for single file: {single_file}")
        ext = os.path.splitext(single_file)[1].lower()
        if ext in ['.mp3', '.wav']:
            # Extract relative path after raw-audio/
            raw_prefix = f"{GCS_BUCKET}/raw-audio/"
            clean_prefix = f"{GCS_BUCKET}/clean-wav/"
            if single_file.startswith(raw_prefix):
                rel_path = single_file[len(raw_prefix):]
                if ext == '.mp3':
                    rel_path = rel_path[:-4] + '.wav'
                dest_path = f"{clean_prefix}{rel_path}"
                standardize_audio_gcs(single_file, dest_path, target_sr=TARGET_SAMPLE_RATE)
            else:
                print("Single file outside raw-audio prefix, running full batch scan.")
                run_batch_standardization()
        else:
            print(f"Skipping unsupported file extension: {ext}")
    else:
        run_batch_standardization()
