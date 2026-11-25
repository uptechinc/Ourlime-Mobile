import type { TextStyle } from 'react-native';
import type featherGlyphMap from 'react-native-vector-icons/glyphmaps/Feather.json';
import type { AppThemeColors } from '@/lib/contexts/ThemeContext';

/**
 * Admin design tokens (docs/ui-review/ADMIN_REDESIGN.md section 1). Every admin screen and admin
 * primitive reads spacing, type, radius and tone from here, so the admin area cannot drift again.
 * Colours are never hex here: tones are derived from useAppTheme().colors, so they follow dark mode.
 */

/** Spacing scale. 5, 7, 9, 11, 13, 15 and 17 are not on it and are banned in admin. */
export const space = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
} as const;

export type AdminSpace = keyof typeof space;

export type AdminTypeStyle = Required<Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight'>> &
	Pick<TextStyle, 'letterSpacing' | 'textTransform' | 'fontVariant'>;

/** Type scale. No 800/900 weights and nothing under 11pt in admin. */
export const type = {
	/** Stat hero numbers. */
	display: { fontSize: 28, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
	/** Screen and dialog titles. */
	title: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
	/** Card and section headings. */
	section: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
	/** Row titles and descriptions. */
	body: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
	/** Row primary label and button text. */
	bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
	/** Timestamps, IDs, "N of M". */
	meta: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
	/** Eyebrows, field labels, status pill text. */
	label: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
} as const satisfies { [name: string]: AdminTypeStyle };

export type AdminTypeName = keyof typeof type;

/** Corner radius scale. Dialogs use `dialog` (24) per custom-modals.md; sheets keep their 24 top corners. */
export const radius = {
	sm: 8,
	md: 12,
	lg: 16,
	dialog: 24,
	pill: 999,
} as const;

export type AdminRadius = keyof typeof radius;

/** Minimum touch target for every admin pressable. */
export const ADMIN_MIN_TOUCH = 44;

/** Feather glyph names; admin uses Feather only (redesign decision 8). */
export type AdminIconName = keyof typeof featherGlyphMap;

export type AdminToneName = 'positive' | 'pending' | 'danger' | 'neutral';

export type AdminTone = {
	/** Background tint: chips, selected tabs, buttons, banners. */
	soft: string;
	/** 1px border that matches `soft`. */
	border: string;
	/** Base text and icon colour on `soft`. */
	text: string;
	/** ONLY for tiny status dots, chart marks and image-overlay controls. */
	solid: string;
};

/** Soft tone for an admin state, derived from the active theme. Danger stays mobile red (admin-only). */
export function getAdminTone(colors: AppThemeColors, tone: AdminToneName): AdminTone {
	switch (tone) {
		case 'positive':
			return { soft: colors.successSurface, border: colors.successBorder, text: colors.accentText, solid: colors.accent };
		case 'pending':
			return { soft: colors.warningSurface, border: colors.warningBorder, text: colors.warningText, solid: colors.warning };
		case 'danger':
			return { soft: colors.destructiveSurface, border: colors.destructiveBorder, text: colors.destructiveText, solid: colors.destructive };
		case 'neutral':
		default:
			return { soft: colors.control, border: colors.border, text: colors.secondaryText, solid: colors.mutedText };
	}
}

/** Aliases for call sites where a bare `type` / `space` / `radius` import would be ambiguous or shadowed. */
export const adminSpace = space;
export const adminType = type;
export const adminRadius = radius;
