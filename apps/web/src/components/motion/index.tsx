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

  return (
    <motion.span className={className} style={style}>
      {text}
    </motion.span>
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

export { AnimatePresence, motion };
