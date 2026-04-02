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
        color: '#94a3b8',
        bgClass: 'risk-unknown',
        icon: Shield,
        description: 'Calculate your BMI to assess health risk',
        position: 50
      };
    }

    const lowerCat = cat.toLowerCase();

    if (lowerCat.includes('underweight')) {
      return {
        label: 'Moderate Risk',
        color: '#4A90E2',
        bgClass: 'risk-moderate',
        icon: AlertTriangle,
        description: 'May indicate nutritional deficiencies or underlying conditions',
        position: 25
      };
    }

    if (lowerCat.includes('normal')) {
      return {
        label: 'Low Risk',
        color: '#00C853',
        bgClass: 'risk-low',
        icon: Heart,
        description: 'Optimal BMI range associated with lowest health risks',
        position: 50
      };
    }

    if (lowerCat.includes('overweight')) {
      return {
        label: 'Elevated Risk',
        color: '#FFD600',
        bgClass: 'risk-elevated',
        icon: Activity,
        description: 'Increased risk for cardiovascular disease and diabetes',
        position: 75
      };
    }

    // Obese
    return {
      label: 'High Risk',
      color: '#D50000',
      bgClass: 'risk-high',
      icon: AlertTriangle,
      description: 'Significantly increased risk for serious health conditions',
      position: 90
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
    {#if category?.toLowerCase().includes('normal')}
      <ul>
        <li>Maintain your healthy weight with balanced diet</li>
        <li>Regular physical activity (150 min/week)</li>
        <li>Annual health checkups to monitor</li>
      </ul>
    {:else if category?.toLowerCase().includes('underweight')}
      <ul>
        <li>Consult a nutritionist for healthy weight gain</li>
        <li>Focus on nutrient-dense foods</li>
        <li>Rule out underlying medical conditions</li>
      </ul>
    {:else if category?.toLowerCase().includes('overweight') || category?.toLowerCase().includes('obese')}
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
    background: rgba(148, 163, 184, 0.1);
  }

  .risk-segment {
    flex: 1;
    height: 100%;
  }

  .risk-low-seg {
    background: linear-gradient(90deg, #00C853 0%, #00C853 100%);
    opacity: 0.6;
  }

  .risk-moderate-seg {
    background: linear-gradient(90deg, #4A90E2 0%, #4A90E2 100%);
    opacity: 0.6;
  }

  .risk-elevated-seg {
    background: linear-gradient(90deg, #FFD600 0%, #FFD600 100%);
    opacity: 0.6;
  }

  .risk-high-seg {
    background: linear-gradient(90deg, #D50000 0%, #D50000 100%);
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
    background: #00C853;
    box-shadow: 0 0 20px rgba(0, 200, 83, 0.4);
  }

  .risk-marker.risk-moderate {
    background: #4A90E2;
    box-shadow: 0 0 20px rgba(74, 144, 226, 0.4);
  }

  .risk-marker.risk-elevated {
    background: #FFD600;
    box-shadow: 0 0 20px rgba(255, 214, 0, 0.4);
    color: #1a1a2e;
  }

  .risk-marker.risk-high {
    background: #D50000;
    box-shadow: 0 0 20px rgba(213, 0, 0, 0.4);
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
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .risk-result {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.1);
    margin-bottom: 1.5rem;
  }

  .risk-result.risk-low {
    border-color: rgba(0, 200, 83, 0.3);
    background: rgba(0, 200, 83, 0.08);
  }

  .risk-result.risk-moderate {
    border-color: rgba(74, 144, 226, 0.3);
    background: rgba(74, 144, 226, 0.08);
  }

  .risk-result.risk-elevated {
    border-color: rgba(255, 214, 0, 0.3);
    background: rgba(255, 214, 0, 0.08);
  }

  .risk-result.risk-high {
    border-color: rgba(213, 0, 0, 0.3);
    background: rgba(213, 0, 0, 0.08);
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
    color: #94a3b8;
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
    background: rgba(15, 23, 42, 0.4);
    border-radius: 16px;
    border: 1px solid rgba(148, 163, 184, 0.1);
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
    color: #64748b;
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
