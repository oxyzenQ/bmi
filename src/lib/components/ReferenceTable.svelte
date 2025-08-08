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
        {#each bmiCategories as category}
          <tr class="table-row">
            <td class="table-cell category-cell">
              <div class="category-info">
                <div class="category-header">
                  <svelte:component this={category.icon} class="category-icon" style="color: {category.statusColor}" />
                  <div class="category-name">{category.category}</div>
                </div>
                <div class="subcategories">
                  {#each category.subcategories as sub}
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

<style>
  .reference-table-card {
    padding: 2.5rem;
    border-radius: 1.5rem;
    position: relative;
    overflow: hidden;
    margin: 3rem 0;
  }

  .reference-table-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, 
      rgba(96, 165, 250, 0.05), 
      rgba(168, 85, 247, 0.05)
    );
    border-radius: inherit;
    z-index: -1;
  }

  .table-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .header-icon {
    position: relative;
    display: inline-block;
    margin-bottom: 1rem;
  }

  .icon-glow {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 60px;
    height: 60px;
    background: radial-gradient(circle, rgba(96, 165, 250, 0.2), transparent);
    border-radius: 50%;
    filter: blur(15px);
    animation: iconGlow 3s ease-in-out infinite alternate;
  }

  @keyframes iconGlow {
    0% {
      opacity: 0.3;
      transform: translate(-50%, -50%) scale(1);
    }
    100% {
      opacity: 0.6;
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  .table-title {
    font-size: 1.75rem;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 0.75rem;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .table-subtitle {
    color: #9ca3af;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .table-container {
    overflow-x: auto;
    margin-bottom: 2rem;
    border-radius: 1rem;
    background: rgba(15, 23, 42, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .bmi-table {
    width: 100%;
    border-collapse: collapse;
    border-radius: 1rem;
    overflow: hidden;
  }

  .table-header-cell {
    background: rgba(30, 41, 59, 0.8);
    color: #ffffff;
    font-weight: 600;
    padding: 1.25rem 1rem;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .table-row {
    transition: all 0.3s ease;
  }

  .table-row:hover {
    background: rgba(255, 255, 255, 0.05);
    transform: translateX(4px);
  }

  .table-cell {
    padding: 1.25rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    color: #e5e7eb;
    font-size: 0.875rem;
    vertical-align: top;
  }

  .table-row:last-child .table-cell {
    border-bottom: none;
  }

  .category-info {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .category-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .category-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .category-name {
    font-weight: 600;
    color: #ffffff;
    font-size: 1rem;
  }

  .subcategories {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .subcategory {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 0.375rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .sub-range {
    color: #9ca3af;
    font-family: 'Courier New', monospace;
    min-width: 70px;
    font-weight: 500;
  }

  .sub-desc {
    color: #d1d5db;
  }

  .range-cell {
    text-align: center;
  }

  .range-value {
    font-family: 'Courier New', monospace;
    color: #d1d5db;
    font-weight: 600;
    font-size: 1rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .status-cell {
    text-align: left;
  }

  .status-indicator {
    font-weight: 500;
    font-size: 0.85rem;
    padding: 0.375rem 0.75rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .action-cell {
    text-align: left;
  }

  .action-text {
    color: #d1d5db;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .table-footer {
    background: rgba(15, 23, 42, 0.4);
    border-radius: 1rem;
    padding: 1.75rem;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .footer-content {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .footer-note {
    color: #9ca3af;
    font-size: 0.85rem;
    line-height: 1.6;
    margin: 0;
    flex: 1;
  }

  @media (max-width: 768px) {
    .reference-table-card {
      padding: 2rem 1.5rem;
      margin: 2rem 0;
    }

    .table-header-cell,
    .table-cell {
      padding: 1rem 0.75rem;
      font-size: 0.8rem;
    }

    .table-title {
      font-size: 1.5rem;
    }

    .category-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .subcategory {
      flex-direction: column;
      gap: 0.25rem;
    }

    .sub-range {
      min-width: auto;
    }

    .footer-content {
      flex-direction: column;
      gap: 0.75rem;
      text-align: center;
    }
  }

  @media (max-width: 480px) {
    .reference-table-card {
      padding: 1.5rem 1rem;
    }

    .table-title {
      font-size: 1.25rem;
    }

    .table-header-cell,
    .table-cell {
      padding: 0.75rem 0.5rem;
    }
  }

  /* Reduce motion for users who prefer it */
  @media (prefers-reduced-motion: reduce) {
    .icon-glow {
      animation: none;
    }

    .table-row:hover {
      transform: none;
    }
  }
</style>
