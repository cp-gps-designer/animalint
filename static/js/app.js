const SPECIES_FOLDER_MAP = {
  'North-Island-Brown-Kiwi': 'animalint-bioacoustics/raw-audio/North-Island-Brown-Kiwi',
  'canadian_goose': 'animalint-bioacoustics/raw-audio/canadian_goose',
  'mallard_duck': 'animalint-bioacoustics/raw-audio/mallard_duck'
};

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initPipelineExplorer();
  initUploadArea();
  initIdentifyArea();
});

/* Tab Switching Logic */
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panes = document.querySelectorAll('.tab-pane');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');

      buttons.forEach(b => b.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(tabTarget);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });
}

/* Pipeline Architecture Explorer */
let pipelineData = [];

async function initPipelineExplorer() {
  try {
    const res = await fetch('/api/pipeline/status');
    const data = await res.json();
    pipelineData = data.steps || [];

    const nodes = document.querySelectorAll('.pipeline-node');
    nodes.forEach(node => {
      node.addEventListener('click', () => {
        const stepId = node.getAttribute('data-step');
        selectPipelineStep(stepId, node);
      });
    });

    if (nodes.length > 0) {
      selectPipelineStep('ingestion', nodes[0]);
    }
  } catch (err) {
    console.error("Could not fetch pipeline specs:", err);
  }
}

function selectPipelineStep(stepId, targetNode) {
  document.querySelectorAll('.pipeline-node').forEach(n => n.classList.remove('selected'));
  if (targetNode) targetNode.classList.add('selected');

  const spec = pipelineData.find(s => s.id === stepId);
  if (!spec) return;

  const setElText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setElText('stepTitle', spec.name);
  setElText('stepTech', spec.tech);
  setElText('stepDesc', spec.description);
  setElText('stepInputs', spec.inputs);
  setElText('stepOutputs', spec.outputs);
  setElText('stepLatency', spec.latency);
  setElText('stepThroughput', spec.throughput);
  setElText('stepCode', spec.code_snippet);
}

function isValidAudioFile(filename) {
  if (!filename) return false;
  const name = filename.toLowerCase();
  return name.endsWith('.mp3') || name.endsWith('.wav');
}

/* Upload & Application Tab Logic */
function initUploadArea() {
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const uploadForm = document.getElementById('uploadForm');
  const speciesSelect = document.getElementById('speciesSelect');
  const gcsPathDisplay = document.getElementById('gcsDestinationPath');

  if (speciesSelect && gcsPathDisplay) {
    speciesSelect.addEventListener('change', () => {
      const selected = speciesSelect.value;
      const folder = SPECIES_FOLDER_MAP[selected] || `animalint-bioacoustics/raw-audio/${selected}`;
      gcsPathDisplay.textContent = `gs://animalint/${folder}`;
    });
  }

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    }, false);
  });

  dropzone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      if (handleFileSelected(files[0])) {
        fileInput.files = files;
      }
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (fileInput.files.length > 0) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInput.files || fileInput.files.length === 0) {
      alert("Please select or drop an audio file (.mp3 or .wav) first.");
      return;
    }
    await processUpload(fileInput.files[0]);
  });
}

function handleFileSelected(file) {
  if (!isValidAudioFile(file.name)) {
    alert("Invalid file format. Only .mp3 and .wav audio files are allowed.");
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
    const fileNameDisplay = document.getElementById('selectedFileName');
    if (fileNameDisplay) fileNameDisplay.textContent = '';
    return false;
  }

  const fileNameDisplay = document.getElementById('selectedFileName');
  if (fileNameDisplay) {
    fileNameDisplay.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  }
  
  // Render waveform preview on canvas
  renderDummyWaveform();
  
  // Try audio preview if audio element exists
  const audioPreview = document.getElementById('audioPreview');
  if (audioPreview) {
    audioPreview.src = URL.createObjectURL(file);
    audioPreview.style.display = 'block';
  }
  return true;
}

async function processUpload(file) {
  if (!isValidAudioFile(file.name)) {
    alert("Invalid file format. Only .mp3 and .wav audio files are allowed.");
    return;
  }

  const progressBar = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const speciesSelect = document.getElementById('speciesSelect');
  const selectedSpecies = speciesSelect ? speciesSelect.value : 'North-Island-Brown-Kiwi';
  const bucketName = 'animalint';
  const folderName = SPECIES_FOLDER_MAP[selectedSpecies] || `animalint-bioacoustics/raw-audio/${selectedSpecies}`;
  const intTypeSelect = document.getElementById('intTypeSelect');
  const intType = intTypeSelect ? intTypeSelect.value : 'COMINT';

  if (progressBar && progressFill) {
    progressBar.style.display = 'block';
    progressFill.style.width = '30%';
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('species', selectedSpecies);
  formData.append('bucket', bucketName);
  formData.append('folder', folderName);
  formData.append('int_type', intType);

  try {
    if (progressFill) progressFill.style.width = '70%';
    const res = await fetch('/api/gcs/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Upload failed");
    }

    const data = await res.json();
    if (progressFill) progressFill.style.width = '100%';

    setTimeout(() => {
      if (progressBar && progressFill) {
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';
      }
    }, 400);

    renderResults(data);
  } catch (err) {
    console.error("Upload failed:", err);
    alert(`Upload failed: ${err.message || err}`);
    if (progressBar) progressBar.style.display = 'none';
  }
}

/* Section 2: Identify Bird Type Logic */
function initIdentifyArea() {
  const dropzoneIdentify = document.getElementById('dropzoneIdentify');
  const fileInputIdentify = document.getElementById('fileInputIdentify');
  const identifyForm = document.getElementById('identifyForm');

  if (!dropzoneIdentify || !fileInputIdentify || !identifyForm) return;

  dropzoneIdentify.addEventListener('click', () => fileInputIdentify.click());

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzoneIdentify.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzoneIdentify.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzoneIdentify.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzoneIdentify.classList.remove('dragover');
    }, false);
  });

  dropzoneIdentify.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      if (handleIdentifyFileSelected(files[0])) {
        fileInputIdentify.files = files;
      }
    }
  });

  fileInputIdentify.addEventListener('change', (e) => {
    if (fileInputIdentify.files.length > 0) {
      handleIdentifyFileSelected(fileInputIdentify.files[0]);
    }
  });

  identifyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInputIdentify.files || fileInputIdentify.files.length === 0) {
      alert("Please select or drop an audio file (.mp3 or .wav) to identify.");
      return;
    }
    await processIdentify(fileInputIdentify.files[0]);
  });
}

function handleIdentifyFileSelected(file) {
  if (!isValidAudioFile(file.name)) {
    alert("Invalid file format. Only .mp3 and .wav audio files are allowed.");
    const fileInputIdentify = document.getElementById('fileInputIdentify');
    if (fileInputIdentify) fileInputIdentify.value = '';
    const fileNameDisplay = document.getElementById('selectedFileNameIdentify');
    if (fileNameDisplay) fileNameDisplay.textContent = '';
    return false;
  }

  const fileNameDisplay = document.getElementById('selectedFileNameIdentify');
  if (fileNameDisplay) {
    fileNameDisplay.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  }
  
  renderDummyWaveform();
  
  const audioPreview = document.getElementById('audioPreview');
  if (audioPreview) {
    audioPreview.src = URL.createObjectURL(file);
    audioPreview.style.display = 'block';
  }
  return true;
}

async function processIdentify(file) {
  if (!isValidAudioFile(file.name)) {
    alert("Invalid file format. Only .mp3 and .wav audio files are allowed.");
    return;
  }

  const progressBar = document.getElementById('identifyProgress');
  const progressFill = document.getElementById('identifyProgressFill');

  if (progressBar && progressFill) {
    progressBar.style.display = 'block';
    progressFill.style.width = '30%';
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    if (progressFill) progressFill.style.width = '70%';
    const res = await fetch('/api/pipeline/identify', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Identification failed");
    }

    const data = await res.json();
    if (progressFill) progressFill.style.width = '100%';

    setTimeout(() => {
      if (progressBar && progressFill) {
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';
      }
    }, 400);

    renderResults(data);
  } catch (err) {
    console.error("Identification failed:", err);
    alert(`Identification failed: ${err.message || err}`);
    if (progressBar) progressBar.style.display = 'none';
  }
}

function renderResults(data) {
  const uploadInfo = data.upload_info || {};
  const analysis = data.analysis || {};

  if (data.action === "bird_identification") {
    const resBox = document.getElementById('identifyResult');
    if (resBox) {
      resBox.style.display = 'block';
      resBox.innerHTML = `
        <div style="font-weight: 700; color: var(--accent-emerald); font-size: 1.05rem; margin-bottom: 0.4rem;">
          🦅 Classification Result: ${analysis.predicted_species || 'Identified'}
        </div>
        <div style="font-size: 0.88rem; color: var(--text-main); margin-bottom: 0.25rem;">
          <strong>Scientific Name:</strong> <em>${analysis.scientific_name || 'N/A'}</em>
        </div>
        <div style="font-size: 0.88rem; color: var(--text-main); margin-bottom: 0.25rem;">
          <strong>Model Confidence:</strong> <span style="color: var(--accent-cyan); font-weight: 700;">${analysis.confidence_score || 'N/A'}</span>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          <strong>Pipeline:</strong> ${analysis.pipeline_stage || 'Audio Spectrogram Classifier'}
        </div>
      `;
      resBox.scrollIntoView({ behavior: 'smooth' });
    }
  } else {
    const resBox = document.getElementById('uploadResult');
    if (resBox) {
      resBox.style.display = 'block';
      resBox.innerHTML = `
        <div style="font-weight: 700; color: var(--accent-cyan); font-size: 1.05rem; margin-bottom: 0.4rem;">
          ✅ Upload Succeeded
        </div>
        <div style="font-size: 0.88rem; color: var(--text-main); margin-bottom: 0.25rem; word-break: break-all;">
          <strong>GCS Path:</strong> <code style="color: var(--accent-teal);">${uploadInfo.gcs_uri || 'gs://animalint/...'}</code>
        </div>
        <div style="font-size: 0.85rem; color: var(--text-muted);">
          ${uploadInfo.notice || 'Successfully ingested into training dataset bucket.'}
        </div>
      `;
      resBox.scrollIntoView({ behavior: 'smooth' });
    }
  }
}

function renderDummyWaveform() {
  const canvas = document.getElementById('waveformCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.parentElement.clientWidth;
  const height = canvas.height = 120;

  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();

  const points = 80;
  const sliceWidth = width / points;
  let x = 0;

  for (let i = 0; i < points; i++) {
    const v = Math.sin(i * 0.2) * Math.cos(i * 0.1) * (height / 2.5);
    const y = height / 2 + v;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();
}

function drawWaveformPoints(samplePoints) {
  const canvas = document.getElementById('waveformCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.parentElement.clientWidth;
  const height = canvas.height = 120;

  ctx.clearRect(0, 0, width, height);

  // Draw background grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 0; y < height; y += 20) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();

  // Draw audio waveform signal
  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, '#38bdf8');
  gradient.addColorStop(0.5, '#14b8a6');
  gradient.addColorStop(1, '#a855f7');

  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2.5;
  ctx.beginPath();

  const sliceWidth = width / samplePoints.length;
  let x = 0;

  for (let i = 0; i < samplePoints.length; i++) {
    const val = samplePoints[i];
    const y = (height / 2) + (val * (height / 2.2) * (i % 2 === 0 ? 1 : -1));
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();
}
