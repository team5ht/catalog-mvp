import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  COVER_ASSET_PREFIX,
  COVER_RATIO,
  COVER_WIDTHS,
  GENERATED_ROOT,
  HERO_ASSET,
  HERO_RATIO,
  HERO_WIDTHS,
  JPEG_QUALITY,
  SOURCE_ROOT,
  WEBP_QUALITY
} from './config.mjs';

const DATA_JSON_PATH = 'data.json';
const JPG_EXT = '.jpg';
const WEBP_EXT = '.webp';

function getTargetHeight(width, ratio) {
  return Math.round((width * ratio.height) / ratio.width);
}

function getSourcePath(asset) {
  return path.join(SOURCE_ROOT, `${asset}${JPG_EXT}`);
}

function getGeneratedPath(asset, width, extension) {
  return path.join(GENERATED_ROOT, `${asset}-${width}${extension}`);
}

function isCoverAsset(asset) {
  return asset.startsWith(COVER_ASSET_PREFIX);
}

function getAssetSpec(asset) {
  if (asset === HERO_ASSET) {
    return { kind: 'hero', widths: HERO_WIDTHS, ratio: HERO_RATIO };
  }

  if (isCoverAsset(asset)) {
    return { kind: 'cover', widths: COVER_WIDTHS, ratio: COVER_RATIO };
  }

  throw new Error(`Неизвестный тип asset: ${asset}`);
}

async function readDataJson() {
  const raw = await fs.readFile(DATA_JSON_PATH, 'utf8');
  return JSON.parse(raw);
}

function collectAssets(data) {
  const materialAssets = (data.materials || []).map((material) => material?.cover?.asset);
  const allAssets = [...materialAssets, HERO_ASSET]
    .filter((asset) => typeof asset === 'string' && asset.trim().length > 0);
  return [...new Set(allAssets)];
}

async function ensureSourceExists(asset) {
  const sourcePath = getSourcePath(asset);
  try {
    await fs.access(sourcePath);
  } catch (_error) {
    throw new Error(`Отсутствует source изображение: ${sourcePath}`);
  }
  return sourcePath;
}

async function buildVariant(sourcePath, outputPath, width, height, format) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const transformer = sharp(sourcePath)
    .resize(width, height, {
      fit: 'cover',
      position: 'center'
    });

  if (format === 'webp') {
    await transformer.webp({ quality: WEBP_QUALITY }).toFile(outputPath);
    return;
  }

  await transformer.jpeg({
    quality: JPEG_QUALITY,
    mozjpeg: true,
    progressive: true
  }).toFile(outputPath);
}

async function buildAsset(asset) {
  const sourcePath = await ensureSourceExists(asset);
  const spec = getAssetSpec(asset);
  const generated = [];

  for (const width of spec.widths) {
    const height = getTargetHeight(width, spec.ratio);
    const webpPath = getGeneratedPath(asset, width, WEBP_EXT);
    const jpgPath = getGeneratedPath(asset, width, JPG_EXT);

    await buildVariant(sourcePath, webpPath, width, height, 'webp');
    await buildVariant(sourcePath, jpgPath, width, height, 'jpg');

    generated.push(webpPath, jpgPath);
  }

  return {
    asset,
    kind: spec.kind,
    files: generated
  };
}

async function main() {
  const data = await readDataJson();
  const assets = collectAssets(data);
  if (assets.length === 0) {
    throw new Error('В data.json не найдено ассетов для генерации изображений.');
  }

  const results = [];
  for (const asset of assets) {
    const result = await buildAsset(asset);
    results.push(result);
  }

  const fileCount = results.reduce((sum, item) => sum + item.files.length, 0);
  console.log(`Сгенерировано ${fileCount} файлов для ${results.length} ассетов.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
