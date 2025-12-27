import { useEffect } from 'react';

/**
 * A headless component that listens to global events to log user interactions.
 */
export const ActionLogger = () => {
    useEffect(() => {
        const getElementLabel = (el: HTMLElement): string => {
            // 1. Try aria-label
            const aria = el.getAttribute('aria-label');
            if (aria) return aria;

            // 2. Try ID
            if (el.id) return `#${el.id}`;

            // 3. Try name (for inputs)
            const name = (el as any).name;
            if (name) return `name="${name}"`;

            // 4. Try innerText (but keep it short and clean)
            if (el.innerText) {
                const text = el.innerText.split('\n')[0].trim(); // First line
                return text.substring(0, 30) + (text.length > 30 ? '...' : '');
            }

            // 5. Try placeholder
            const placeholder = (el as any).placeholder;
            if (placeholder) return `placeholder="${placeholder}"`;

            return 'unknown';
        };

        const handleClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // We are interested in interactive elements
            const interactive = target.closest('button, a, input, select, textarea, [role="button"], label');

            if (interactive) {
                const el = interactive as HTMLElement;
                const label = getElementLabel(el);
                const tag = el.tagName.toLowerCase();

                console.log(`👆 [USER CLICK] <${tag}>: "${label}"`, {
                    element: el,
                    classes: el.className
                });
            }
        };

        const handleChange = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.tagName.match(/INPUT|SELECT|TEXTAREA/)) {
                const input = target as HTMLInputElement;
                // Don't log passwords
                if (input.type === 'password') {
                    console.log(`⌨️ [USER INPUT] <${target.tagName.toLowerCase()}> *****`);
                } else {
                    let val = input.value;
                    if (val.length > 50) val = val.substring(0, 50) + '...';
                    const label = getElementLabel(input);
                    console.log(`⌨️ [USER INPUT] <${target.tagName.toLowerCase()}> "${label}" => "${val}"`);
                }
            }
        };

        // Use capture=true for click to catch it early
        window.addEventListener('click', handleClick, true);
        window.addEventListener('change', handleChange, true);

        return () => {
            window.removeEventListener('click', handleClick, true);
            window.removeEventListener('change', handleChange, true);
        };
    }, []);

    return null;
};
