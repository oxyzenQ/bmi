<script lang="ts">
  import { Table, Info, AlertTriangle, CheckCircle, TrendingUp, Activity } from 'lucide-svelte';

  const bmiCategories = [
    {
      category: 'Underweight',
      range: '< 18.5',
      status: 'May increase health risks',
      statusColor: '#60a5fa',
      icon: AlertTriangle,
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
      statusColor: '#f59e0b',
      icon: TrendingUp,
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
      subcategories: [
        { range: '30.0 - 34.9', description: 'Class I obesity' },
        { range: '35.0 - 39.9', description: 'Class II obesity' },
        { range: '≥ 40.0', description: 'Class III obesity' }
      ],
      recommendation: 'Seek medical advice for weight management'
    }
  ];
</script>

<div class="reference-table-card liquid-glass">
  <div class="table-header">
    <div class="header-icon">
      <Table class="w-12 h-12 text-cosmic-blue" />
      <div class="icon-glow"></div>
    </div>
    <h2 class="table-title">BMI Reference Chart</h2>
    <p class="table-subtitle">Understanding BMI categories and ranges for your cosmic health journey.</p>
  </div>

  <div class="table-container">
    <table class="bmi-table">
      <thead>
        <tr>
          <th scope="col" class="table-header-cell">Category</th>
          <th scope="col" class="table-header-cell">BMI Range</th>
          <th scope="col" class="table-header-cell">Health Status</th>
          <th scope="col" class="table-header-cell">Recommended Action</th>
        </tr>
      </thead>
      <tbody>
        {#each bmiCategories as category (category.category)}
          <tr class="table-row">
            <td class="table-cell category-cell">
              <div class="category-info">
                <div class="category-header">
                  <svelte:component this={category.icon} class="category-icon" style="color: {category.statusColor}" />
                  <div class="category-name">{category.category}</div>
                </div>
                <div class="subcategories">
                  {#each category.subcategories as sub (sub.range)}
                    <div class="subcategory">
                      <span class="sub-range">{sub.range}</span>
                      <span class="sub-desc">{sub.description}</span>
                    </div>
                  {/each}
                </div>
              </div>
            </td>
            <td class="table-cell range-cell">
              <span class="range-value">{category.range}</span>
            </td>
            <td class="table-cell status-cell">
              <span class="status-indicator" style="color: {category.statusColor}">
                {category.status}
              </span>
            </td>
            <td class="table-cell action-cell">
              <span class="action-text">{category.recommendation}</span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="table-footer">
    <div class="footer-content">
      <Info class="w-5 h-5 text-cosmic-blue" />
      <p class="footer-note">
        <strong>Note:</strong> BMI is a screening tool and should not be used as a sole diagnostic method. 
        Individual factors like muscle mass, bone density, and overall health should be considered. 
        Always consult healthcare professionals for personalized guidance.
      </p>
    </div>
  </div>
</div>
