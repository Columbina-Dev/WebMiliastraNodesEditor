const MAX_NICKNAME_LENGTH = 12;
const MAX_AVATAR_BYTES = 1_000_000;
const MAX_AVATAR_DIMENSION = 256;

const readBlobAsDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image.'));
    reader.readAsDataURL(blob);
  });

const loadImageFromFile = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image.'));
    };
    image.src = url;
  });

const exportCanvasToBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image.'));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
  });

export const sanitizeNickname = (value: string) =>
  value.replace(/\s+/g, '').slice(0, MAX_NICKNAME_LENGTH);

export const getNicknameInitial = (value: string) => {
  const cleaned = sanitizeNickname(value).trim();
  if (!cleaned) return '?';
  return cleaned[0].toUpperCase();
};

export const getAvatarDataUrl = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/')) {
    throw new Error('Unsupported image type.');
  }

  if (file.size <= MAX_AVATAR_BYTES) {
    return readBlobAsDataUrl(file);
  }

  const image = await loadImageFromFile(file);
  let scale = Math.min(MAX_AVATAR_DIMENSION / image.width, MAX_AVATAR_DIMENSION / image.height, 1);
  let outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to resize image.');
    }
    context.drawImage(image, 0, 0, width, height);

    const quality = outputType === 'image/jpeg' ? Math.max(0.5, 0.92 - attempt * 0.06) : undefined;
    const blob = await exportCanvasToBlob(canvas, outputType, quality);
    if (blob.size <= MAX_AVATAR_BYTES) {
      return readBlobAsDataUrl(blob);
    }
    if (outputType === 'image/png') {
      outputType = 'image/jpeg';
    } else {
      scale *= 0.85;
    }
  }

  const fallbackCanvas = document.createElement('canvas');
  const fallbackScale = Math.min(MAX_AVATAR_DIMENSION / image.width, MAX_AVATAR_DIMENSION / image.height, 1);
  fallbackCanvas.width = Math.max(1, Math.round(image.width * fallbackScale));
  fallbackCanvas.height = Math.max(1, Math.round(image.height * fallbackScale));
  const fallbackContext = fallbackCanvas.getContext('2d');
  if (!fallbackContext) {
    throw new Error('Unable to resize image.');
  }
  fallbackContext.drawImage(image, 0, 0, fallbackCanvas.width, fallbackCanvas.height);
  const fallbackBlob = await exportCanvasToBlob(fallbackCanvas, outputType, 0.7);
  return readBlobAsDataUrl(fallbackBlob);
};

