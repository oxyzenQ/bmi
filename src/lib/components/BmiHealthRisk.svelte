<script lang="ts">
  import { Shield, AlertTriangle, Activity, Heart } from 'lucide-svelte';
  import { browser } from '$app/environment';
  import { CATEGORY_COLORS, COLORS, classifyBmi, getCategoryColor } from '$lib/utils/bmi-category';
  import { t as _t, localeVersion } from '$lib/i18n';
  let _rv = $derived($localeVersion);
  // Reactive t() — reading _rv creates a dependency so template {t('key')} re-runs on locale change
  function t(key: string, params?: Record<string, string | number | undefined | null>): string { void _rv; return _t(key, params); }

  interface Props {
    bmi?: number | null;
    category?: string | null;
  }

  let { bmi = null, category = null }: Props = $props();

  interface RiskLevel {
    label: string;
    color: string;
    bgClass: string;
    icon: typeof Shield;
    description: string;
    position: number; // 0-100 for meter position
  }

  function getRiskLevel(bmiVal: number | null, cat: string | null): RiskLevel {
    if (bmiVal === null || cat === null) {
      return {
        label: t('risk.unknown'),
        color: COLORS.SLATE,
        bgClass: 'risk-unknown',
        icon: Shield,
        description: t('risk.calc_first'),
        position: 50
      };
    }

    const lowerCat = cat.toLowerCase();

    if (lowerCat === 'underweight') {
      return {
        label: t('risk.moderate_label'),
        color: COLORS.BLUE,
        bgClass: 'risk-moderate',
        icon: AlertTriangle,
        description: t('risk.moderate_desc'),
        position: 25
      };
    }

    if (lowerCat === 'normal weight') {
      return {
        label: t('risk.low_label'),
        color: COLORS.GREEN,
        bgClass: 'risk-low',
        icon: Heart,
        description: t('risk.low_desc'),
        position: ((bmiVal - 18.5) / (24.9 - 18.5)) * 25
      };
    }

    if (lowerCat === 'overweight') {
      return {
        label: t('risk.elevated_label'),
        color: COLORS.YELLOW,
        bgClass: 'risk-elevated',
        icon: Activity,
        description: t('risk.elevated_desc'),
        position: 62.5 + ((bmiVal - 25) / (30 - 25)) * 12.5
      };
    }

    // Obese
    return {
      label: t('risk.high_label'),
      color: COLORS.RED,
      bgClass: 'risk-high',
      icon: AlertTriangle,
      description: t('risk.high_desc'),
      position: 75 + ((bmiVal - 30) / (50 - 30)) * 25
    };
  }

  let risk = $derived(getRiskLevel(bmi, category));
  let Icon = $derived(risk.icon);
</script>
<div class="gauge-container bmi-health-risk">
  <div class="gauge-header">
    <div class="gauge-title">
      <Shield class="Gauge" />
      <h3>{t('risk.title')}</h3>
    </div>
    <div class="gauge-subtitle">{t('risk.subtitle')}</div>
  </div>

  <div class="risk-meter-container">
    <!-- Risk meter track -->
    <div class="risk-meter-track">
      <div class="risk-segment risk-low-seg"></div>
      <div class="risk-segment risk-moderate-seg"></div>
      <div class="risk-segment risk-elevated-seg"></div>
      <div class="risk-segment risk-high-seg"></div>
    </div>

    <!-- Risk indicator -->
    <div class="risk-indicator" style="left: {risk.position}%">
      <div class="risk-marker {risk.bgClass}">
        <Icon size={20} />
      </div>
      <div class="risk-arrow"></div>
    </div>

    <!-- Risk labels -->
    <div class="risk-labels">
      <span class="risk-label">{t('risk.low')}</span>
      <span class="risk-label">{t('risk.moderate')}</span>
      <span class="risk-label">{t('risk.elevated')}</span>
      <span class="risk-label">{t('risk.high')}</span>
    </div>
  </div>

  <!-- Risk result card -->
  <div class="risk-result {risk.bgClass}">
    <div class="risk-icon">
      <Icon size={28} />
    </div>
    <div class="risk-info">
      <div class="risk-level" style="color: {risk.color}">{risk.label}</div>
      <div class="risk-description">{risk.description}</div>
    </div>
    {#if bmi !== null}
      <div class="risk-bmi">{t('gauge.bmi')} {bmi.toFixed(2)}</div>
    {/if}
  </div>

  <!-- Health tips -->
  <div class="health-tips">
    <h4>{t('risk.recommendations')}</h4>
    {#if category?.toLowerCase() === 'normal weight'}
      <ul>
        <li>{t('risk.rec_normal_1')}</li>
        <li>{t('risk.rec_normal_2')}</li>
        <li>{t('risk.rec_normal_3')}</li>
      </ul>
    {:else if category?.toLowerCase() === 'underweight'}
      <ul>
        <li>{t('risk.rec_under_1')}</li>
        <li>{t('risk.rec_under_2')}</li>
        <li>{t('risk.rec_under_3')}</li>
      </ul>
    {:else if category?.toLowerCase() === 'overweight' || category?.toLowerCase() === 'obese'}
      <ul>
        <li>{t('risk.rec_over_1')}</li>
        <li>{t('risk.rec_over_2')}</li>
        <li>{t('risk.rec_over_3')}</li>
      </ul>
    {:else}
      <div class="empty-health-risk">
        <Shield size={28} style="opacity:0.3; margin-bottom:0.5rem" />
        <p class="no-data">{t('risk.empty')}</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .bmi-health-risk {
    padding-top: 20px !important;
  }

  .risk-meter-container {
    margin: 2rem 0;
    position: relative;
  }

  .risk-meter-track {
    display: flex;
    height: 12px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--sg-10);
  }

  .risk-segment {
    flex: 1;
    height: 100%;
  }

  .risk-low-seg {
    background: var(--cat-green-50);
    opacity: 0.6;
  }

  .risk-moderate-seg {
    background: var(--cat-blue-50);
    opacity: 0.6;
  }

  .risk-elevated-seg {
    background: var(--cat-amber-50);
    opacity: 0.6;
  }

  .risk-high-seg {
    background: var(--cat-red-50);
    opacity: 0.6;
  }

  .risk-indicator {
    position: absolute;
    top: -14px;
    transform: translateX(-50%);
    transition: left 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .risk-marker {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 4px 12px var(--k-30);
    animation: pulse 2s ease-in-out infinite;
  }

  .risk-marker.risk-low {
    background: var(--cat-green-90);
    box-shadow: 0 0 20px var(--cat-green-40);
  }

  .risk-marker.risk-moderate {
    background: var(--cat-blue-90);
    box-shadow: 0 0 20px var(--cat-blue-40);
  }

  .risk-marker.risk-elevated {
    background: var(--cat-amber-90);
    box-shadow: 0 0 20px var(--cat-yellow-40);
    color: #1a1a2e;
  }

  .risk-marker.risk-high {
    background: var(--cat-red-90);
    box-shadow: 0 0 20px var(--cat-red-40);
  }

  .risk-marker.risk-unknown {
    background: #64748b;
  }

  .risk-arrow {
    width: 0;
    height: 0;
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    border-top: 8px solid currentColor;
    margin-top: 4px;
    color: inherit;
  }

  .risk-labels {
    display: flex;
    justify-content: space-between;
    margin-top: 0.75rem;
    padding: 0 4px;
  }

  .risk-label {
    font-size: 0.75rem;
    color: var(--cat-slate-50, #94a3b8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .risk-result {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    border-radius: 16px;
    background: var(--sd-60);
    border: 1px solid var(--sg-10);
    margin-bottom: 1.5rem;
  }

  .risk-result.risk-low {
    border-color: var(--cat-green-30);
    background: var(--cat-green-8);
  }

  .risk-result.risk-moderate {
    border-color: var(--cat-blue-30);
    background: var(--cat-blue-8);
  }

  .risk-result.risk-elevated {
    border-color: var(--cat-yellow-30);
    background: var(--cat-yellow-8);
  }

  .risk-result.risk-high {
    border-color: var(--cat-red-30);
    background: var(--cat-red-8);
  }

  .risk-icon {
    flex-shrink: 0;
  }

  .risk-info {
    flex: 1;
  }

  .risk-level {
    font-size: 1.125rem;
    font-weight: 700;
    margin-bottom: 0.25rem;
  }

  .risk-description {
    font-size: 0.875rem;
    color: var(--cat-slate-50, #94a3b8);
    line-height: 1.4;
  }

  .risk-bmi {
    font-size: 1.5rem;
    font-weight: 700;
    color: white;
    text-align: right;
  }

  .health-tips {
    padding: 1.25rem;
    background: var(--sd-40);
    border-radius: 16px;
    border: 1px solid var(--sg-10);
  }

  .health-tips h4 {
    margin: 0 0 1rem;
    font-size: 1rem;
    color: #f8fafc;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .health-tips ul {
    margin: 0;
    padding-left: 1.25rem;
    color: #94a3b8;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .health-tips li {
    margin-bottom: 0.5rem;
  }

  .health-tips li:last-child {
    margin-bottom: 0;
  }

  .no-data {
    margin: 0;
    color: var(--cat-slate-50, #94a3b8);
    font-size: 0.875rem;
    font-style: italic;
  }

  .empty-health-risk {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    text-align: center;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .risk-marker {
      animation: none !important;
    }
  }

  @media (max-width: 640px) {
    .risk-result {
      flex-direction: column;
      text-align: center;
      gap: 0.75rem;
    }

    .risk-bmi {
      text-align: center;
    }

    .risk-label {
      font-size: 0.625rem;
    }
  }
</style>
