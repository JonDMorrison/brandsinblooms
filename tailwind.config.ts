
import type { Config } from "tailwindcss";

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
				heading: ['Plus Jakarta Sans', 'Satoshi', 'Inter', 'system-ui', 'sans-serif'],
				sans: ['Inter', 'system-ui', 'sans-serif'],
			},
			colors: {
				ink: {
					1: '#EAF6F1',
					2: '#B9C7C0',
				},
				brand: {
					green: '#20E39A',
					teal: '#34D3C5',
					purple: '#7A6CFF',
					pink: '#FF7AD1',
				},
				surface: {
					0: '#0A0F12',   // page
					1: 'rgba(255,255,255,0.06)', // glass
				},
				// Add missing mint color scale for compatibility
				mint: {
					50: '#F0FDF4',
					100: '#E7FAF7',
					200: '#BCF5E6',
					300: '#86EFDB',
					400: '#4AE0C4',
					500: '#22D3B0',
					600: '#1FA87B',
					700: '#167A5B',
					800: '#0F5F45',
					900: '#0A4D36',
				},
				// Add missing color utilities for tag classes
				amber: {
					200: '#FDE68A',
					900: '#78350F',
				},
				emerald: {
					200: '#A7F3D0',
					900: '#064E3B',
				},
				purple: {
					200: '#DDD6FE',
					900: '#581C87',
				},
				orange: {
					200: '#FED7AA',
					900: '#9A3412',
				},
				blue: {
					200: '#BFDBFE',
					900: '#1E3A8A',
				},
			},
			spacing: {
				'1': '0.25rem',   // 4px
				'2': '0.5rem',    // 8px
				'3': '0.75rem',   // 12px
				'4': '1rem',      // 16px
				'6': '1.5rem',    // 24px
				'8': '2rem',      // 32px
				'12': '3rem',     // 48px
				'16': '4rem',     // 64px
				'20': '5rem',     // 80px
				'24': '6rem',     // 96px
			},
			borderRadius: {
				'xs': '0.25rem',   // 4px
				'sm': '0.375rem',  // 6px
				'md': '0.5rem',    // 8px
				'lg': '0.75rem',   // 12px
				'xl': '1rem',      // 16px
				'2xl': '1.25rem',  // 20px
			},
			boxShadow: {
				'elev-1': '0 1px 2px rgba(0,0,0,0.25), 0 6px 18px rgba(0,0,0,0.22)',
				'elev-2': '0 6px 16px rgba(0,0,0,0.35), 0 18px 50px rgba(0,0,0,0.35)',
				'glow': '0 0 0 1px rgba(255,255,255,0.08), 0 0 24px rgba(32,227,154,0.25)',
			},
			backdropBlur: {
				xs: '4px',
			},
			keyframes: {
				float: {
					'0%,100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(-4px)' },
				},
				'pulse-glow': {
					'0%,100%': { boxShadow: '0 0 0 0 rgba(32,227,154,0.0)' },
					'50%': { boxShadow: '0 0 24px 2px rgba(32,227,154,0.35)' },
				},
				shimmer: {
					'0%': { backgroundPosition: '0% 50%' },
					'100%': { backgroundPosition: '100% 50%' },
				},
				fadeScaleIn: {
					'0%': { opacity: '0', transform: 'scale(0.98)' },
					'100%': { opacity: '1', transform: 'scale(1)' },
				},
			},
			animation: {
				float: 'float 6s ease-in-out infinite',
				'pulse-glow': 'pulse-glow 2.6s ease-in-out infinite',
				shimmer: 'shimmer 6s linear infinite',
				fadeScaleIn: 'fadeScaleIn 180ms cubic-bezier(.2,.8,.2,1)',
			},
			backgroundImage: {
				'grad-primary': 'linear-gradient(135deg, #20E39A 0%, #2FC1FF 40%, #7A6CFF 100%)',
				'grad-secondary': 'linear-gradient(135deg, #86F7C5 0%, #66E0D9 50%, #A77BFF 100%)',
			},
			transitionTimingFunction: {
				brand: 'cubic-bezier(.22,1,.36,1)', // gentle springy
			},
			transitionDuration: {
				fast: '160ms',
				base: '220ms',
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
