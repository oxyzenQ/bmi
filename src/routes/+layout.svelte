<script>
  import '../app.css';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';
  import "@fontsource/inter/latin-400.css";
  import "@fontsource/inter/latin-500.css";
  import "@fontsource/inter/latin-700.css";
</script>

<svelte:head>
  <link rel="icon" href="/favicon.webp" />
</svelte:head>

<ThemeToggle />
<slot />
