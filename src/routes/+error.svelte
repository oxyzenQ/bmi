<script lang="ts">
        import { page } from '$app/state';
        import { goto } from '$app/navigation';
        import { resolve } from '$app/paths';

        interface Props {
                data: { message: string; status: number };
        }

        let { data }: Props = $props();

        let statusCode = $derived(data.status);
        let statusText = $derived(
                statusCode === 404
                        ? 'Page Not Found'
                        : statusCode === 500
                                ? 'Internal Error'
                                : `Error ${statusCode}`
        );

        let description = $derived(
                statusCode === 404
                        ? "The page you're looking for doesn't exist or has been moved."
                        : data.message || 'Something went wrong. Please try again.'
        );

        function handleRetry() {
                goto(resolve('/'));
        }
</script>

<svelte:head>
        <title>{statusText} — BMI Calculator</title>
        <meta name="robots" content="noindex" />
</svelte:head>

<div class="error-shell">
        <div class="error-container">
                <div class="error-visual">
                        <div class="error-code">{statusCode}</div>
                        <div class="error-pulse" aria-hidden="true"></div>
                </div>

                <h1 class="error-title">{statusText}</h1>
                <p class="error-desc">{description}</p>

                <div class="error-actions">
                        <button class="btn btn-primary btn-lg" onclick={handleRetry}>
                                ← Back to Calculator
                        </button>
                </div>

                {#if statusCode !== 404}
                        <p class="error-hint">
                                If this persists, try clearing your browser cache or
                                <button class="error-link" onclick={() => goto(resolve('/'))}>reload the app</button>.
                        </p>
                {/if}
        </div>
</div>

<style>
        .error-shell {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                min-height: 100dvh;
                padding: 2rem;
                text-align: center;
        }

        .error-container {
                max-width: 480px;
        }

        .error-visual {
                position: relative;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 2rem;
        }

        .error-code {
                font-family: 'JetBrains Mono Variable', monospace;
                font-size: clamp(5rem, 15vw, 8rem);
                font-weight: 700;
                line-height: 1;
                background: var(--bg-cosmic);
                -webkit-background-clip: text;
                background-clip: text;
                -webkit-text-fill-color: transparent;
                position: relative;
                z-index: 1;
        }

        .error-pulse {
                position: absolute;
                inset: -20px;
                border-radius: 50%;
                background: radial-gradient(circle, var(--neon-15), transparent 70%);
                animation: errorPulse 3s ease-in-out infinite;
        }

        @keyframes errorPulse {
                0%,
                100% {
                        transform: scale(0.9);
                        opacity: 0.5;
                }
                50% {
                        transform: scale(1.1);
                        opacity: 1;
                }
        }

        .error-title {
                font-size: clamp(1.5rem, 4vw, 2rem);
                font-weight: 700;
                color: white;
                margin-bottom: 0.75rem;
        }

        .error-desc {
                font-size: 1rem;
                color: var(--sg-30, #94a3b8);
                line-height: 1.6;
                margin-bottom: 2rem;
        }

        .error-actions {
                margin-bottom: 1.5rem;
        }

        .error-hint {
                font-size: 0.85rem;
                color: var(--coolgray-40, #64748b);
        }

        .error-link {
                font-size: 0.85rem;
                color: var(--violet-50, #a78bfa);
                text-decoration: underline;
                text-underline-offset: 2px;
                background: none;
                border: none;
                cursor: pointer;
                font-family: inherit;
                padding: 0;
                transition: color 0.2s ease;
        }

        .error-link:hover {
                color: var(--purple-80, #c4b5fd);
        }

        @media (prefers-reduced-motion: reduce) {
                .error-pulse {
                        animation: none;
                }
        }
</style>
