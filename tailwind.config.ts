
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
			zIndex: {
				header: '10',
				sidebar: '20', 
				overlay: '30',
				popover: '40',
				modal: '50',
				toast: '60'
			},
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
				// Enhanced brand tokens with new BloomSuite palette
				'brand-navy': {
					DEFAULT: '#30506E',
					50: '#F0F4F7',
					100: '#E1E9EF',
					200: '#C3D3DF',
					300: '#A5BDCF',
					400: '#87A7BF',
					500: '#30506E', // Primary brand navy
					600: '#284656',
					700: '#203C4E',
					800: '#183246',
					900: '#10283E',
				},
				'brand-teal': {
					DEFAULT: '#68BEB9',
					50: '#F0FFFE',
					100: '#E1FFFE',
					200: '#C3FFFC',
					300: '#A5FFFA',
					400: '#87DFD8',
					500: '#68BEB9', // Primary brand teal
					600: '#5AA8A3',
					700: '#4C928D',
					800: '#3E7C77',
					900: '#306661',
				},
				'mint': {
					50: '#F0FDF4',
					100: '#E7FAF7', // mint-100 for success backgrounds
					200: '#BCF5E6',
					300: '#86EFDB',
					400: '#4AE0C4',
					500: '#22D3B0',
					600: '#1FA87B', // mint-600 for success text/badges
					700: '#167A5B',
					800: '#0F5F45',
					900: '#0A4D36',
				},
				'sand': {
					50: '#FBF9F4', // sand-50 for main page background
					100: '#F7F3E8',
					200: '#F0E6D1',
					300: '#E8D9BA',
					400: '#E0CCA3',
					500: '#D8BF8C',
					600: '#C09970',
					700: '#A87354',
					800: '#904D38',
					900: '#78271C',
				},
				'brand-green': {
					DEFAULT: 'hsl(var(--primary))', // Use primary which is properly defined
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
					DEFAULT: 'hsl(var(--brand-blue))', // Keep this as is since --brand-blue exists
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
					draft: 'hsl(var(--chip-draft))',
					generated: 'hsl(var(--chip-generated))',
					approved: 'hsl(var(--chip-approved))',
					scheduled: 'hsl(var(--chip-scheduled))',
					posted: 'hsl(var(--chip-posted))',
				},
				// Enhanced gray scale
				gray: {
					...colors.gray,
					50: 'hsl(var(--gray-50))',
					100: 'hsl(var(--gray-100))',
					200: 'hsl(var(--gray-200))',
					700: 'hsl(var(--gray-700))',
				}
			},
			borderRadius,
			boxShadow,
			keyframes,
			animation,
			transitionTimingFunction,
			transitionDuration,
			// Background gradients
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))'
			},
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
						'--tw-prose-body': '#374151',
						'--tw-prose-headings': '#111827',
						'--tw-prose-lead': '#4b5563',
						'--tw-prose-links': '#15803d',
						'--tw-prose-bold': '#111827',
						'--tw-prose-counters': '#15803d',
						'--tw-prose-bullets': '#15803d',
						'--tw-prose-hr': '#e5e7eb',
						'--tw-prose-quotes': '#111827',
						'--tw-prose-quote-borders': '#15803d',
						'--tw-prose-captions': '#6b7280',
						'--tw-prose-code': '#111827',
						'--tw-prose-pre-code': '#e5e7eb',
						'--tw-prose-pre-bg': '#1f2937',
						'--tw-prose-th-borders': '#d1d5db',
						'--tw-prose-td-borders': '#e5e7eb',
						maxWidth: 'none',
						color: 'var(--tw-prose-body)',
						lineHeight: '1.75',
						'> :first-child': {
							marginTop: '0',
						},
						'> :last-child': {
							marginBottom: '0',
						},
						h1: {
							color: 'var(--tw-prose-headings)',
							fontWeight: '800',
							fontSize: '2.25em',
							marginTop: '0',
							marginBottom: '0.8888889em',
							lineHeight: '1.1111111',
						},
						h2: {
							color: 'var(--tw-prose-headings)',
							fontWeight: '700',
							fontSize: '1.5em',
							marginTop: '2em',
							marginBottom: '1em',
							lineHeight: '1.3333333',
						},
						h3: {
							color: 'var(--tw-prose-headings)',
							fontWeight: '600',
							fontSize: '1.25em',
							marginTop: '1.6em',
							marginBottom: '0.6em',
							lineHeight: '1.6',
						},
						h4: {
							color: 'var(--tw-prose-headings)',
							fontWeight: '600',
							marginTop: '1.5em',
							marginBottom: '0.5em',
							lineHeight: '1.5',
						},
						p: {
							marginTop: '1.25em',
							marginBottom: '1.25em',
						},
						strong: {
							color: 'var(--tw-prose-bold)',
							fontWeight: '600',
						},
						a: {
							color: 'var(--tw-prose-links)',
							textDecoration: 'underline',
							fontWeight: '500',
						},
						ul: {
							listStyleType: 'disc',
							paddingLeft: '1.5em',
						},
						ol: {
							listStyleType: 'decimal',
							paddingLeft: '1.5em',
						},
						li: {
							marginTop: '0.5em',
							marginBottom: '0.5em',
						},
						blockquote: {
							fontWeight: '500',
							fontStyle: 'italic',
							color: 'var(--tw-prose-quotes)',
							borderLeftWidth: '0.25rem',
							borderLeftColor: 'var(--tw-prose-quote-borders)',
							quotes: '"\\201C""\\201D""\\2018""\\2019"',
							marginTop: '1.6em',
							marginBottom: '1.6em',
							paddingLeft: '1em',
						},
					},
				},
				lg: {
					css: {
						fontSize: '1.125rem',
						lineHeight: '1.7777778',
						h1: {
							fontSize: '2.6666667em',
							marginTop: '0',
							marginBottom: '0.8333333em',
							lineHeight: '1',
						},
						h2: {
							fontSize: '1.6666667em',
							marginTop: '1.8666667em',
							marginBottom: '1.0666667em',
							lineHeight: '1.3333333',
						},
						h3: {
							fontSize: '1.3333333em',
							marginTop: '1.6666667em',
							marginBottom: '0.6666667em',
							lineHeight: '1.5',
						},
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
