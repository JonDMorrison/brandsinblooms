
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
			fontFamily: {
				'sans': ['Quicksand', 'system-ui', 'sans-serif'],
				'quicksand': ['Quicksand', 'system-ui', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: '#3E5A6B',
					50: '#F5F7F8',
					100: '#E8ECEF',
					200: '#C7D1D8',
					300: '#A6B6C1',
					400: '#649BA1',
					500: '#3E5A6B',
					600: '#385160',
					700: '#2F4350',
					800: '#263540',
					900: '#1F2B34',
					foreground: '#FFFFFF'
				},
				secondary: {
					DEFAULT: '#68BEB9',
					50: '#F0FCFB',
					100: '#D4F5F3',
					200: '#AAE9E5',
					300: '#7FDDD6',
					400: '#68BEB9',
					500: '#54A09B',
					600: '#45807C',
					700: '#36605D',
					800: '#27403E',
					900: '#18201F',
					foreground: '#3E5A6B'
				},
				tertiary: {
					DEFAULT: '#C2C2C2',
					50: '#FAFAFA',
					100: '#F5F5F5',
					200: '#E5E5E5',
					300: '#D4D4D4',
					400: '#C2C2C2',
					500: '#A3A3A3',
					600: '#737373',
					700: '#525252',
					800: '#404040',
					900: '#262626',
					foreground: '#3E5A6B'
				},
				destructive: {
					DEFAULT: '#EF4444',
					foreground: '#FFFFFF'
				},
				warning: {
					DEFAULT: '#F59E0B',
					50: '#FFFBEB',
					100: '#FEF3C7',
					500: '#F59E0B',
					foreground: '#3E5A6B'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				garden: {
					background: '#F8F9FA',
					sage: '#F0F7F4',
					green: '#3E5A6B',
					'green-dark': '#3E5A6B',
					coral: '#68BEB9',
					'coral-light': '#D4F5F3'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
