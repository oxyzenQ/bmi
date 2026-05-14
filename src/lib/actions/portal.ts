/**
 * Shared Svelte action: portal the element to document.body.
 * Escapes ancestor containing-block created by backdrop-filter / transform.
 */
export function portal(node: HTMLElement): { destroy(): void } {
  document.body.appendChild(node);
  return {
    destroy() {
      node.remove();
    }
  };
}