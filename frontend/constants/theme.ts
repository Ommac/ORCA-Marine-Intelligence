/**
 * Theme & Design System for ORCA Marine Intelligence
 * Optimized for outdoor readability, high contrast, large touch targets, and fisherman-friendly UI.
 */

export const COLORS = {
  // Brand Ocean / Marine Palette
  primary: '#0A2540',       // Deep Marine Navy
  primaryDark: '#061826',   // Midnight Abyss
  primaryLight: '#0E3A64',  // Lighter Marine Navy for cards / accents
  oceanBlue: '#0066CC',     // Vibrant Ocean Blue for CTAs and highlights
  oceanBlueDark: '#004C99',
  skyBlue: '#E0F2FE',       // Soft Ocean Tint
  skyBlueBorder: '#BAE6FD',
  cyan: '#06B6D4',
  cyanBg: '#ECFEFF',
  cyanBorder: '#A5F3FC',
  
  // Backgrounds
  background: '#F1F5F9',    // High-contrast outdoor light slate background
  cardBg: '#FFFFFF',        // Pure white card background
  cardBgAlt: '#F8FAFC',     // Subtle off-white
  surfaceSubtle: '#F8FAFC',
  
  // High-Contrast Status Colors
  safe: '#15803D',          // Vibrant Forest Green (Accessible & High Contrast)
  safeBg: '#DCFCE7',
  safeBorder: '#86EFAC',
  safeText: '#14532D',

  caution: '#C2410C',       // Rich Alert Orange
  cautionBg: '#FFEDD5',
  cautionBorder: '#FDBA74',
  cautionText: '#7C2D12',

  danger: '#B91C1C',        // Crimson Warning Red
  dangerBg: '#FEE2E2',
  dangerBorder: '#FCA5A5',
  dangerText: '#7F1D1D',

  neutral: '#475569',       // Slate Gray for unavailable/info
  neutralBg: '#F1F5F9',
  neutralBorder: '#CBD5E1',
  neutralText: '#334155',

  // Agent / Feature Badges
  purple: '#7E22CE',
  purpleBg: '#F3E8FF',
  purpleBorder: '#D8B4FE',
  
  teal: '#0D9488',
  tealBg: '#CCFBF1',
  tealBorder: '#99F6E4',

  amber: '#D97706',
  amberBg: '#FEF3C7',
  amberBorder: '#FDE68A',

  // Typography Colors
  textPrimary: '#0F172A',   // Pitch Black / Deep Slate
  textSecondary: '#475569', // Readable Subtitle Slate
  textTertiary: '#64748B',
  textInverse: '#FFFFFF',
  textInverseMuted: '#94A3B8',
  
  // Borders & Accents
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderDark: '#CBD5E1',
  divider: '#CBD5E1',
  activeIndicator: '#0284C7',
};

export const TYPOGRAPHY = {
  h1: { fontSize: 26, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 21, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: '700' as const },
  bodyLarge: { fontSize: 15, fontWeight: '600' as const },
  bodyMedium: { fontSize: 14, fontWeight: '500' as const },
  bodySmall: { fontSize: 12.5, fontWeight: '500' as const },
  caption: { fontSize: 11.5, fontWeight: '600' as const },
  statValue: { fontSize: 22, fontWeight: '800' as const },
  heroBadge: { fontSize: 20, fontWeight: '900' as const },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  touchTarget: 48, // minimum touch target for fingers
};

export const RADIUS = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
};
