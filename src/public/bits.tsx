import { useEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';

/** Fades/slides children in when they scroll into view. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { el.classList.add('in'); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('in'); io.disconnect(); } },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={clsx('reveal', className)} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

export function SectionTitle({ eyebrow, title, sub, light, center = true }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; light?: boolean; center?: boolean }) {
  return (
    <div className={clsx('mb-10 max-w-2xl sm:mb-14', center && 'mx-auto text-center')}>
      {eyebrow && (
        <span className={clsx('mb-3 inline-block -rotate-2 rounded-md border-2 px-3 py-1 text-xs font-extrabold uppercase tracking-widest', light ? 'border-sun bg-sun text-ink' : 'border-ink bg-sun text-ink shadow-[3px_3px_0_0_#171717]')}>{eyebrow}</span>
      )}
      <h2 className={clsx('font-display text-3xl font-extrabold leading-[1.05] sm:text-5xl', light ? 'text-white' : 'text-ink')}>{title}</h2>
      {sub && <p className={clsx('mt-4 text-base sm:text-lg', light ? 'text-white/75' : 'text-ink/70')}>{sub}</p>}
    </div>
  );
}
