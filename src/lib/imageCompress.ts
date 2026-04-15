import imageCompression from 'browser-image-compression';

type ImagePreset = 'post' | 'profile' | 'cover';

const PRESETS: Record<ImagePreset, { maxWidthOrHeight: number; maxSizeMB: number }> = {
  post: { maxWidthOrHeight: 1920, maxSizeMB: 0.5 },
  profile: { maxWidthOrHeight: 400, maxSizeMB: 0.1 },
  cover: { maxWidthOrHeight: 1200, maxSizeMB: 0.3 },
};

export async function compressImage(file: File, preset: ImagePreset): Promise<File> {
  const { maxWidthOrHeight, maxSizeMB } = PRESETS[preset];

  const compressed = await imageCompression(file, {
    maxWidthOrHeight,
    maxSizeMB,
    fileType: 'image/webp',
    useWebWorker: true,
    initialQuality: 0.8,
  });

  return new File([compressed], file.name.replace(/\.[^.]+$/, '.webp'), {
    type: 'image/webp',
  });
}
