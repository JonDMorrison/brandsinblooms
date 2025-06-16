
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
			fontSize: {
				'xs': ['0.75rem', { lineHeight: '1rem' }],      // 12px
				'sm': ['0.875rem', { lineHeight: '1.25rem' }],  // 14px
				'base': ['1rem', { lineHeight: '1.5rem' }],     // 16px
				'lg': ['1.125rem', { lineHeight: '1.75rem' }],  // 18px
				'xl': ['1.25rem', { lineHeight: '1.75rem' }],   // 20px
				'2xl': ['1.5rem', { lineHeight: '2rem' }],      // 24px
				'3xl': ['1.875rem', { lineHeight: '2.25rem' }], // 30px
				'4xl': ['2.25rem', { lineHeight: '2.5rem' }],   // 36px
				'5xl': ['3rem', { lineHeight: '1' }],           // 48px
				'6xl': ['3.75rem', { lineHeight: '1' }],        // 60px
			},
			fontWeight: {
				'light': '300',
				'normal': '400',
				'medium': '500',
				'semibold': '600',
				'bold': '700',
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
					200: '#A5D6A7',
					300: '#81C784',
					400: '#66BB6A',
					500: '#4CAF50',
					600: '#43A047',
					700: '#388E3C',
					800: '#2E7D32',
					900: '#1B5E20',
					foreground: '#FFFFFF'
				},
				secondary: {
					DEFAULT: '#F5F5F5',
					50: '#FAFAFA',
					100: '#F5F5F5',
					200: '#EEEEEE',
					300: '#E0E0E0',
					400: '#BDBDBD',
					500: '#9E9E9E',
					600: '#757575',
					700: '#616161',
					800: '#424242',
					900: '#212121',
					foreground: '#000000'
				},
				success: {
					DEFAULT: '#4CAF50',
					50: '#E8F5E8',
					100: '#C8E6C9',
					500: '#4CAF50',
					600: '#43A047',
					foreground: '#FFFFFF'
				},
				warning: {
					DEFAULT: '#FF9800',
					50: '#FFF3E0',
					100: '#FFE0B2',
					500: '#FF9800',
					600: '#F57C00',
					foreground: '#FFFFFF'
				},
				destructive: {
					DEFAULT: '#F44336',
					50: '#FFEBEE',
					100: '#FFCDD2',
					500: '#F44336',
					600: '#E53935',
					foreground: '#FFFFFF'
				},
				muted: {
					DEFAULT: '#F5F5F5',
					50: '#FAFAFA',
					100: '#F5F5F5',
					foreground: '#757575'
				},
				accent: {
					DEFAULT: '#E3F2FD',
					50: '#E3F2FD',
					100: '#BBDEFB',
					500: '#2196F3',
					foreground: '#1976D2'
				},
				popover: {
					DEFAULT: '#FFFFFF',
					foreground: '#000000'
				},
				card: {
					DEFAULT: '#FFFFFF',
					foreground: '#000000'
				},
				// Semantic color system
				surface: {
					primary: '#FFFFFF',
					secondary: '#F8F9FA',
					tertiary: '#F1F3F4',
				},
				text: {
					primary: '#202124',
					secondary: '#5F6368',
					tertiary: '#9AA0A6',
					inverse: '#FFFFFF',
				}
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
				'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
				'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
				'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
				'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
				'2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(4px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'scale-in': {
					'0%': {
						opacity: '0',
						transform: 'scale(0.98)'
					},
					'100%': {
						opacity: '1',
						transform: 'scale(1)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.2s ease-out',
				'scale-in': 'scale-in 0.15s ease-out',
			},
			transitionTimingFunction: {
				'apple': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
			},
			transitionDuration: {
				'150': '150ms',
				'300': '300ms',
				'500': '500ms',
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
