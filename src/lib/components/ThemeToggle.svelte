<script lang="ts">
  import { theme, toggleTheme } from '$lib/stores/theme.js';
</script>

<button
  on:click={toggleTheme}
  class="theme-toggle"
  aria-label="Toggle theme"
  title="Toggle dark/light mode"
>
  <div class="toggle-container">
    <!-- Sun icon for light mode -->
    <i class="fa-solid fa-sun sun-icon" class:hidden={$theme === 'light'}></i>
    
    <!-- Moon icon for dark mode -->
    <i class="fa-solid fa-moon moon-icon" class:hidden={$theme === 'dark'}></i>
    
    <!-- Toggle switch -->
    <div class="toggle-switch" class:light={$theme === 'light'}></div>
  </div>
</button>

<style>
  .theme-toggle {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50px;
    padding: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  }

  .theme-toggle:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.05);
  }

  .toggle-container {
    position: relative;
    width: 40px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 4px;
  }

  .sun-icon,
  .moon-icon {
    font-size: 12px;
    color: #fbbf24;
    transition: all 0.3s ease;
    z-index: 2;
  }

  .moon-icon {
    color: #60a5fa;
  }

  .hidden {
    opacity: 0;
    transform: scale(0.8);
  }

  .toggle-switch {
    position: absolute;
    left: 2px;
    width: 16px;
    height: 16px;
    background: linear-gradient(135deg, #4285f4, #9b59b6);
    border-radius: 50%;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  .toggle-switch.light {
    left: 22px;
    background: linear-gradient(135deg, #fbbf24, #f59e0b);
  }

  /* Light theme adjustments */
  :global([data-theme="light"]) .theme-toggle {
    background: rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(0, 0, 0, 0.2);
  }

  :global([data-theme="light"]) .theme-toggle:hover {
    background: rgba(0, 0, 0, 0.2);
  }

  /* Responsive design */
  @media (max-width: 768px) {
    .theme-toggle {
      top: 15px;
      right: 15px;
      padding: 6px;
    }

    .toggle-container {
      width: 36px;
      height: 18px;
    }

    .toggle-switch {
      width: 14px;
      height: 14px;
    }

    .toggle-switch.light {
      left: 20px;
    }
  }
</style>
