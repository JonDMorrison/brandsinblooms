
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
					DEFAULT: '#4CAF50',
					50: '#E8F5E8',
					100: '#C8E6C9',
					500: '#4CAF50',
					600: '#3A865E',
					700: '#2E7D32',
					foreground: '#FFFFFF'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: '#E53E3E',
					foreground: '#FFFFFF'
				},
				// REMOVED ALL YELLOW/AMBER/WARNING COLORS - REPLACED WITH NEUTRAL
				warning: {
					DEFAULT: '#6B7280', // gray-500 instead of orange
					50: '#F9FAFB',     // gray-50 instead of orange
					100: '#F3F4F6',    // gray-100 instead of orange
					500: '#6B7280',    // gray-500 instead of orange
					600: '#4B5563',    // gray-600 instead of orange
					foreground: '#FFFFFF'
				},
				accent: {
					blue: '#8ECAE6',
					orange: '#6B7280', // Changed to gray instead of orange
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
					DEFAULT: '#F0F7F4',
					foreground: '#000000',
					primary: '#4CAF50',
					'primary-foreground': '#FFFFFF',
					accent: '#E8F5E8',
					'accent-foreground': '#000000',
					border: '#C8E6C9',
					ring: '#4CAF50'
				},
				garden: {
					background: '#F7FAF5',
					sage: '#F0F7F4',
					green: '#4CAF50',
					'green-dark': '#000000',
					coral: '#FF8A80',
					'coral-light': '#FFCDD2'
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
