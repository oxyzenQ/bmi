<script lang="ts">
  import { FileChartColumn, Info, AlertTriangle, CheckCircle, TrendingUp, Activity } from 'lucide-svelte';
  import { t, localeVersion } from '$lib/i18n';
  let _rv = $derived(localeVersion);

  const bmiCategories = [
    {
      category: t('ref.underweight'),
      range: t('ref.underweight_range'),
      status: t('ref.underweight_status'),
      statusColor: '#60a5fa',
      icon: AlertTriangle,
      iconClass: 'AlertTriangle2',
      subcategories: [
        { range: '< 16.0', description: t('ref.severely_underweight') },
        { range: '16.0 - 16.9', description: t('ref.moderately_underweight') },
        { range: '17.0 - 18.4', description: t('ref.mildly_underweight') }
      ],
      recommendation: t('ref.underweight_action')
    },
    {
      category: t('ref.normal'),
      range: t('ref.normal_range'),
      status: t('ref.normal_status'),
      statusColor: '#10b981',
      icon: CheckCircle,
      iconClass: 'CheckCircle',
      subcategories: [
        { range: '18.5 - 22.9', description: t('ref.lower_normal') },
        { range: '23.0 - 24.9', description: t('ref.upper_normal') }
      ],
      recommendation: t('ref.normal_action')
    },
    {
      category: t('ref.overweight'),
      range: t('ref.overweight_range'),
      status: t('ref.overweight_status'),
      statusColor: '#ffff00',
      icon: TrendingUp,
      iconClass: 'TrendingUp',
      subcategories: [
        { range: '25.0 - 27.4', description: t('ref.pre_obese') },
        { range: '27.5 - 29.9', description: t('ref.overweight_label') }
      ],
      recommendation: t('ref.overweight_action')
    },
    {
      category: t('ref.obese'),
      range: t('ref.obese_range'),
      status: t('ref.obese_status'),
      statusColor: '#ef4444',
      icon: Activity,
      iconClass: 'Activity',
      subcategories: [
        { range: '30.0 - 34.9', description: t('ref.class_i') },
        { range: '35.0 - 39.9', description: t('ref.class_ii') },
        { range: '≥ 40.0', description: t('ref.class_iii') }
      ],
      recommendation: t('ref.obese_action')
    }
  ];
</script>

<div class="bmi-card reference-table">
  <div class="ref-card">
    <div class="header-icon">
      <FileChartColumn class="FileChartColumn" />
    </div>
    <div>
      <div class="title">{t('ref.title')}</div>
      <div class="subtitle">{t('ref.subtitle')}</div>
    </div>
  </div>

  <div class="ref-header">
    <div>{t('ref.col_category')}</div>
    <div>{t('ref.col_range')}</div>
    <div>{t('ref.col_status')}</div>
    <div>{t('ref.col_action')}</div>
  </div>

  <div class="ref-body">
    {#each bmiCategories as category (category.category)}
      {@const Icon = category.icon}
      <div
        class="ref-row"
        class:ref-row-underweight={category.category === t('ref.underweight')}
        class:ref-row-normal={category.category === t('ref.normal')}
        class:ref-row-overweight={category.category === t('ref.overweight')}
        class:ref-row-obese={category.category === t('ref.obese')}
      >
        <div class="ref-col" data-label="Category">
          <div class="icon-col">
            <Icon class={category.iconClass} style={`color: ${category.statusColor}`} />
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

  <div class="ref-card" style="border-top: 1px solid var(--w-8);">
    <Info class="Info2" />
    <p class="subtitle" style="margin: 0;">
      {t('ref.disclaimer')}
    </p>
  </div>
</div>
