type Props = Record<string, unknown>;
type Child = Node | string | number | false | null | undefined;

/** Tiny element helper — enough structure for a game this size, no framework. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'style' && typeof value === 'object') Object.assign(el.style, value);
    else if (key === 'dataset' && typeof value === 'object') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === 'html') el.innerHTML = String(value);
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === false || child === null || child === undefined) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export const clear = (el: HTMLElement): void => {
  el.replaceChildren();
};

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;
