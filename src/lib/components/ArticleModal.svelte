<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { X, Calendar, Clock, User } from 'lucide-svelte';

  export let isOpen = false;
  export let title = '';
  export let content = '';
  
  let scrollProgress = 0;
  let modalBodyEl: HTMLElement;

  const dispatch = createEventDispatcher();

  function closeModal() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeModal();
    }
  }

  function handleOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      closeModal();
    }
  }

  function updateScrollProgress() {
    if (!modalBodyEl) return;
    const scrollTop = modalBodyEl.scrollTop;
    const scrollHeight = modalBodyEl.scrollHeight - modalBodyEl.clientHeight;
    scrollProgress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });

  // Sample article content
  const articleContents = {
    'Healthy Living Tips': {
      title: 'Healthy Living Tips for Optimal Wellness',
      author: 'Dr. Sarah Johnson',
      date: 'January 15, 2025',
      readTime: '5 min read',
      content: `
        <h3>Introduction to Healthy Living</h3>
        <p>Maintaining a healthy lifestyle is essential for overall well-being and longevity. In today's fast-paced world, it's more important than ever to prioritize our health through balanced nutrition, regular exercise, and mindful living practices.</p>
        
        <h3>Nutrition Fundamentals</h3>
        <p>A balanced diet rich in whole foods, lean proteins, and essential nutrients forms the foundation of good health. Focus on incorporating colorful fruits and vegetables, whole grains, and healthy fats into your daily meals.</p>
        
        <h3>Exercise Guidelines</h3>
        <p>Regular physical activity, including both cardiovascular exercise and strength training, helps maintain a healthy weight, improves mood, and reduces the risk of chronic diseases. Aim for at least 150 minutes of moderate exercise per week.</p>
        
        <h3>Mental Wellness</h3>
        <p>Mental health is equally important as physical health. Practice stress management techniques, maintain social connections, and prioritize adequate sleep for optimal mental well-being.</p>
        
        <h3>Lifestyle Habits</h3>
        <p>Small daily habits can have a significant impact on your health. Stay hydrated, limit processed foods, practice portion control, and maintain regular sleep patterns for better overall health outcomes.</p>
      `
    },
    'Exercise Guidelines': {
      title: 'Exercise Guidelines for Different Fitness Levels',
      author: 'Mike Chen, Certified Personal Trainer',
      date: 'January 12, 2025',
      readTime: '7 min read',
      content: `
        <h3>Understanding Your Fitness Level</h3>
        <p>Before starting any exercise program, it's crucial to assess your current fitness level. This helps create a safe and effective workout plan tailored to your abilities and goals.</p>
        
        <h3>Beginner Workout Plans</h3>
        <p>For beginners, start with low-impact exercises like walking, swimming, or gentle yoga. Focus on building consistency and gradually increasing intensity over time. Aim for 20-30 minutes of activity, 3-4 times per week.</p>
        
        <h3>Intermediate Training</h3>
        <p>Intermediate exercisers can incorporate more challenging workouts including strength training, high-intensity interval training (HIIT), and longer cardio sessions. Include both aerobic and anaerobic exercises for comprehensive fitness.</p>
        
        <h3>Advanced Fitness Programs</h3>
        <p>Advanced fitness enthusiasts can engage in complex training programs including powerlifting, advanced HIIT, and sport-specific training. Focus on progressive overload and periodization for continued improvement.</p>
        
        <h3>Recovery and Rest</h3>
        <p>Proper recovery is essential for preventing injury and maximizing results. Include rest days, stretching, and adequate sleep in your fitness routine. Listen to your body and adjust intensity as needed.</p>
      `
    },
    'Nutrition Advice': {
      title: 'Balanced Nutrition Plans for Optimal Health',
      author: 'Dr. Emily Rodriguez, Registered Dietitian',
      date: 'January 10, 2025',
      readTime: '6 min read',
      content: `
        <h3>The Foundation of Good Nutrition</h3>
        <p>Proper nutrition is fundamental to maintaining a healthy weight and supporting overall wellness. A well-balanced diet provides the essential nutrients your body needs to function optimally.</p>
        
        <h3>Macronutrient Balance</h3>
        <p>Understanding the role of carbohydrates, proteins, and fats is key to creating a balanced diet. Each macronutrient serves specific functions in the body and should be consumed in appropriate proportions based on your individual needs.</p>
        
        <h3>Micronutrient Importance</h3>
        <p>Vitamins and minerals play crucial roles in various bodily functions. Focus on consuming a variety of colorful fruits and vegetables to ensure adequate micronutrient intake. Consider supplementation only when necessary and under professional guidance.</p>
        
        <h3>Meal Planning Strategies</h3>
        <p>Effective meal planning can help maintain healthy eating habits. Plan meals ahead, prepare healthy snacks, and practice mindful eating. Consider your schedule, preferences, and nutritional needs when creating meal plans.</p>
        
        <h3>Hydration and Health</h3>
        <p>Proper hydration is essential for all bodily functions. Aim to drink adequate water throughout the day, and consider factors like activity level, climate, and individual needs when determining hydration requirements.</p>
      `
    },
    'Sleep & Recovery': {
      title: 'Sleep & Recovery: The Foundation of Health',
      author: 'Dr. Michael Thompson, Sleep Specialist',
      date: 'January 8, 2025',
      readTime: '6 min read',
      content: `
        <h3>The Science of Sleep</h3>
        <p>Quality sleep is fundamental to metabolic health, cognitive function, and physical recovery. During sleep, your body repairs tissues, consolidates memories, and regulates hormones that control hunger and metabolism.</p>
        
        <h3>Sleep Architecture & BMI</h3>
        <p>Poor sleep disrupts leptin and ghrelin—hormones that regulate appetite. Sleep deprivation increases cortisol levels, promoting fat storage, particularly around the midsection. Aim for 7-9 hours of quality sleep nightly.</p>
        
        <h3>Recovery Optimization</h3>
        <p>Active recovery includes gentle movement, stretching, and stress management. Incorporate rest days into your fitness routine, practice progressive muscle relaxation, and maintain consistent sleep schedules for optimal recovery.</p>
        
        <h3>Sleep Hygiene Essentials</h3>
        <p>Create a cool, dark environment, limit screen time before bed, and establish a calming bedtime routine. Consider magnesium supplementation and avoid caffeine 6 hours before sleep for better sleep quality.</p>
      `
    },
    'Hydration Essentials': {
      title: 'Hydration Essentials: Water and Metabolic Health',
      author: 'Dr. Lisa Park, Sports Medicine',
      date: 'January 6, 2025',
      readTime: '5 min read',
      content: `
        <h3>Hydration and Metabolism</h3>
        <p>Proper hydration is crucial for metabolic function, nutrient transport, and temperature regulation. Even mild dehydration can slow metabolism by 2-3% and affect cognitive performance.</p>
        
        <h3>Daily Water Requirements</h3>
        <p>Base requirement: 35ml per kg of body weight. Add 500-750ml per hour of exercise. Monitor urine color—pale yellow indicates optimal hydration. Increase intake in hot climates or at altitude.</p>
        
        <h3>Timing and Quality</h3>
        <p>Drink 500ml upon waking to kickstart metabolism. Sip consistently throughout the day rather than large amounts at once. Choose filtered water and consider electrolyte balance during intense exercise.</p>
        
        <h3>Hydration and Weight Management</h3>
        <p>Water before meals can increase satiety and reduce calorie intake. Cold water may slightly boost metabolism through thermogenesis. Avoid sugary drinks that add empty calories and disrupt blood sugar.</p>
      `
    },
    'Mental Wellness': {
      title: 'Mental Wellness: The Mind-Body Connection',
      author: 'Dr. Rachel Green, Clinical Psychologist',
      date: 'January 4, 2025',
      readTime: '7 min read',
      content: `
        <h3>Stress and Weight Connection</h3>
        <p>Chronic stress elevates cortisol, promoting abdominal fat storage and increasing cravings for high-calorie foods. Understanding this connection is key to sustainable weight management.</p>
        
        <h3>Mindful Eating Practices</h3>
        <p>Practice eating without distractions, chew slowly, and pay attention to hunger cues. Mindful eating reduces overeating, improves digestion, and enhances meal satisfaction.</p>
        
        <h3>Habit Formation Science</h3>
        <p>New habits take 21-66 days to form. Start small, stack habits onto existing routines, and focus on consistency over perfection. Use positive reinforcement and track progress visually.</p>
        
        <h3>Stress Management Techniques</h3>
        <p>Regular meditation, deep breathing exercises, and progressive muscle relaxation can lower cortisol levels. Aim for 10-20 minutes daily of stress-reduction practices for optimal mental health.</p>
      `
    },
    'Preventive Care': {
      title: 'Preventive Care: Proactive Health Monitoring',
      author: 'Dr. James Wilson, Internal Medicine',
      date: 'January 2, 2025',
      readTime: '6 min read',
      content: `
        <h3>Essential Health Screenings</h3>
        <p>Regular screenings catch health issues early when they're most treatable. Key metrics include blood pressure, cholesterol, blood glucose, and BMI measurements taken consistently.</p>
        
        <h3>Laboratory Tests to Track</h3>
        <p>Annual complete blood count, comprehensive metabolic panel, lipid profile, and HbA1c. Consider vitamin D, B12, and thyroid function tests. Track trends over time rather than single values.</p>
        
        <h3>Age-Specific Recommendations</h3>
        <p>20s-30s: Establish baseline values, focus on lifestyle habits. 40s-50s: Add cancer screenings, bone density tests. 60s+: Increase screening frequency, monitor for age-related conditions.</p>
        
        <h3>Self-Monitoring Tools</h3>
        <p>Track daily weight, blood pressure, and physical activity. Use apps or journals to monitor sleep quality, energy levels, and mood patterns. Share data with healthcare providers for better care.</p>
      `
    },
    'Sunlight & Circadian Health': {
      title: 'Sunlight & Circadian Health: Natural Rhythm Optimization',
      author: 'Dr. Andrew Huberman, Neuroscientist',
      date: 'December 30, 2024',
      readTime: '8 min read',
      content: `
        <h3>Circadian Biology Fundamentals</h3>
        <p>Your circadian rhythm controls hormone release, body temperature, and metabolism. Light exposure, particularly morning sunlight, is the primary signal that synchronizes your internal clock.</p>
        
        <h3>Morning Light Protocol</h3>
        <p>Get 10-30 minutes of bright light exposure within 1 hour of waking. Face east, avoid sunglasses, and increase duration on cloudy days. This optimizes cortisol awakening response and evening melatonin production.</p>
        
        <h3>Vitamin D and Metabolism</h3>
        <p>Vitamin D deficiency is linked to increased BMI and metabolic dysfunction. Aim for 15-30 minutes of midday sun exposure, depending on skin type and latitude. Consider supplementation in winter months.</p>
        
        <h3>Evening Light Management</h3>
        <p>Dim lights 2-3 hours before bed, use blue light filters, and avoid bright screens. Red light is least disruptive to melatonin production. Create a consistent light-dark cycle for optimal sleep quality.</p>
      `
    },
    'Breath & Cardio Health': {
      title: 'Breath & Cardio Health: Respiratory Fitness Fundamentals',
      author: 'Dr. Patrick McKeown, Breathing Expert',
      date: 'December 28, 2024',
      readTime: '7 min read',
      content: `
        <h3>Breathing Mechanics and Health</h3>
        <p>Proper breathing patterns affect heart rate variability, stress response, and oxygen delivery. Nasal breathing filters air, produces nitric oxide, and activates the parasympathetic nervous system.</p>
        
        <h3>VO2 Max and Longevity</h3>
        <p>VO2 max is the strongest predictor of longevity. Improve it through high-intensity intervals, zone 2 cardio, and breath training. Even modest improvements significantly reduce mortality risk.</p>
        
        <h3>Breath Training Protocols</h3>
        <p>Practice box breathing (4-4-4-4 count), Wim Hof method for stress resilience, and breath holds to improve CO2 tolerance. Start with 5-10 minutes daily and progress gradually.</p>
        
        <h3>Cardiovascular Optimization</h3>
        <p>Combine aerobic base building (Zone 2) with high-intensity intervals. Monitor heart rate variability as a recovery metric. Include strength training to support cardiovascular health and metabolic function.</p>
      `
    },
    'Metabolic Optimization': {
      title: 'Metabolic Optimization: Advanced Health Strategies',
      author: 'Dr. Peter Attia, Longevity Medicine',
      date: 'January 20, 2025',
      readTime: '12 min read',
      content: `
        <h3>Understanding Metabolic Health</h3>
        <p>True metabolic health extends beyond BMI to include insulin sensitivity, mitochondrial function, and metabolic flexibility—your body's ability to efficiently switch between fuel sources (glucose and fat).</p>
        
        <h3>Advanced Nutritional Strategies</h3>
        <p>Time-restricted eating (12-16 hour fasting windows) can improve insulin sensitivity and promote autophagy. Consider nutrient timing: protein throughout the day, carbohydrates around workouts, and healthy fats for satiety and hormone production.</p>
        
        <h3>Metabolic Flexibility Training</h3>
        <p>Alternate between fed and fasted states to improve metabolic flexibility. Practice fasted cardio 2-3x weekly, incorporate periodic longer fasts (24-48 hours) under supervision, and cycle carbohydrate intake based on activity levels.</p>
        
        <h3>Biomarker Optimization</h3>
        <p>Key metrics include fasting glucose (<90mg/dL), HbA1c (<5.4%), triglycerides (<100mg/dL), and HDL (>60mg/dL). Monitor continuous glucose if available. Track body composition, not just weight—focus on muscle mass preservation and fat loss.</p>
        
        <h3>Mitochondrial Health</h3>
        <p>Support cellular energy production through regular exercise, cold exposure, heat therapy (sauna), and targeted supplementation. Quality sleep and stress management are crucial for mitochondrial function and metabolic health.</p>
        
        <h3>Personalized Approach</h3>
        <p>Genetic testing can inform optimal diet and exercise strategies. Consider factors like APOE status for fat tolerance, COMT variants for stress response, and AMY1 copies for carbohydrate metabolism. Work with qualified practitioners for personalized protocols.</p>
        
        <h3>Long-term Sustainability</h3>
        <p>Focus on lifestyle interventions that you can maintain long-term. Gradual changes compound over time. Prioritize sleep quality, stress management, and social connections—these foundational elements support all other health interventions.</p>
      `
    },
    'Hormonal Balance': {
      title: 'Hormonal Balance: The Key to Metabolic Health',
      author: 'Dr. Sara Gottfried, Hormone Expert',
      date: 'January 22, 2025',
      readTime: '9 min read',
      content: `
        <h3>Understanding Hormonal Impact</h3>
        <p>Hormones are chemical messengers that regulate metabolism, appetite, fat storage, and energy levels. Key players include insulin, cortisol, thyroid hormones, leptin, ghrelin, and sex hormones—all directly affecting body composition and BMI.</p>
        
        <h3>Insulin Sensitivity Optimization</h3>
        <p>Insulin resistance is a primary driver of weight gain and metabolic dysfunction. Improve sensitivity through time-restricted eating, regular exercise, adequate sleep, and minimizing processed foods. Consider berberine or chromium supplementation under medical guidance.</p>
        
        <h3>Cortisol Management</h3>
        <p>Chronic stress elevates cortisol, promoting abdominal fat storage and muscle breakdown. Implement stress-reduction techniques: meditation, yoga, deep breathing, nature exposure, and maintaining healthy boundaries in work and relationships.</p>
        
        <h3>Thyroid Function Support</h3>
        <p>Thyroid hormones regulate metabolic rate. Support function with adequate iodine, selenium, and zinc. Monitor TSH, T3, T4, and reverse T3 levels. Address underlying causes like autoimmunity, nutrient deficiencies, or chronic stress.</p>
        
        <h3>Appetite Hormone Balance</h3>
        <p>Leptin signals satiety while ghrelin stimulates hunger. Optimize these through consistent sleep schedules, protein-rich meals, avoiding ultra-processed foods, and maintaining healthy body fat levels. Intermittent fasting can help reset leptin sensitivity.</p>
        
        <h3>Sex Hormone Optimization</h3>
        <p>Testosterone and estrogen affect muscle mass, fat distribution, and metabolic rate. Support through strength training, healthy fats, adequate sleep, stress management, and maintaining optimal body composition. Consider bioidentical hormone therapy if clinically indicated.</p>
      `
    },
    'Recovery & Longevity': {
      title: 'Recovery & Longevity: Optimizing Healthspan',
      author: 'Dr. David Sinclair, Longevity Researcher',
      date: 'January 24, 2025',
      readTime: '10 min read',
      content: `
        <h3>The Science of Recovery</h3>
        <p>Recovery is when adaptation occurs—muscle growth, metabolic improvements, and cellular repair happen during rest periods. Optimizing recovery accelerates progress while reducing injury risk and supporting long-term health outcomes.</p>
        
        <h3>Sleep Optimization Protocols</h3>
        <p>Quality sleep is the foundation of recovery. Maintain consistent sleep-wake cycles, create a cool, dark environment, limit blue light exposure 2 hours before bed, and consider magnesium glycinate supplementation. Aim for 7-9 hours nightly.</p>
        
        <h3>Active Recovery Strategies</h3>
        <p>Incorporate gentle movement on rest days: walking, yoga, swimming, or mobility work. This promotes blood flow, reduces stiffness, and supports lymphatic drainage without adding training stress. Listen to your body's signals.</p>
        
        <h3>Nutritional Recovery Support</h3>
        <p>Post-exercise nutrition timing matters: consume protein within 2 hours, include anti-inflammatory foods (berries, fatty fish, leafy greens), stay hydrated, and consider tart cherry juice for natural melatonin and anti-inflammatory compounds.</p>
        
        <h3>Longevity Interventions</h3>
        <p>Evidence-based practices for healthspan extension: intermittent fasting, heat/cold exposure (sauna/cold plunging), regular exercise, social connections, purpose-driven activities, and continuous learning. These activate cellular repair mechanisms.</p>
        
        <h3>Biomarker Tracking</h3>
        <p>Monitor key longevity markers: resting heart rate variability, VO2 max, grip strength, balance, cognitive function, and inflammatory markers (CRP, IL-6). Regular assessment allows for proactive interventions and course corrections.</p>
        
        <h3>Stress Resilience Building</h3>
        <p>Develop adaptive stress responses through controlled stressors: exercise, cold exposure, fasting, and challenging mental tasks. This builds resilience while avoiding chronic stress that accelerates aging and impairs recovery.</p>
      `
    }
  };

  $: articleData = articleContents[title as keyof typeof articleContents] || {
    title: title,
    author: 'Health Team',
    date: 'January 2025',
    readTime: '5 min read',
    content: content || '<p>Detailed health information and evidence-based recommendations for optimal wellness.</p>'
  };
</script>

{#if isOpen}
  <div 
    class="modal-overlay" 
    on:click={handleOverlayClick}
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="modal-title"
    tabindex="-1"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">{articleData.title}</h2>
        <button class="modal-close" on:click={closeModal} aria-label="Close modal">
          <X class="w-6 h-6" />
        </button>
      </div>
      
      <div class="article-meta">
        <div class="meta-item">
          <User class="w-4 h-4" />
          <span>{articleData.author}</span>
        </div>
        <div class="meta-item">
          <Calendar class="w-4 h-4" />
          <span>{articleData.date}</span>
        </div>
        <div class="meta-item">
          <Clock class="w-4 h-4" />
          <span>{articleData.readTime}</span>
        </div>
      </div>
      
      <!-- Reading progress indicator -->
      <div class="progress-bar">
        <div class="progress-fill" style="width: {scrollProgress}%"></div>
      </div>
      
      <div class="modal-body" bind:this={modalBodyEl} on:scroll={updateScrollProgress}>
        {@html articleData.content}
      </div>
    </div>
  </div>
{/if}
