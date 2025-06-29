
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
				sans: ['Inter', 'Quicksand', 'system-ui', 'sans-serif'],
				quicksand: ['Quicksand', 'Inter', 'system-ui', 'sans-serif'],
				inter: ['Inter', 'system-ui', 'sans-serif'],
				display: ['Quicksand', 'Inter', 'system-ui', 'sans-serif'],
			},
			fontSize,
			fontWeight,
			spacing: {
				...spacing,
				'24': '6rem', // 96px - For 24px grid gaps
			},
			colors: {
				...colors,
				// Brand colors - primary palette
				brand: '#68BEB9', // Primary brand color
				'brand-teal-mint': {
					DEFAULT: '#68BEB9',
					50: '#F0FFFE',
					100: '#E1FFFE',
					200: '#C3FFFC',
					300: '#A5FFFA',
					400: '#87DFD8',
					500: '#68BEB9', // Primary brand teal-mint
					600: '#5AA8A3',
					700: '#4C928D',
					800: '#3E7C77',
					900: '#306661',
				},
				'brand-steel-blue': {
					DEFAULT: '#3E5A6B',
					50: '#F0F2F4',
					100: '#E1E6EA',
					200: '#C3CDD5',
					300: '#A5B4C0',
					400: '#879BAB',
					500: '#3E5A6B', // Primary brand steel-blue
					600: '#354F5F',
					700: '#2C4253',
					800: '#233547',
					900: '#1A283B',
				},
				// Override primary and accent to use brand colors
				primary: {
					DEFAULT: '#68BEB9', // Brand teal-mint
					50: '#F0FFFE',
					100: '#E1FFFE',
					200: '#C3FFFC',
					300: '#A5FFFA',
					400: '#87DFD8',
					500: '#68BEB9',
					600: '#5AA8A3',
					700: '#4C928D',
					800: '#3E7C77',
					900: '#306661',
					foreground: '#FFFFFF'
				},
				accent: {
					DEFAULT: '#68BEB9', // Brand teal-mint
					50: '#F0FFFE',
					100: '#E1FFFE',
					500: '#68BEB9',
					foreground: '#FFFFFF'
				},
				secondary: {
					DEFAULT: '#F1F5F9',
					50: '#F8FAFC',
					100: '#F1F5F9',
					200: '#E2E8F0',
					300: '#CBD5E1',
					400: '#94A3B8',
					500: '#64748B',
					600: '#475569',
					700: '#334155',
					800: '#1E293B',
					900: '#0F172A',
					foreground: '#000000'
				},
				success: {
					DEFAULT: '#68BEB9',
					50: '#F0FFFE',
					100: '#E1FFFE',
					500: '#68BEB9',
					600: '#5AA8A3',
					foreground: '#FFFFFF'
				},
				warning: {
					DEFAULT: '#64748B', // Neutral slate instead of orange/yellow
					50: '#F8FAFC',
					100: '#F1F5F9',
					500: '#64748B',
					600: '#475569',
					foreground: '#FFFFFF'
				},
				destructive: {
					DEFAULT: '#DC2626', // Keep red for destructive actions
					50: '#FEF2F2',
					100: '#FEE2E2',
					500: '#DC2626',
					600: '#B91C1C',
					foreground: '#FFFFFF'
				},
				muted: {
					DEFAULT: '#F1F5F9',
					50: '#F8FAFC',
					100: '#F1F5F9',
					foreground: '#64748B'
				},
				popover: {
					DEFAULT: '#FFFFFF',
					foreground: '#000000'
				},
				card: {
					DEFAULT: '#FFFFFF',
					foreground: '#000000'
				},
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
						'--tw-prose-links': '#68BEB9', // Brand teal-mint for links
						'--tw-prose-bold': '#111827',
						'--tw-prose-counters': '#68BEB9', // Brand teal-mint for counters
						'--tw-prose-bullets': '#68BEB9', // Brand teal-mint for bullets
						'--tw-prose-hr': '#e5e7eb',
						'--tw-prose-quotes': '#111827',
						'--tw-prose-quote-borders': '#68BEB9', // Brand teal-mint for quote borders
						'--tw-prose-captions': '#6b7280',
						'--tw-prose-code': '#111827',
						'--tw-prose-pre-code': '#e5e7eb',
						'--tw-prose-pre-bg': '#1f2937',
						'--tw-prose-th-borders': '#d1d5db',
						'--tw-prose-td-borders': '#e5e7eb',
						maxWidth: 'none',
						color: 'var(--tw-prose-body)',
						lineHeight: '1.75',
						fontFamily: 'Inter, Quicksand, system-ui, sans-serif',
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
			},
		}
	},
	plugins: [
		require("tailwindcss-animate"),
		require("@tailwindcss/typography"),
	],
} satisfies Config;
