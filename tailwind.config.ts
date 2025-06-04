
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
				warning: {
					DEFAULT: '#FFD166',
					50: '#FFF9E6',
					100: '#FFECB3',
					500: '#FFD166',
					foreground: '#2D3748'
				},
				accent: {
					blue: '#8ECAE6',
					yellow: '#FFD166',
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
					foreground: '#2D3748',
					primary: '#4CAF50',
					'primary-foreground': '#FFFFFF',
					accent: '#E8F5E8',
					'accent-foreground': '#2D3748',
					border: '#C8E6C9',
					ring: '#4CAF50'
				},
				garden: {
					background: '#F7FAF5',
					sage: '#F0F7F4',
					green: '#4CAF50',
					'green-dark': '#3A865E',
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
