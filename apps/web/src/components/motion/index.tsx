'use client';

/**
 * Camada de motion reutilizável (ARCHITECTURE §6 — Framer Motion, com propósito).
 * Todas as animações respeitam prefers-reduced-motion via useReducedMotion.
 */
import { useEffect } from 'react';
import {
  animate,
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type Variants,
} from 'framer-motion';

/** Curva padrão de saída — leitura suave e "elástica" no fim. */
const EASE_OUT = [0.16, 1, 0.3, 1] as const;
/** Mola padrão para elementos que "assentam" (pílulas, hover, layout). */
export const SPRING = { type: 'spring', stiffness: 420, damping: 34 } as const;

/* ---------------- entrada de página ---------------- */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- stagger de listas/grids ---------------- */
const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

export function Stagger({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  style,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
} & React.ComponentProps<typeof motion.div>) {
  return (
    <motion.div className={className} style={style} variants={itemVariants} {...rest}>
      {children}
    </motion.div>
  );
}

/* ---------------- card com entrada + hover lift ---------------- */
export function MotionCard({
  children,
  className = '',
  interactive = true,
  ...rest
}: {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
} & React.ComponentProps<typeof motion.section>) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className={`card ${interactive ? 'card-interactive' : ''} ${className}`.trim()}
      variants={itemVariants}
      whileHover={reduce || !interactive ? undefined : { y: -4 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}

/* ---------------- número que "conta" até o valor ---------------- */
export function CountUp({
  value,
  format,
  className,
  style,
  duration = 1.1,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (n) => format(Math.round(n)));

  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: EASE_OUT });
    return () => controls.stop();
  }, [value, duration, reduce, mv]);

  // valor final sempre exposto à árvore de acessibilidade; a contagem é só visual
  return (
    <span className={className} style={style} aria-label={format(value)}>
      <motion.span aria-hidden>{text}</motion.span>
    </span>
  );
}

/* ---------------- barra de progresso animada ---------------- */
export function AnimatedBar({
  percent,
  color,
  height = 8,
  delay = 0,
}: {
  percent: number;
  color?: string;
  height?: number;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const target = Math.max(2, Math.min(100, percent));
  return (
    <div className="bar-track" style={{ height }} role="presentation">
      <motion.div
        className="bar-fill"
        style={color ? { background: color } : undefined}
        initial={reduce ? false : { width: 0 }}
        animate={{ width: `${target}%` }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay }}
      />
    </div>
  );
}

/* ---------------- anel de progresso (mês no hero) ---------------- */
export function ProgressRing({
  progress,
  size = 104,
  stroke = 8,
  color = 'var(--accent)',
  label,
  value,
  caption,
}: {
  /** 0..1 */
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  label: string;
  value: string;
  caption?: string;
}) {
  const reduce = useReducedMotion();
  const radius = (size - stroke) / 2;
  const clamped = Math.max(0.02, Math.min(1, progress));
  return (
    <div className="ring-wrap" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: clamped }}
          transition={{ duration: 1.1, ease: EASE_OUT, delay: 0.15 }}
        />
      </svg>
      <div className="ring-center" aria-hidden>
        <div>
          <div className="ring-value">{value}</div>
          {caption && <div className="ring-caption">{caption}</div>}
        </div>
      </div>
    </div>
  );
}

export { AnimatePresence, motion };
