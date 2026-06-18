import { ButtonHTMLAttributes, forwardRef, useEffect, useRef } from 'react';
import { haptic, type HapticLevel } from '@/lib/feedback/haptic';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  level?: HapticLevel;
}

export const HapticButton = forwardRef<HTMLButtonElement, Props>(function HapticButton(
  { level = 'light', onClick, onTouchStart, onMouseDown, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLButtonElement | null>(null);

  // Dev-only a11y warning (Protocolo QA §6.2.5): si el botón no tiene texto
  // accesible ni aria-label/aria-labelledby, lo gritamos en consola UNA vez.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const el = innerRef.current;
    if (!el) return;
    const hasAriaLabel =
      !!el.getAttribute('aria-label') || !!el.getAttribute('aria-labelledby');
    const hasText = !!el.textContent && el.textContent.trim().length > 0;
    if (!hasAriaLabel && !hasText) {
      // eslint-disable-next-line no-console
      console.warn(
        '[HapticButton] icon-only sin aria-label. Agregar aria-label para accesibilidad.',
        el,
      );
    }
  }, []);

  return (
    <button
      ref={(node) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
      }}
      {...rest}
      onTouchStart={(e) => {
        haptic(level);
        onTouchStart?.(e);
      }}
      onMouseDown={(e) => {
        haptic(level);
        onMouseDown?.(e);
      }}
      onClick={onClick}
    />
  );
});