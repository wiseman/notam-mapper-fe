<script lang="ts">
	import { page } from '$app/stores';
	import { Avatar, NavBrand, NavHamburger, NavLi, NavUl, Navbar } from 'flowbite-svelte';
	import '../app.pcss';
	import './styles.css';

	$: activeUrl = $page.url.pathname;
</script>

<div class="app">
	<main>
		<slot />
	</main>
</div>

<style lang="postcss">
	:global(html) {
		@apply bg-gray-200; /* Light mode background */
	}
	:global(html.dark) {
		@apply bg-dark-200; /* Dark mode background, adjust the shade as needed */
	}
</style>
