/**
 * Derive Design Tokens - Direction A: Mineral
 * Aesthetic: Apple-grade minimalism, architectural mineral greens, warm ivory canvas,
 * elevated clean white surfaces, deep ink typography.
 */

export const colors = {
  // Canvas & Backgrounds
  canvas: '#F6F3EC', // Warm Ivory Canvas
  canvasMuted: '#EDE8DF',

  // Surfaces
  surface: '#FFFEFB', // Elevated Clean Mineral Card
  surfaceMuted: '#ECE7DE', // Soft Sand Border / Inactive card
  surfaceElevated: '#FFFFFF',

  // Typography / Ink
  ink: '#171A18', // Primary Deep Charcoal Ink (12.4:1 contrast ratio against canvas)
  inkMuted: '#626760', // Secondary Muted Charcoal (4.8:1 contrast ratio)
  inkSubtle: '#8C928A',
  inkInverse: '#FFFEFB',

  // Brand Accents
  brand: '#345447', // Deep Architectural Mineral Green
  brandLight: '#E2EAE4', // Soft Sage Tint (Selected cards, chips)
  brandDark: '#1E362C', // Deep Forest Shade

  // Borders & Dividers
  border: '#E5E0D5', // Hairline card boundary
  borderSubtle: '#EDE8E0',
  borderStrong: '#C5BEB1',
  hairline: '#EAE5DC',

  // Semantic Status & Routine Actions (Always paired with clear text)
  actionKeep: {
    text: '#2D5A43',
    bg: '#EBF2EE',
    border: '#C3D8CB',
  },
  actionPause: {
    text: '#935824',
    bg: '#FAF2EB',
    border: '#ECD3BD',
  },
  actionStop: {
    text: '#9E2A2B',
    bg: '#F9EBEB',
    border: '#E5BDBE',
  },
  actionReplace: {
    text: '#335C67',
    bg: '#E8EFF1',
    border: '#C2D9DF',
  },
  actionAdd: {
    text: '#345447',
    bg: '#E2EAE4',
    border: '#BED1C5',
  },
  actionReview: {
    text: '#7A5B28',
    bg: '#FBF4E8',
    border: '#EAD9BD',
  },
  safetyAlert: {
    text: '#9E2A2B',
    bg: '#F9EBEB',
    border: '#E5BDBE',
  },

  // Liquid Glass Specific Tints
  glass: {
    tintLight: 'rgba(255, 254, 251, 0.75)',
    tintDark: 'rgba(23, 26, 24, 0.78)',
    border: 'rgba(255, 255, 255, 0.55)',
    borderDark: 'rgba(23, 26, 24, 0.12)',
  },
} as const;

export const typography = {
  fontFamilies: {
    serif: 'Georgia',
    sans: 'System',
    mono: 'Courier',
  },
  sizes: {
    display: 32,
    screenTitle: 26,
    sectionTitle: 20,
    bodyLarge: 17,
    bodyRegular: 15,
    caption: 13,
    micro: 11,
  },
  lineHeights: {
    display: 38,
    screenTitle: 32,
    sectionTitle: 26,
    bodyLarge: 24,
    bodyRegular: 22,
    caption: 18,
    micro: 14,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
};

export const shadows = {
  subtle: {
    shadowColor: '#171A18',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  card: {
    shadowColor: '#171A18',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  floating: {
    shadowColor: '#171A18',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
};

export const layout = {
  gutter: 24,
  sectionGap: 32,
  itemGap: 16,
  titleGap: 8,
  cardPadding: 20,
  minTouchTarget: 44,
  ctaHeight: 54,
} as const;

