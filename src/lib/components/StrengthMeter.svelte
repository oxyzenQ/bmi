<script lang="ts">
  import type { StrengthResult } from '$lib/utils/crypto';
  import { t as _t, localeVersion } from '$lib/i18n';
  import { formatCrackTime } from '$lib/utils/crack-time';

  let {
    score = 0,
    result = null,
    visible = false
  }: {
    score: number;
    result: StrengthResult | null;
    visible: boolean;
  } = $props();

  let _rv = $derived($localeVersion);
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  let strengthLevel = $derived(
    score <= 0 ? 'weak' :
    score === 1 ? 'fair' :
    score === 2 ? 'medium' :
    score === 3 ? 'strong' : 'very_strong'
  );

  let strengthPercent = $derived(
    score === 0 ? 0 : score === 1 ? 25 : score === 2 ? 50 : score === 3 ? 75 : 100
  );

  let strengthColor = $derived(
    score <= 0 ? 'var(--red-500-solid)' :
    score === 1 ? 'var(--cat-orange-solid)' :
    score === 2 ? 'var(--warn-amber)' :
    score === 3 ? 'var(--cat-green-solid)' : 'var(--emerald-solid)'
  );

  let strengthLabel = $derived(
    strengthLevel === 'weak' ? t('crypto.strength_weak') :
    strengthLevel === 'fair' ? t('crypto.strength_fair') :
    strengthLevel === 'medium' ? t('crypto.strength_medium') :
    strengthLevel === 'strong' ? t('crypto.strength_strong') :
    t('crypto.strength_very_strong')
  );

  let strengthFeedback = $derived(() => {
    if (!result || score === 0) return '';
    const parts: string[] = [];
    if (result.crackTimeSeconds > 0) {
      const timeStr = formatCrackTime(result.crackTimeSeconds, t);
      parts.push(t('crypto.crack_time', { t: timeStr }));
    }
    if (result.warning) {
      parts.push(result.warning);
    }
    if (result.suggestions.length > 0) {
      parts.push(result.suggestions[0]);
    }
    return parts.slice(0, 2).join('. ');
  });
</script>

{#if visible}
  <div class="strength-bar-wrap">
    <div class="strength-bar">
      <div class="strength-fill" style="width: {strengthPercent}%; background: {strengthColor};"></div>
    </div>
    <span class="strength-label" style="color: {strengthColor};">
      {strengthLabel}
    </span>
  </div>
  {#if strengthFeedback()}
    <p class="strength-feedback">{strengthFeedback()}</p>
  {/if}
  <p class="strength-hint">{t('crypto.strength_hint')}</p>
{/if}

<style>
  .strength-bar-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .strength-bar {
    flex: 1;
    height: 4px;
    background: var(--w-15);
    border-radius: 2px;
    overflow: hidden;
  }

  .strength-fill {
    height: 100%;
    border-radius: 2px;
    transition: width var(--dur-content) ease, background var(--dur-content) ease;
  }

  .strength-label {
    font-size: var(--text-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }

  .strength-feedback {
    font-size: var(--text-sm);
    color: var(--w-60);
    margin-top: 0.35rem;
    line-height: 1.4;
    font-weight: 400;
  }

  .strength-hint {
    font-size: 0.8rem;
    color: var(--w-60);
    margin-top: 0.5rem;
    line-height: 1.5;
    font-weight: 400;
  }
</style>
