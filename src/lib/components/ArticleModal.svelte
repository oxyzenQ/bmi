<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { X, Calendar, Clock, User } from 'lucide-svelte';

  export let isOpen = false;
  export let title = '';
  export let content = '';

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
    }
  };

  $: articleData = articleContents[title as keyof typeof articleContents] || {
    title: title,
    author: 'Health Team',
    date: 'January 2025',
    readTime: '5 min read',
    content: content
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
      
      <div class="modal-body">
        {@html articleData.content}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    backdrop-filter: blur(12px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .modal-content {
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(32px) saturate(200%);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 2rem;
    max-width: 800px;
    max-height: 90vh;
    overflow-y: auto;
    position: relative;
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.6),
      0 0 40px rgba(96, 165, 250, 0.2);
    animation: slideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    padding: 2.5rem;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .modal-title {
    font-size: 1.75rem;
    font-weight: 600;
    color: #ffffff;
    margin: 0;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1.3;
  }

  .modal-close {
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close:hover {
    color: #ffffff;
    background: rgba(255, 255, 255, 0.08);
  }

  .article-meta {
    display: flex;
    gap: 2rem;
    margin-bottom: 2rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #9ca3af;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .modal-body {
    color: #d1d5db;
    line-height: 1.7;
    font-size: 1rem;
  }

  .modal-body h3 {
    color: #ffffff;
    font-size: 1.25rem;
    font-weight: 600;
    margin: 2rem 0 1rem 0;
    background: linear-gradient(135deg, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .modal-body h3:first-child {
    margin-top: 0;
  }

  .modal-body p {
    margin-bottom: 1.5rem;
    text-align: justify;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 768px) {
    .modal-content {
      padding: 2rem;
      border-radius: 1.5rem;
      margin: 1rem;
    }

    .modal-title {
      font-size: 1.5rem;
    }

    .article-meta {
      flex-direction: column;
      gap: 1rem;
    }

    .meta-item {
      font-size: 0.8rem;
    }
  }

  @media (max-width: 480px) {
    .modal-content {
      padding: 1.5rem;
      border-radius: 1.25rem;
    }

    .modal-title {
      font-size: 1.25rem;
    }

    .modal-body {
      font-size: 0.9rem;
    }

    .modal-body h3 {
      font-size: 1.125rem;
    }
  }

  /* Reduce motion for users who prefer it */
  @media (prefers-reduced-motion: reduce) {
    .modal-overlay,
    .modal-content {
      animation: none;
    }
  }
</style>
