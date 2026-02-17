export const IMAGE_ROOT = 'assets/images';
export const SOURCE_ROOT = `${IMAGE_ROOT}/src`;
export const GENERATED_ROOT = `${IMAGE_ROOT}/generated`;

export const COVER_ASSET_PREFIX = 'materials/';
export const HERO_ASSET = 'home/hero';

export const COVER_WIDTHS = [160, 240, 320, 480];
export const HERO_WIDTHS = [640, 960, 1280];

export const COVER_RATIO = { width: 3, height: 4 };
export const HERO_RATIO = { width: 8, height: 3 };

export const WEBP_QUALITY = 72;
export const JPEG_QUALITY = 78;
export const JPEG_MAX_SIZE_RATIO = 1.35;

export const WEBP_BUDGETS_KB = {
  cover: {
    160: 18,
    240: 28,
    320: 40,
    480: 65
  },
  hero: {
    640: 70,
    960: 120,
    1280: 180
  }
};
