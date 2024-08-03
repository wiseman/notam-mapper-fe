const config = {
	content: ['./src/**/*.{html,js,svelte,ts}', './node_modules/flowbite-svelte/**/*.{html,js,svelte,ts}'],

	plugins: [require('flowbite/plugin')],

	darkMode: 'selector',

	theme: {
		fontFamily: {
			sans: ['B612Mono', 'sans-serif'],
			serif: ['B612Mono', 'serif'],
		},
		extend: {
			colors: {
				// flowbite-svelte
				primary: {
					50: '#FFF5F2',
					100: '#FFF1EE',
					200: '#FFE4DE',
					300: '#FFD5CC',
					400: '#FFBCAD',
					500: '#FE795D',
					600: '#EF562F',
					700: '#EB4F27',
					800: '#CC4522',
					900: '#A5371B'
				},
				dark: {
					100: '#1a1a1a',
					200: '#333',
					300: '#4d4d4d',
					400: '#666',
					500: '#808080',
				}
			}
		}
	}
};

module.exports = config;
