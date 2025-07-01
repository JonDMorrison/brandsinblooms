
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
				// Soft nature-inspired brand palette
				'brand-sage': {
					DEFAULT: '#68BEB9',          /* Primary sage-teal */
					50: '#F4FBFA',               /* Very light sage */
					100: '#E8F6F4',              /* Light sage backgrounds */
					200: '#D1EDEA',              /* Soft sage */
					300: '#A5DBD5',              /* Medium-light sage */
					400: '#7AC9C0',              /* Medium sage */
					500: '#68BEB9',              /* Primary sage-teal */
					600: '#5AA29D',              /* Deeper sage */
					700: '#4C8682',              /* Dark sage */
					800: '#3E6A67',              /* Very dark sage */
					900: '#305553',              /* Darkest sage */
				},
				'brand-cream': {
					DEFAULT: '#FBF9F4',          /* Primary cream background */
					50: '#FFFEFB',               /* Almost white cream */
					100: '#FBF9F4',              /* Primary cream */
					200: '#F8F4EB',              /* Slightly deeper cream */
					300: '#F2EAD7',              /* Medium cream */
					400: '#E8DCC3',              /* Deeper cream */
					500: '#DDD0AF',              /* Warm cream */
					600: '#C7B896',              /* Beige-cream */
					700: '#A69B7D',              /* Dark cream */
					800: '#857E65',              /* Very dark cream */
					900: '#6B654E',              /* Darkest cream */
				},
				'sage': {
					50: '#F4FBFA',               /* Very light sage - for backgrounds */
					100: '#E8F6F4',              /* Light sage - for hover states */
					200: '#D1EDEA',              /* Soft sage - for borders */
					300: '#A5DBD5',              /* Medium-light sage */
					400: '#7AC9C0',              /* Medium sage */
					500: '#68BEB9',              /* Primary sage - matches brand-sage */
					600: '#5AA29D',              /* Success states, buttons */
					700: '#4C8682',              /* Dark sage - for text */
					800: '#3E6A67',              /* Very dark sage */
					900: '#305553',              /* Darkest sage */
				},
				'cream': {
					50: '#FFFEFB',               /* Almost white - for pure backgrounds */
					100: '#FBF9F4',              /* Primary cream - main backgrounds */
					200: '#F8F4EB',              /* Slightly deeper - for subtle contrast */
					300: '#F2EAD7',              /* Medium cream - for borders */
					400: '#E8DCC3',              /* Deeper cream - for inactive states */
					500: '#DDD0AF',              /* Warm cream - for muted elements */
					600: '#C7B896',              /* Beige cream - for secondary text */
					700: '#A69B7D',              /* Dark cream - for tertiary text */
					800: '#857E65',              /* Very dark cream */
					900: '#6B654E',              /* Darkest cream */
				},
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
