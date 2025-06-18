
import type { Config } from "tailwindcss";
import { colors } from "./src/config/tailwind/colors";
import { fontFamily, fontSize, fontWeight } from "./src/config/tailwind/typography";
import { spacing, borderRadius } from "./src/config/tailwind/spacing";
import { boxShadow, transitionTimingFunction, transitionDuration } from "./src/config/tailwind/effects";
import { keyframes, animation } from "./src/config/tailwind/animations";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily,
			fontSize,
			fontWeight,
			spacing: {
				...spacing,
				'6': '1.5rem', // 24px - Standard grid gap
				'24': '6rem', // 96px - For larger sections
			},
			colors: {
				...colors,
				// Enhanced brand tokens
				'brand-green': {
					DEFAULT: 'rgb(var(--brand-green))',
					50: '#E8F5E8',
					100: '#C8E6C9',
					200: '#A5D6A7',
					300: '#81C784',
					400: '#66BB6A',
					500: '#22C55E', // Primary brand green
					600: '#16A34A',
					700: '#15803D',
					800: '#166534',
					900: '#14532D',
				},
				'brand-blue': {
					DEFAULT: 'rgb(var(--brand-blue))',
					50: '#EFF6FF',
					100: '#DBEAFE',
					200: '#BFDBFE',
					300: '#93C5FD',
					400: '#60A5FA',
					500: '#2563EB', // Primary brand blue
					600: '#1D4ED8',
					700: '#1E40AF',
					800: '#1E3A8A',
					900: '#1E3A8A',
				},
				// Status chip colors
				'chip': {
					draft: 'rgb(var(--chip-draft))',
					generated: 'rgb(var(--chip-generated))',
					approved: 'rgb(var(--chip-approved))',
					scheduled: 'rgb(var(--chip-scheduled))',
					posted: 'rgb(var(--chip-posted))',
				},
				// Enhanced gray scale
				gray: {
					...colors.gray,
					50: 'rgb(var(--gray-50))',
					100: 'rgb(var(--gray-100))',
					200: 'rgb(var(--gray-200))',
					700: 'rgb(var(--gray-700))',
				}
			},
			borderRadius,
			boxShadow,
			keyframes,
			animation,
			transitionTimingFunction,
			transitionDuration,
			// Enhanced 12-column grid system with proper templates
			gridTemplateColumns: {
				'12': 'repeat(12, minmax(0, 1fr))',
				'dashboard': '8fr 4fr', // Hero section layout - 8/4 split
				'content-actions': 'repeat(3, 1fr)', // Quick action tiles
				'hero': '2fr 1fr', // Alternative hero layout
			},
			gap: {
				'6': '1.5rem', // 24px - Standard grid system gap
				'24': '1.5rem', // Alias for consistency
			},
			// Enhanced container max-widths for grid system
			maxWidth: {
				'7xl': '80rem', // 1280px - Main content container
				'grid': '1200px', // Optimal width for 12-column grid
			},
			// Enhanced breakpoints optimized for 12-column grid
			screens: {
				'sm': '640px',  // Mobile landscape
				'md': '768px',  // Tablet
				'lg': '1024px', // Desktop - Key breakpoint for 12-column grid
				'xl': '1280px', // Large desktop
				'2xl': '1536px', // Extra large
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
