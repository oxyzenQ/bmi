<script>
  import '../app.css';
  import "@fontsource/inter/latin-400.css";
  import "@fontsource/inter/latin-500.css";
  import "@fontsource/inter/latin-700.css";
  import CosmicParticles from '$lib/components/CosmicParticles.svelte';
</script>

<svelte:head>
  <link rel="icon" href="/favicon.webp" />
</svelte:head>

<CosmicParticles />

<slot />
