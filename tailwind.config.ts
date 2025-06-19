
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
			fontFamily: {
				...fontFamily,
				display: ['Inter', 'system-ui', 'sans-serif'],
			},
			fontSize,
			fontWeight,
			spacing: {
				...spacing,
				'24': '6rem', // 96px - For 24px grid gaps
			},
			colors: {
				...colors,
				primary: {
					...colors.primary,
					DEFAULT: '#15803d', // Garden green for blog polish
				},
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
					700: '#15803D', // Updated for blog polish
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
			// 12-column grid system
			gridTemplateColumns: {
				'12': 'repeat(12, minmax(0, 1fr))',
				'dashboard': '8fr 4fr', // Hero section layout
				'content-actions': 'repeat(3, 1fr)', // Quick action tiles
			},
			gap: {
				'24': '1.5rem', // 24px for grid gaps
			},
			// Enhanced breakpoints for the grid system
			screens: {
				'sm': '640px',
				'md': '768px',
				'lg': '1024px', // Key breakpoint for 12-column grid
				'xl': '1280px',
				'2xl': '1536px',
			},
			typography: {
				DEFAULT: {
					css: {
						'--tw-prose-headings': '#1f2937',
						'--tw-prose-links': '#15803d',
						'--tw-prose-bold': '#111827',
						'--tw-prose-counters': '#15803d',
						'--tw-prose-bullets': '#15803d',
						'--tw-prose-quotes': '#111827',
						'--tw-prose-quote-borders': '#15803d',
					},
				},
			},
		}
	},
	plugins: [
		require("tailwindcss-animate"),
		require("@tailwindcss/typography"),
	],
} satisfies Config;
