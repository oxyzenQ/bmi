<script lang="ts">
  interface Props {
    size?: 'small' | 'medium' | 'large';
    color?: string;
    [key: string]: unknown;
  }

  let { size = 'medium', color = 'white', ...restProps }: Props = $props();

  function toColorVariant(c: string): 'white' | 'blue' | 'green' | 'yellow' | 'red' {
    const v = (c || '').toLowerCase().trim();
    if (v === 'white' || v === '#fff' || v === '#ffffff') return 'white';
    if (v === 'blue' || v === '#60a5fa') return 'blue';
    if (v === 'green' || v === '#10b981') return 'green';
    if (v === 'yellow' || v === '#f59e0b') return 'yellow';
    if (v === 'red' || v === '#ef4444') return 'red';
    return 'white';
  }

  let colorClass = $derived(`color-${toColorVariant(color)}`);
</script>

<div class={`comp-spinner ${size} ${colorClass}`} {...restProps}>
  <div class="spinner"></div>
</div>
