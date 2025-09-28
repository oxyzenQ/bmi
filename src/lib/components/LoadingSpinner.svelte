<script lang="ts">
  // Size variants correspond to global classes: .comp-spinner.small|medium|large
  export let size: 'small' | 'medium' | 'large' = 'medium';
  /**
   * Back-compat color prop: accepts semantic names or legacy hex values.
   * Mapped to global classes: .comp-spinner.color-*
   */
  export let color: string = 'white';

  function toColorVariant(c: string): 'white' | 'blue' | 'green' | 'yellow' | 'red' {
    const v = (c || '').toLowerCase().trim();
    if (v === 'white' || v === '#fff' || v === '#ffffff') return 'white';
    if (v === 'blue' || v === '#60a5fa') return 'blue';
    if (v === 'green' || v === '#10b981') return 'green';
    if (v === 'yellow' || v === '#f59e0b') return 'yellow';
    if (v === 'red' || v === '#ef4444') return 'red';
    return 'white';
  }

  $: colorClass = `color-${toColorVariant(color)}`;
</script>

<div class={`comp-spinner ${size} ${colorClass}`} {...$$restProps}>
  <div class="spinner"></div>
</div>
