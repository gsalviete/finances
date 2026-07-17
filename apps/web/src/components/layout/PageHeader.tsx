'use client';

/** Cabeçalho padrão de página: eyebrow (contexto) + título display + subtítulo. */
import { motion, useReducedMotion } from 'framer-motion';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.header
      className="page-header row"
      style={{ justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end' }}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children}
    </motion.header>
  );
}
