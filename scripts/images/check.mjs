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
  JPEG_MAX_SIZE_RATIO,
  SOURCE_ROOT,
  WEBP_BUDGETS_KB
} from './config.mjs';

const DATA_JSON_PATH = 'data.json';
const JPG_EXT = '.jpg';
const WEBP_EXT = '.webp';
const KB = 1024;

function toKb(bytes) {
  return bytes / KB;
}

function formatKb(kb) {
  return `${kb.toFixed(1)} KB`;
}

function isCoverAsset(asset) {
  return asset.startsWith(COVER_ASSET_PREFIX);
}

function getAssetType(asset) {
  if (asset === HERO_ASSET) {
    return 'hero';
  }
  if (isCoverAsset(asset)) {
    return 'cover';
  }
  return null;
}

function getSourcePath(asset) {
  return path.join(SOURCE_ROOT, `${asset}${JPG_EXT}`);
}

function getGeneratedPath(asset, width, extension) {
  return path.join(GENERATED_ROOT, `${asset}-${width}${extension}`);
}

function getWidthsForAsset(assetType) {
  return assetType === 'hero' ? HERO_WIDTHS : COVER_WIDTHS;
}

function getRatioForAsset(assetType) {
  return assetType === 'hero' ? HERO_RATIO : COVER_RATIO;
}

function getWebpBudgetKb(assetType, width) {
  return WEBP_BUDGETS_KB[assetType][width];
}

function getExpectedHeight(width, ratio) {
  return Math.round((width * ratio.height) / ratio.width);
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (_error) {
    return false;
  }
}

async function getFileSizeBytes(filePath) {
  const stat = await fs.stat(filePath);
  return stat.size;
}

async function getImageDimensions(filePath) {
  const metadata = await sharp(filePath).metadata();
  return {
    width: metadata.width ?? null,
    height: metadata.height ?? null
  };
}

async function readDataJson() {
  const raw = await fs.readFile(DATA_JSON_PATH, 'utf8');
  return JSON.parse(raw);
}

function collectCoverAssets(data, errors) {
  const assets = [];

  (data.materials || []).forEach((material) => {
    const materialRef = `material id=${material?.id ?? 'unknown'}`;
    const cover = material?.cover;

    if (!cover || typeof cover !== 'object' || Array.isArray(cover)) {
      errors.push(`${materialRef}: поле cover должно быть объектом.`);
      return;
    }

    if (typeof cover.asset !== 'string' || cover.asset.trim().length === 0) {
      errors.push(`${materialRef}: поле cover.asset обязательно.`);
      return;
    }

    if (!cover.asset.startsWith(COVER_ASSET_PREFIX)) {
      errors.push(`${materialRef}: cover.asset должен начинаться с "${COVER_ASSET_PREFIX}".`);
      return;
    }

    if (typeof cover.alt !== 'string' || cover.alt.trim().length === 0) {
      errors.push(`${materialRef}: поле cover.alt обязательно.`);
      return;
    }

    if (cover.focalPoint !== undefined && typeof cover.focalPoint !== 'string') {
      errors.push(`${materialRef}: cover.focalPoint должен быть строкой.`);
      return;
    }

    assets.push(cover.asset.trim());
  });

  return [...new Set(assets)];
}

async function checkSourceFile(asset, errors) {
  const sourcePath = getSourcePath(asset);
  if (!(await pathExists(sourcePath))) {
    errors.push(`Отсутствует source: ${sourcePath}`);
  }
}

async function checkGeneratedGeometry(filePath, asset, assetType, width, formatLabel, errors) {
  const ratio = getRatioForAsset(assetType);
  const expectedHeight = getExpectedHeight(width, ratio);

  try {
    const dimensions = await getImageDimensions(filePath);
    if (dimensions.width !== width || dimensions.height !== expectedHeight) {
      errors.push(
        `Некорректная геометрия ${formatLabel} (${asset}, ${width}w): `
        + `${dimensions.width ?? 'unknown'}x${dimensions.height ?? 'unknown'}, `
        + `ожидается ${width}x${expectedHeight} (${ratio.width}:${ratio.height})`
      );
    }
  } catch (error) {
    errors.push(`Не удалось прочитать размеры generated файла: ${filePath} (${error.message})`);
  }
}

async function checkGeneratedFilesAndBudgets(asset, assetType, errors) {
  const widths = getWidthsForAsset(assetType);

  for (const width of widths) {
    const webpPath = getGeneratedPath(asset, width, WEBP_EXT);
    const jpgPath = getGeneratedPath(asset, width, JPG_EXT);
    const webpBudgetKb = getWebpBudgetKb(assetType, width);
    const jpgBudgetKb = webpBudgetKb * JPEG_MAX_SIZE_RATIO;

    if (!(await pathExists(webpPath))) {
      errors.push(`Отсутствует generated файл: ${webpPath}`);
    } else {
      const sizeKb = toKb(await getFileSizeBytes(webpPath));
      if (sizeKb > webpBudgetKb) {
        errors.push(
          `Превышен budget WEBP (${asset}, ${width}w): ${formatKb(sizeKb)} > ${formatKb(webpBudgetKb)}`
        );
      }
      await checkGeneratedGeometry(webpPath, asset, assetType, width, 'WEBP', errors);
    }

    if (!(await pathExists(jpgPath))) {
      errors.push(`Отсутствует generated файл: ${jpgPath}`);
    } else {
      const sizeKb = toKb(await getFileSizeBytes(jpgPath));
      if (sizeKb > jpgBudgetKb) {
        errors.push(
          `Превышен budget JPEG (${asset}, ${width}w): ${formatKb(sizeKb)} > ${formatKb(jpgBudgetKb)}`
        );
      }
      await checkGeneratedGeometry(jpgPath, asset, assetType, width, 'JPEG', errors);
    }
  }
}

async function main() {
  const errors = [];
  const data = await readDataJson();

  if (!Array.isArray(data.materials)) {
    errors.push('data.json: поле materials должно быть массивом.');
  }

  const coverAssets = collectCoverAssets(data, errors);
  const assetsToCheck = [...coverAssets, HERO_ASSET];

  for (const asset of assetsToCheck) {
    const assetType = getAssetType(asset);
    if (!assetType) {
      errors.push(`Неподдерживаемый asset: ${asset}`);
      continue;
    }
    await checkSourceFile(asset, errors);
    await checkGeneratedFilesAndBudgets(asset, assetType, errors);
  }

  if (errors.length > 0) {
    console.error(`Проверка изображений не пройдена (${errors.length} ошибок):`);
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Проверка изображений пройдена. Проверено ассетов: ${assetsToCheck.length}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
