/* =========================================================
 * Photo Cropper — обрезка фото для сайта
 * Работает полностью на клиенте. Зависимость: Cropper.js
 * ========================================================= */

const $ = (id) => document.getElementById(id);

const fileInput     = $('fileInput');
const image         = $('image');
const cropBtn       = $('cropBtn');
const downloadLink  = $('downloadLink');
const dropZone      = $('dropZone');
const pasteBtn      = $('pasteBtn');

const ratioInput    = $('ratioInput');
const applyRatio    = $('applyRatio');
const freeRatio     = $('freeRatio');
const presets       = document.querySelectorAll('.presets button');

const formatSelect  = $('formatSelect');
const qualityRange  = $('qualityRange');
const qualityValue  = $('qualityValue');
const qualityField  = $('qualityField');
const maxWidthInput = $('maxWidthInput');

const filenameField = $('filenameField');
const filenameInput = $('filenameInput');
const sizeHint      = $('sizeHint');

let cropper = null;
let currentBlobUrl = null;

/* ---------- Загрузка изображения ---------- */
function loadImageFromBlob(blob, suggestedName) {
  if (!blob || !blob.type.startsWith('image/')) {
    alert('Это не изображение.');
    return;
  }

  if (cropper) { cropper.destroy(); cropper = null; }
  if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }

  downloadLink.hidden = true;
  sizeHint.hidden = true;
  filenameField.hidden = true;

  const url = URL.createObjectURL(blob);
  currentBlobUrl = url;
  image.src = url;

  if (suggestedName) {
    filenameInput.value = suggestedName.replace(/\.[^.]+$/, '') || 'crop';
  } else {
    filenameInput.value = 'crop';
  }

  image.onload = () => {
    cropper = new Cropper(image, {
      viewMode: 1,
      dragMode: 'move',
      autoCropArea: 0.8,
      aspectRatio: NaN,
      background: false,
      responsive: true,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
    });
    cropBtn.disabled = false;
    applyRatioFromInput();
  };
}

/* ---------- Выбор файла ---------- */
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  loadImageFromBlob(file, file.name);
  fileInput.value = '';
});

/* ---------- Drag & Drop ---------- */
['dragenter', 'dragover'].forEach(ev =>
  document.addEventListener(ev, (e) => {
    e.preventDefault();
    document.body.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach(ev =>
  document.addEventListener(ev, (e) => {
    if (ev === 'dragleave' && e.relatedTarget) return;
    document.body.classList.remove('dragover');
  })
);
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) loadImageFromBlob(file, file.name);
});

/* ---------- Вставка из буфера ---------- */
async function pasteFromClipboard() {
  try {
    if (!navigator.clipboard?.read) {
      alert('Браузер не поддерживает чтение буфера через кнопку. Используйте Ctrl+V.');
      return;
    }
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        loadImageFromBlob(blob);
        return;
      }
    }
    alert('В буфере обмена нет изображения.');
  } catch (err) {
    alert('Не удалось прочитать буфер обмена. Разрешите доступ или используйте Ctrl+V.\n\n' + err.message);
  }
}
pasteBtn.addEventListener('click', pasteFromClipboard);

document.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const blob = item.getAsFile();
      if (blob) { loadImageFromBlob(blob); e.preventDefault(); return; }
    }
  }
});

/* ---------- Соотношение сторон ---------- */
function parseRatio(str) {
  if (!str) return NaN;
  str = str.trim().replace(',', '.');
  if (str.includes(':')) {
    const [a, b] = str.split(':').map(s => parseFloat(s));
    return (a && b) ? a / b : NaN;
  }
  if (str.includes('/')) {
    const [a, b] = str.split('/').map(s => parseFloat(s));
    return (a && b) ? a / b : NaN;
  }
  const n = parseFloat(str);
  return isNaN(n) ? NaN : n;
}

function applyRatioFromInput() {
  if (!cropper) return;
  const r = parseRatio(ratioInput.value);
  cropper.setAspectRatio(isNaN(r) ? NaN : r);
}

applyRatio.addEventListener('click', applyRatioFromInput);
ratioInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); applyRatioFromInput(); }
});
freeRatio.addEventListener('click', () => {
  ratioInput.value = '';
  if (cropper) cropper.setAspectRatio(NaN);
});
presets.forEach(btn => {
  btn.addEventListener('click', () => {
    ratioInput.value = btn.dataset.ratio;
    applyRatioFromInput();
  });
});

/* ---------- Качество и формат ---------- */
qualityRange.addEventListener('input', () => {
  qualityValue.textContent = qualityRange.value + '%';
});
formatSelect.addEventListener('change', () => {
  qualityField.classList.toggle('hidden', formatSelect.value === 'image/png');
  updateDownloadName();
});

/* ---------- Обрезка ---------- */
cropBtn.addEventListener('click', () => {
  if (!cropper) return;

  const maxW = parseInt(maxWidthInput.value, 10) || 0;
  const opts = { imageSmoothingQuality: 'high' };
  if (maxW > 0) { opts.maxWidth = maxW; opts.maxHeight = maxW; }

  const canvas = cropper.getCroppedCanvas(opts);
  const format = formatSelect.value;
  const quality = parseInt(qualityRange.value, 10) / 100;

  canvas.toBlob((blob) => {
    if (!blob) {
      alert('Не удалось сохранить изображение в выбранном формате.');
      return;
    }
    if (downloadLink.href) URL.revokeObjectURL(downloadLink.href);
    downloadLink.href = URL.createObjectURL(blob);

    updateDownloadName();
    downloadLink.hidden = false;
    filenameField.hidden = false;

    const kb = blob.size / 1024;
    const sizeText = kb > 1024
      ? (kb / 1024).toFixed(2) + ' МБ'
      : kb.toFixed(1) + ' КБ';
    sizeHint.textContent = `Готово: ${canvas.width}×${canvas.height} px, ${sizeText}`;
    sizeHint.hidden = false;
  }, format, format === 'image/png' ? undefined : quality);
});

/* ---------- Имя файла ---------- */
function getExtension() {
  const f = formatSelect.value;
  return f === 'image/png' ? 'png' : f === 'image/webp' ? 'webp' : 'jpg';
}

function updateDownloadName() {
  const raw = filenameInput.value.trim() || 'crop';
  const safe = raw.replace(/[\\/:*?"<>|]+/g, '_');
  downloadLink.download = `${safe}.${getExtension()}`;
}

filenameInput.addEventListener('input', updateDownloadName);
