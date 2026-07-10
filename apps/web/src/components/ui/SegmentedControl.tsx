'use client';

/**
 * Controle segmentado para filtros de poucas opções — substitui <select> quando
 * todas as opções cabem na tela. A opção ativa carrega uma pílula animada com
 * layoutId (mesmo padrão do nav-pill do Shell).
 */
import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface SegmentedOption {
  value: string;
  label: string;
}

export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const layoutId = useId();
  const reduce = useReducedMotion();

  return (
    <div className="segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            className="segmented-btn"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="segmented-pill"
                aria-hidden
                transition={
                  reduce ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 38 }
                }
              />
            )}
            <span className="segmented-label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
