<script lang="ts">
  import { browser } from '$app/environment';
  import { Target, Plus, Pencil, Trash2, Trophy } from 'lucide-svelte';
  import { t, localeVersion } from '$lib/i18n';
  import { STORAGE_KEYS, storageGet, storageSet, storageRemove } from '$lib/utils/storage';

  let _rv = $derived(localeVersion);

  interface Props {
    currentBmi: number | null;
  }

  let { currentBmi }: Props = $props();

  let goalBmi = $state<number | null>(null);
  let editMode = $state(false);
  let inputValue = $state('');

  const BMI_IDEAL_MIN = 18.5;
  const BMI_IDEAL_MAX = 24.9;
  const BMI_LIMIT_MIN = 10;
  const BMI_LIMIT_MAX = 50;

  function loadGoal(): void {
    if (!browser) return;
    const stored = storageGet(STORAGE_KEYS.BMI_GOAL);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= BMI_LIMIT_MIN && parsed <= BMI_LIMIT_MAX) {
        goalBmi = parsed;
        inputValue = String(parsed);
        return;
      }
    }
    goalBmi = null;
    inputValue = '';
  }

  function saveGoal(value: number): void {
    if (!browser) return;
    goalBmi = value;
    inputValue = String(value);
    storageSet(STORAGE_KEYS.BMI_GOAL, String(value));
    editMode = false;
  }

  function removeGoal(): void {
    if (!browser) return;
    goalBmi = null;
    inputValue = '';
    storageRemove(STORAGE_KEYS.BMI_GOAL);
    editMode = false;
  }

  function handleSetGoal(): void {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val < BMI_LIMIT_MIN || val > BMI_LIMIT_MAX) return;
    saveGoal(val);
  }

  function handleUpdateGoal(): void {
    if (!inputValue) {
      editMode = false;
      return;
    }
    handleSetGoal();
  }

  function handleInputChange(e: Event): void {
    const target = e.currentTarget as HTMLInputElement;
    let v = target.value.replace(/[^0-9.]/g, '');
    const firstDot = v.indexOf('.');
    if (firstDot !== -1) {
      v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
    }
    inputValue = v.slice(0, 5);
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      if (editMode) handleUpdateGoal();
      else handleSetGoal();
    }
    if (e.key === 'Escape') {
      editMode = false;
      if (!goalBmi) inputValue = '';
      else inputValue = String(goalBmi);
    }
  }

  let hasGoal = $derived(goalBmi !== null);
  let hasBmi = $derived(currentBmi !== null && currentBmi > 0);
  let diff = $derived(
    hasGoal && hasBmi ? Math.abs((currentBmi ?? 0) - (goalBmi ?? 0)) : null
  );
  let isAchieved = $derived(
    hasGoal && hasBmi && diff !== null && diff <= 0.5
  );
  let needToLose = $derived(
    hasGoal && hasBmi && (currentBmi ?? 0) > (goalBmi ?? 0)
  );
  let progressPercent = $derived(() => {
    if (!hasGoal || !hasBmi || goalBmi === null || currentBmi === null) return 0;
    if (isAchieved) return 100;
    const startRange = 40; // Max possible distance
    const clamped = Math.min(diff ?? 0, startRange);
    return Math.max(0, Math.min(100, Math.round((1 - clamped / startRange) * 100)));
  });
  let progressColor = $derived(() => {
    if (isAchieved) return 'var(--green-50)';
    const p = progressPercent();
    if (p >= 70) return 'var(--green-50)';
    if (p >= 40) return 'var(--yellow-50)';
    return 'var(--red-50)';
  });

  loadGoal();
</script>

<div class="goal-tracker">
  <div class="goal-header">
    <div class="goal-icon-wrap">
      <Target size={18} aria-hidden="true" />
      <div class="icon-glow"></div>
    </div>
    <div>
      <h3>{t('goal.title')}</h3>
      <p class="goal-subtitle">{t('goal.subtitle')}</p>
    </div>
  </div>

  {#if hasGoal}
    <!-- Goal Display -->
    <div class="goal-content">
      {#if isAchieved}
        <div class="goal-achieved">
          <Trophy size={20} aria-hidden="true" />
          <span>{t('goal.achieved')}</span>
        </div>
      {/if}

      <div class="goal-stats">
        <div class="goal-stat">
          <span class="stat-label">{t('goal.current_bmi')}</span>
          <span class="stat-value">{hasBmi ? currentBmi?.toFixed(1) : '—'}</span>
        </div>
        <div class="goal-stat">
          <span class="stat-label">{t('goal.target_bmi')}</span>
          <span class="stat-value goal-target">{goalBmi?.toFixed(1)}</span>
        </div>
        {#if diff !== null}
          <div class="goal-stat">
            <span class="stat-label">{t('goal.remaining')}</span>
            <span class="stat-value">{diff.toFixed(1)}</span>
          </div>
        {/if}
      </div>

      {#if !isAchieved && diff !== null}
        <div class="goal-progress">
          <div class="progress-header">
            <span>{t('goal.progress')}</span>
            <span>{progressPercent()}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              style="width: {progressPercent()}%; background: {progressColor()};"
            ></div>
          </div>
          <p class="goal-insight">
            {#if needToLose}
              {t('snapshot.need_lose', { n: diff.toFixed(1) })}
            {:else}
              {t('snapshot.need_gain', { n: diff.toFixed(1) })}
            {/if}
          </p>
        </div>
      {/if}

      <div class="goal-actions">
        <button type="button" class="btn btn-secondary" onclick={() => { editMode = true; inputValue = String(goalBmi); }}>
          <Pencil size={14} aria-hidden="true" />
          {t('goal.update_goal')}
        </button>
        <button type="button" class="btn btn-danger" onclick={removeGoal}>
          <Trash2 size={14} aria-hidden="true" />
          {t('goal.remove_goal')}
        </button>
      </div>

      {#if editMode}
        <div class="goal-edit">
          <label for="goal-input" class="input-label">
            <Target size={14} />
            {t('goal.target_bmi')}
          </label>
          <div class="goal-input-row">
            <input
              type="text"
              id="goal-input"
              bind:value={inputValue}
              class="form-input"
              inputmode="decimal"
              placeholder="18.5 - 24.9"
              oninput={handleInputChange}
              onkeydown={handleKeydown}
            />
            <button type="button" class="btn btn-primary" onclick={handleUpdateGoal}>
              {t('goal.update_goal')}
            </button>
          </div>
          <p class="goal-hint">{t('goal.enter_target')}</p>
        </div>
      {/if}
    </div>
  {:else if hasBmi}
    <!-- No goal yet, but BMI calculated -->
    <div class="goal-content">
      <p class="goal-empty">{t('goal.no_goal')}</p>
      <div class="goal-set">
        <label for="goal-input-new" class="input-label">
          <Target size={14} />
          {t('goal.target_bmi')}
        </label>
        <div class="goal-input-row">
          <input
            type="text"
            id="goal-input-new"
            bind:value={inputValue}
            class="form-input"
            inputmode="decimal"
            placeholder="18.5 - 24.9"
            oninput={handleInputChange}
            onkeydown={handleKeydown}
          />
          <button type="button" class="btn btn-primary" onclick={handleSetGoal} disabled={!inputValue}>
            <Plus size={14} aria-hidden="true" />
            {t('goal.set_goal')}
          </button>
        </div>
        <p class="goal-hint">{t('goal.enter_target')}</p>
      </div>
    </div>
  {:else}
    <!-- No BMI yet -->
    <div class="goal-content">
      <p class="goal-empty">{t('goal.set_first')}</p>
    </div>
  {/if}
</div>

<style>
  .goal-tracker {
    background: var(--sd-55);
    border: 1px solid var(--w-8);
    border-radius: 1rem;
    padding: 1.25rem;
    backdrop-filter: blur(12px);
  }

  .goal-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .goal-icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--cosmic-purple), #8b5cf6);
    color: white;
    flex-shrink: 0;
  }

  .icon-glow {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: var(--cosmic-purple);
    opacity: 0.25;
    filter: blur(6px);
    z-index: -1;
  }

  .goal-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--w-90);
  }

  .goal-subtitle {
    margin: 0.15rem 0 0;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .goal-content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .goal-achieved {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 0.8rem;
    border-radius: 0.6rem;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.2);
    color: var(--green-40);
    font-size: 0.85rem;
    font-weight: 600;
  }

  .goal-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .goal-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    padding: 0.5rem;
    border-radius: 0.6rem;
    background: var(--sd-65);
  }

  .stat-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: 1.1rem;
    font-weight: 700;
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    color: var(--w-90);
  }

  .goal-target {
    color: var(--cosmic-purple);
  }

  .goal-progress {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-muted);
  }

  .progress-header span:last-child {
    font-weight: 600;
    color: var(--w-80);
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
  }

  .progress-bar {
    height: 6px;
    border-radius: 9999px;
    background: var(--sd-75);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s;
  }

  .goal-insight {
    margin: 0;
    font-size: 0.78rem;
    color: var(--w-60);
    text-align: center;
  }

  .goal-actions {
    display: flex;
    gap: 0.5rem;
  }

  .goal-actions .btn {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.78rem;
    border-radius: 9999px;
    padding: 0.35rem 0.7rem;
  }

  .goal-empty {
    margin: 0;
    font-size: 0.82rem;
    color: var(--text-muted);
    text-align: center;
    padding: 0.5rem 0;
  }

  .goal-set {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .input-label {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--w-70);
  }

  .goal-input-row {
    display: flex;
    gap: 0.5rem;
  }

  .goal-input-row .form-input {
    flex: 1;
    max-width: 120px;
    text-align: center;
    font-family: 'JetBrains Mono Variable', ui-monospace, monospace;
    font-size: 0.95rem;
  }

  .goal-input-row .btn {
    font-size: 0.78rem;
    border-radius: 9999px;
    padding: 0.4rem 0.8rem;
  }

  .goal-hint {
    margin: 0;
    font-size: 0.68rem;
    color: var(--text-muted);
    text-align: center;
    opacity: 0.7;
  }

  .goal-edit {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding: 0.75rem;
    border: 1px solid var(--w-8);
    border-radius: 0.75rem;
    background: var(--sd-65);
  }
</style>
