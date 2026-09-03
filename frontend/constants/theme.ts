/**
 * Theme & Design System for ORCA Marine Intelligence
 * Optimized for outdoor readability, high contrast, large touch targets, and fisherman-friendly UI.
 */

export const COLORS = {
  // Brand Ocean / Marine Palette
  primary: '#0A2540',       // Deep Marine Navy
  primaryLight: '#0E3A64',  // Lighter Marine Navy for cards / accents
  oceanBlue: '#0066CC',     // Vibrant Ocean Blue for CTAs and highlights
  oceanBlueDark: '#004C99',
  skyBlue: '#E0F2FE',       // Soft Ocean Tint
  skyBlueBorder: '#BAE6FD',
  cyan: '#06B6D4',
  
  // Backgrounds
  background: '#F4F7FB',    // High-contrast outdoor light background
  cardBg: '#FFFFFF',        // Pure white card background
  cardBgAlt: '#F8FAFC',     // Subtle off-white
  surfaceSubtle: '#F1F5F9',
  
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

  // Typography Colors
  textPrimary: '#0F172A',   // Pitch Black / Deep Slate
  textSecondary: '#475569', // Readable Subtitle Slate
  textTertiary: '#64748B',
  textInverse: '#FFFFFF',
  
  // Borders & Accents
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#CBD5E1',
  activeIndicator: '#0284C7',
};

export const TYPOGRAPHY = {
  h1: { fontSize: 28, fontWeight: '800' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const },
  bodyLarge: { fontSize: 16, fontWeight: '600' as const },
  bodyMedium: { fontSize: 15, fontWeight: '500' as const },
  bodySmall: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '600' as const },
  statValue: { fontSize: 24, fontWeight: '800' as const },
  heroBadge: { fontSize: 22, fontWeight: '900' as const },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  touchTarget: 52, // minimum touch target for fingers
};

export const RADIUS = {
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
    shadowOpacity: 0.06,
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
    shadowRadius: 14,
    elevation: 7,
  },
};
