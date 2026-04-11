<script lang="ts">
  import { Shield, AlertTriangle, Activity, Heart } from 'lucide-svelte';

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
        label: 'Unknown',
        color: 'var(--text-label)',
        bgClass: 'risk-unknown',
        icon: Shield,
        description: 'Calculate your BMI to assess health risk',
        position: 50
      };
    }

    const lowerCat = cat.toLowerCase();

    if (lowerCat === 'underweight') {
      return {
        label: 'Moderate Risk',
        color: 'var(--cat-underweight)',
        bgClass: 'risk-moderate',
        icon: AlertTriangle,
        description: 'May indicate nutritional deficiencies or underlying conditions',
        position: 25
      };
    }

    if (lowerCat === 'normal weight') {
      return {
        label: 'Low Risk',
        color: '#a78bfa',
        bgClass: 'risk-low',
        icon: Heart,
        description: 'Optimal BMI range associated with lowest health risks',
        position: ((bmiVal - 18.5) / (24.9 - 18.5)) * 25
      };
    }

    if (lowerCat === 'overweight') {
      return {
        label: 'Elevated Risk',
        color: 'var(--cat-overweight)',
        bgClass: 'risk-elevated',
        icon: Activity,
        description: 'Increased risk for cardiovascular disease and diabetes',
        position: 62.5 + ((bmiVal - 25) / (30 - 25)) * 12.5
      };
    }

    // Obese
    return {
      label: 'High Risk',
      color: 'var(--cat-obese)',
      bgClass: 'risk-high',
      icon: AlertTriangle,
      description: 'Significantly increased risk for serious health conditions',
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
      <h3>Health Risk Assessment</h3>
    </div>
    <div class="gauge-subtitle">Understand your BMI-related health risks</div>
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
      <span class="risk-label">Low</span>
      <span class="risk-label">Moderate</span>
      <span class="risk-label">Elevated</span>
      <span class="risk-label">High</span>
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
      <div class="risk-bmi">BMI {bmi.toFixed(2)}</div>
    {/if}
  </div>

  <!-- Health tips -->
  <div class="health-tips">
    <h4>Recommendations</h4>
    {#if category?.toLowerCase() === 'normal weight'}
      <ul>
        <li>Maintain your healthy weight with balanced diet</li>
        <li>Regular physical activity (150 min/week)</li>
        <li>Annual health checkups to monitor</li>
      </ul>
    {:else if category?.toLowerCase() === 'underweight'}
      <ul>
        <li>Consult a nutritionist for healthy weight gain</li>
        <li>Focus on nutrient-dense foods</li>
        <li>Rule out underlying medical conditions</li>
      </ul>
    {:else if category?.toLowerCase() === 'overweight' || category?.toLowerCase() === 'obese'}
      <ul>
        <li>Aim for gradual weight loss (0.5-1kg/week)</li>
        <li>Increase daily physical activity</li>
        <li>Consult healthcare provider for personalized plan</li>
      </ul>
    {:else}
      <p class="no-data">Enter your measurements to see personalized recommendations</p>
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
    background: var(--border-slate);
  }

  .risk-segment {
    flex: 1;
    height: 100%;
  }

  .risk-low-seg {
    background: var(--accent);
    opacity: 0.6;
  }

  .risk-moderate-seg {
    background: var(--cat-underweight);
    opacity: 0.6;
  }

  .risk-elevated-seg {
    background: var(--cat-overweight);
    opacity: 0.6;
  }

  .risk-high-seg {
    background: var(--cat-obese);
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
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: pulse 2s ease-in-out infinite;
  }

  .risk-marker.risk-low {
    background: var(--accent);
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
  }

  .risk-marker.risk-moderate {
    background: var(--cat-underweight);
    box-shadow: 0 0 20px rgba(96, 165, 250, 0.4);
  }

  .risk-marker.risk-elevated {
    background: var(--cat-overweight);
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.4);
    color: #1a1a2e;
  }

  .risk-marker.risk-high {
    background: var(--cat-obese);
    box-shadow: 0 0 20px rgba(248, 113, 113, 0.4);
  }

  .risk-marker.risk-unknown {
    background: var(--text-slate);
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
    color: var(--text-slate);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .risk-result {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    border-radius: var(--radius-lg);
    background: var(--surface-raised);
    border: 1px solid var(--border-slate);
    margin-bottom: 1.5rem;
  }

  .risk-result.risk-low {
    border-color: var(--cat-underweight-tint);
    background: rgba(139, 92, 246, 0.08);
  }

  .risk-result.risk-moderate {
    border-color: var(--cat-underweight-tint);
    background: rgba(96, 165, 250, 0.08);
  }

  .risk-result.risk-elevated {
    border-color: var(--cat-overweight-tint);
    background: rgba(251, 191, 36, 0.08);
  }

  .risk-result.risk-high {
    border-color: var(--cat-obese-tint);
    background: rgba(248, 113, 113, 0.08);
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
    color: var(--text-label);
    line-height: 1.4;
  }

  .risk-bmi {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    text-align: right;
  }

  .health-tips {
    padding: 1.25rem;
    background: var(--surface-subtle);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-slate);
  }

  .health-tips h4 {
    margin: 0 0 1rem;
    font-size: 1rem;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .health-tips ul {
    margin: 0;
    padding-left: 1.25rem;
    color: var(--text-label);
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
    color: var(--text-slate);
    font-size: 0.875rem;
    font-style: italic;
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
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
