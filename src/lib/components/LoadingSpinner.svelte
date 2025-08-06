<script lang="ts">
  export let size: 'small' | 'medium' | 'large' = 'medium';
  export let color: string = 'currentColor';
</script>

<div class="loading-spinner {size}" style="--spinner-color: {color}">
  <div class="spinner"></div>
</div>

<style>
  .loading-spinner {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .spinner {
    border: 2px solid transparent;
    border-top: 2px solid var(--spinner-color);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .small .spinner {
    width: 16px;
    height: 16px;
  }

  .medium .spinner {
    width: 24px;
    height: 24px;
  }

  .large .spinner {
    width: 32px;
    height: 32px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  /* Respect reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
