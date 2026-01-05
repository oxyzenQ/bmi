<script lang="ts">
  import { FileChartColumn, Info, AlertTriangle, CheckCircle, TrendingUp, Activity } from 'lucide-svelte';

  const bmiCategories = [
    {
      category: 'Underweight',
      range: '< 18.5',
      status: 'May increase health risks',
      statusColor: '#60a5fa',
      icon: AlertTriangle,
      iconClass: 'AlertTriangle2',
      subcategories: [
        { range: '< 16.0', description: 'Severely underweight' },
        { range: '16.0 - 16.9', description: 'Moderately underweight' },
        { range: '17.0 - 18.4', description: 'Mildly underweight' }
      ],
      recommendation: 'Increase caloric intake & consult nutritionist'
    },
    {
      category: 'Normal Weight',
      range: '18.5 - 24.9',
      status: 'Optimal health range',
      statusColor: '#10b981',
      icon: CheckCircle,
      iconClass: 'CheckCircle',
      subcategories: [
        { range: '18.5 - 22.9', description: 'Lower normal range' },
        { range: '23.0 - 24.9', description: 'Upper normal range' }
      ],
      recommendation: 'Continue balanced diet & maintain activity'
    },
    {
      category: 'Overweight',
      range: '25.0 - 29.9',
      status: 'Increased health risks',
      statusColor: '#ffff00',
      icon: TrendingUp,
      iconClass: 'TrendingUp',
      subcategories: [
        { range: '25.0 - 27.4', description: 'Pre-obese' },
        { range: '27.5 - 29.9', description: 'Overweight' }
      ],
      recommendation: 'Reduce caloric intake, start moderate exercise'
    },
    {
      category: 'Obese',
      range: '≥ 30.0',
      status: 'High health risks',
      statusColor: '#ef4444',
      icon: Activity,
      iconClass: 'Activity',
      subcategories: [
        { range: '30.0 - 34.9', description: 'Class I obesity' },
        { range: '35.0 - 39.9', description: 'Class II obesity' },
        { range: '≥ 40.0', description: 'Class III obesity' }
      ],
      recommendation: 'Seek medical advice for weight management'
    }
  ];
</script>

<div class="bmi-card reference-table">
  <div class="ref-card">
    <div class="header-icon">
      <FileChartColumn class="FileChartColumn" />
    </div>
    <div>
      <div class="title">BMI Reference Chart</div>
      <div class="subtitle">Understanding BMI categories and ranges for your cosmic health journey.</div>
    </div>
  </div>

  <div class="ref-header">
    <div>Category</div>
    <div>BMI Range</div>
    <div>Health Status</div>
    <div>Recommended Action</div>
  </div>

  <div class="ref-body">
    {#each bmiCategories as category (category.category)}
      <div
        class="ref-row"
        class:ref-row-underweight={category.category === 'Underweight'}
        class:ref-row-normal={category.category === 'Normal Weight'}
        class:ref-row-overweight={category.category === 'Overweight'}
        class:ref-row-obese={category.category === 'Obese'}
      >
        <div class="ref-col" data-label="Category">
          <div class="icon-col">
            <svelte:component this={category.icon} class={category.iconClass} style={`color: ${category.statusColor}`} />
            <strong>{category.category}</strong>
          </div>
          <div class="muted" style="margin-top: 0.35rem;">
            {#each category.subcategories as sub (sub.range)}
              <div>
                <span class="muted">{sub.range}</span>
                <span> — {sub.description}</span>
              </div>
            {/each}
          </div>
        </div>
        <div class="ref-col" data-label="BMI Range">
          <strong>{category.range}</strong>
        </div>
        <div class="ref-col" data-label="Health Status">
          <span class="status-text" style={`color: ${category.statusColor}`}>{category.status}</span>
        </div>
        <div class="ref-col" data-label="Recommended Action">
          <span>{category.recommendation}</span>
        </div>
      </div>
    {/each}
  </div>

  <div class="ref-card" style="border-top: 1px solid rgba(255,255,255,0.08);">
    <Info class="Info2" />
    <p class="subtitle" style="margin: 0;">
      <strong>Note:</strong> BMI is a screening tool and should not be used as a sole diagnostic method.
      Individual factors like muscle mass, bone density, and overall health should be considered.
      Always consult healthcare professionals for personalized guidance.
    </p>
  </div>
</div>
