const COVER_WIDTHS = [160, 240, 320, 480];
const HERO_WIDTHS = [640, 960, 1280];

const PRESETS = {
  coverCarousel: {
    widths: COVER_WIDTHS,
    ratio: { width: 3, height: 4 },
    sizes: '(max-width: 480px) 126px, 140px',
    defaultLoading: 'lazy',
    defaultFetchPriority: 'auto',
    imageClassName: 'material-card__cover-img'
  },
  coverCatalog: {
    widths: COVER_WIDTHS,
    ratio: { width: 3, height: 4 },
    sizes: '(max-width: 480px) 80px, 88px',
    defaultLoading: 'lazy',
    defaultFetchPriority: 'auto',
    imageClassName: 'catalog-card__cover-img'
  },
  coverDetail: {
    widths: COVER_WIDTHS,
    ratio: { width: 3, height: 4 },
    sizes: '(max-width: 380px) 106px, (max-width: 480px) 96px, 116px',
    defaultLoading: 'eager',
    defaultFetchPriority: 'high',
    imageClassName: 'material-page__cover-img'
  },
  homeHero: {
    widths: HERO_WIDTHS,
    ratio: { width: 8, height: 3 },
    sizes: '(max-width: 640px) 100vw, 640px',
    defaultLoading: 'eager',
    defaultFetchPriority: 'high',
    imageClassName: 'home-banner__img'
  }
};

function buildSrcset(asset, widths, extension) {
  return widths
    .map((width) => `assets/images/generated/${asset}-${width}.${extension} ${width}w`)
    .join(', ');
}

function computeDimensions(width, ratio) {
  return {
    width,
    height: Math.round((width * ratio.height) / ratio.width)
  };
}

function getPreset(name) {
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown image preset: ${name}`);
  }
  return preset;
}

function sanitizeFocalPoint(focalPoint) {
  if (typeof focalPoint !== 'string' || focalPoint.trim().length === 0) {
    return '50% 50%';
  }
  return focalPoint.trim();
}

export function createResponsivePicture(options) {
  const {
    asset,
    alt,
    focalPoint,
    preset,
    loading,
    fetchPriority
  } = options || {};

  if (typeof asset !== 'string' || asset.trim().length === 0) {
    throw new Error('createResponsivePicture: asset is required');
  }

  if (typeof alt !== 'string') {
    throw new Error('createResponsivePicture: alt must be a string');
  }

  const selectedPreset = getPreset(preset);
  const widths = selectedPreset.widths;
  const maxWidth = widths[widths.length - 1];
  const dimensions = computeDimensions(maxWidth, selectedPreset.ratio);
  const normalizedFocalPoint = sanitizeFocalPoint(focalPoint);

  const picture = document.createElement('picture');
  picture.className = 'responsive-picture';

  const webpSource = document.createElement('source');
  webpSource.type = 'image/webp';
  webpSource.srcset = buildSrcset(asset.trim(), widths, 'webp');
  webpSource.sizes = selectedPreset.sizes;

  const image = document.createElement('img');
  image.className = selectedPreset.imageClassName;
  image.srcset = buildSrcset(asset.trim(), widths, 'jpg');
  image.sizes = selectedPreset.sizes;
  image.src = `assets/images/generated/${asset.trim()}-${maxWidth}.jpg`;
  image.alt = alt;
  image.width = dimensions.width;
  image.height = dimensions.height;
  image.loading = loading || selectedPreset.defaultLoading;
  image.decoding = 'async';
  image.style.objectPosition = normalizedFocalPoint;
  image.setAttribute('fetchpriority', fetchPriority || selectedPreset.defaultFetchPriority);

  picture.appendChild(webpSource);
  picture.appendChild(image);
  return picture;
}
