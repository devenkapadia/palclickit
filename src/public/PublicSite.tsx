import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  ArrowRight, Camera, Check, Mail, Menu, Phone, Printer, Sparkles, Users, X, Image as ImageIcon, Palette, UserCheck, Gift, Infinity as InfIcon,
} from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { inr, waLink } from '@/lib/format';
import { brand, content as C, t } from '@/lib/content';
import { EVENT_TYPES } from '@shared/constants';
import { Logo, PhotoStrip, Sparkle } from '@/components/Logo';
import { Instagram, WhatsApp } from '@/components/icons';
import { Reveal, SectionTitle } from './bits';
import type { SiteData } from './types';

// All visible text comes from shared/content.json (C). Only icons/colours stay here.
// "Our work" only exists once at least one reel/post has been added.
const navFor = (data: SiteData) => C.nav.items.filter((n) => n.href !== '#work' || data.social.length > 0);

export default function PublicSite() {
  const { data, isLoading, error } = useQuery({ queryKey: ['site'], queryFn: () => api.get<SiteData>('/public/site') });

  useEffect(() => {
    if (data?.settings.seo_title) document.title = data.settings.seo_title;
    const m = document.querySelector('meta[name="description"]');
    if (m && data?.settings.seo_description) m.setAttribute('content', data.settings.seo_description);
  }, [data]);

  if (isLoading) return <div className="grid min-h-screen place-items-center bg-sky"><Logo size={64} className="animate-pulse" /></div>;
  if (error || !data) return (
    <div className="grid min-h-screen place-items-center bg-sky p-6 text-center">
      <div><Logo size={56} className="mx-auto mb-4" /><p className="font-semibold">{C.common.loadError}</p></div>
    </div>
  );
  return (
    <div className="overflow-x-clip">
      <Navbar data={data} />
      <main>
        <Hero data={data} />
        <Marquee />
        <Experience />
        <Events data={data} />
        <SocialWork data={data} />
        <Packages data={data} />
        <HowItWorks />
        <Faq data={data} />
        <Contact data={data} />
      </main>
      <Footer data={data} />
      <FloatingWhatsApp data={data} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Navbar({ data }: { data: SiteData }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const NAV = navFor(data);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [open]);
  return (
    <header className={clsx('fixed inset-x-0 top-0 z-40 transition-all duration-300', scrolled ? 'bg-white/95 shadow-[0_2px_0_0_#171717] backdrop-blur' : 'bg-transparent')}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[72px] sm:px-6">
        <a href="#home" aria-label={t(C.brand.homeAriaLabel)} onClick={() => setOpen(false)}><Logo size={scrolled ? 38 : 44} className="transition-all" /></a>
        <nav className="hidden items-center gap-1 md:flex" aria-label={C.nav.primaryAriaLabel}>
          {NAV.map(({ label, href }) => (
            <a key={href} href={href} className="rounded-full px-4 py-2 text-sm font-bold text-ink transition hover:bg-ink hover:text-sun">{label}</a>
          ))}
          <a href="#contact" className="ml-2 rounded-full border-2 border-ink bg-sun px-5 py-2 text-sm font-extrabold text-ink shadow-[3px_3px_0_0_#171717] transition hover:-translate-y-0.5 hover:shadow-[5px_5px_0_0_#171717]">{C.nav.bookButton}</a>
        </nav>
        <button className="grid size-11 place-items-center rounded-full border-2 border-ink bg-sun md:hidden" onClick={() => setOpen((o) => !o)} aria-label={open ? C.nav.closeMenuAriaLabel : C.nav.openMenuAriaLabel} aria-expanded={open}>
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="fixed inset-x-0 top-16 bottom-0 bg-sky px-6 py-8 md:hidden">
          <nav className="flex flex-col gap-3" aria-label={C.nav.mobileAriaLabel}>
            {NAV.map(({ label, href }) => (
              <a key={href} href={href} onClick={() => setOpen(false)} className="font-display text-4xl font-extrabold text-ink">{label}</a>
            ))}
            <a href="#contact" onClick={() => setOpen(false)} className="mt-4 rounded-2xl border-2 border-ink bg-sun px-6 py-4 text-center font-display text-xl font-extrabold shadow-[5px_5px_0_0_#171717]">{C.nav.bookButton}</a>
          </nav>
          <p className="mt-8 text-sm font-semibold text-ink/70">{data.settings.city}</p>
        </div>
      )}
    </header>
  );
}

/* ------------------------------------------------------------------ */
function Hero({ data }: { data: SiteData }) {
  const s = data.settings;
  const h = C.hero;
  const imgs = data.gallery.images.slice(0, 3);
  const hero = s.hero_image || imgs[0]?.url;
  return (
    <section id="home" className="relative isolate overflow-hidden bg-sky pt-24 sm:pt-28">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute -left-24 top-40 size-72 rounded-full bg-soft" />
        <div className="absolute -right-20 bottom-10 size-96 rounded-full bg-sun/40" />
      </div>
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:pb-24">
        <div>
          <span className="mb-5 inline-flex -rotate-1 items-center gap-2 rounded-full border-2 border-ink bg-white px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest shadow-[3px_3px_0_0_#171717]">
            <Camera className="size-4" /> {t(h.badge, { city: s.city })}
          </span>
          <h1 className="font-display text-[2.6rem] font-extrabold leading-[0.98] text-ink sm:text-7xl">
            {s.hero_title.includes(h.titleHighlight) ? (
              <>{h.titleBefore}<br /><span className="relative inline-block"><span className="relative z-10">{h.titleHighlight}</span><span className="absolute inset-x-[-6px] bottom-1 z-0 h-[42%] -rotate-1 bg-sun" /></span><br />{h.titleAfter}</>
            ) : s.hero_title}
          </h1>
          <p className="mt-6 max-w-xl text-lg font-medium text-ink/80 sm:text-xl">{s.hero_subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#contact" className="group inline-flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-6 py-4 font-display text-base font-extrabold shadow-[5px_5px_0_0_#171717] transition hover:-translate-y-0.5 hover:shadow-[8px_8px_0_0_#171717] active:translate-y-0 sm:text-lg">
              {h.primaryCta} <ArrowRight className="size-5 transition group-hover:translate-x-1" />
            </a>
            <a href="#experience" className="inline-flex items-center gap-2 rounded-2xl border-2 border-ink bg-white px-6 py-4 font-display text-base font-extrabold transition hover:bg-ink hover:text-white sm:text-lg">
              {h.secondaryCta}
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-ink/80">
            {h.perks.map((p) => (
              <li key={p} className="flex items-center gap-1.5"><Check className="size-4 rounded-full bg-ink p-0.5 text-sun" /> {p}</li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto h-[420px] w-full max-w-[520px] sm:h-[560px]">
          <div className="absolute inset-x-6 top-4 bottom-6 rotate-2 rounded-[2rem] border-[3px] border-ink bg-white p-3 shadow-[10px_10px_0_0_#FFDE59]">
            {hero ? <img src={hero} alt={h.imageAlt} className="size-full rounded-[1.4rem] object-cover" fetchPriority="high" /> : <div className="size-full rounded-[1.4rem] bg-soft" />}
            <span className="absolute -left-3 bottom-8 -rotate-6 rounded-lg border-2 border-ink bg-white px-3 py-1.5 text-sm font-extrabold shadow-[3px_3px_0_0_#171717]">{h.stickerText}</span>
          </div>
          <PhotoStrip className="animate-float absolute -left-2 top-0 hidden w-24 sm:block sm:w-28 [--r:-10deg]" tone={0} />
          <PhotoStrip className="animate-float-slow absolute -right-1 bottom-0 w-20 sm:w-28 [--r:8deg]" tone={2} />
          <Sparkle className="animate-wiggle absolute right-2 top-0 size-12" />
          <Sparkle className="animate-wiggle absolute -left-4 bottom-24 size-8" color="#fff" />
          {imgs.slice(1, 3).map((im, i) => (
            <img key={im.id} src={im.url} alt="" aria-hidden className={clsx('absolute hidden h-28 w-24 rounded-xl border-[3px] border-ink object-cover shadow-[4px_4px_0_0_#171717] lg:block', i === 0 ? '-right-10 top-24 rotate-6' : '-left-12 bottom-6 -rotate-6')} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const words = C.marquee.words;
  const row = [...words, ...words];
  return (
    <div className="overflow-hidden border-y-[3px] border-ink bg-ink py-3" aria-hidden>
      <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-8 whitespace-nowrap font-display text-lg font-extrabold text-sun">
        {row.map((w, i) => <span key={i} className="flex items-center gap-8">{w}<Sparkle className="size-5" /></span>)}
      </div>
      <style>{`@keyframes marquee{to{transform:translateX(-50%)}} @media (prefers-reduced-motion:reduce){[class*="animate-[marquee"]{animation:none!important}}`}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
// Icons/colours per step and per feature, matched by position to the lists in content.json.
const STEP_STYLES = [
  { icon: Users, bg: 'bg-sky' },
  { icon: Camera, bg: 'bg-sun' },
  { icon: Printer, bg: 'bg-cream' },
  { icon: Gift, bg: 'bg-soft' },
];
const FEATURE_ICONS = [Printer, InfIcon, Palette, Sparkles, Gift, UserCheck, ImageIcon];

function Experience() {
  const x = C.experience;
  return (
    <section id="experience" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal><SectionTitle eyebrow={x.eyebrow} title={<>{x.titleBefore} <span className="bg-sun px-2">{x.titleHighlight}</span></>} sub={x.sub} /></Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {x.steps.map((s, i) => {
            const { icon: Icon, bg } = STEP_STYLES[i % STEP_STYLES.length];
            return (
              <Reveal key={s.number} delay={i * 90}>
                <div className={clsx('group relative h-full rounded-3xl border-[3px] border-ink p-6 shadow-[6px_6px_0_0_#171717] transition hover:-translate-y-1 hover:shadow-[9px_9px_0_0_#171717]', bg)}>
                  <span className="font-display text-6xl font-extrabold text-ink/15">{s.number}</span>
                  <Icon className="mt-2 size-10 transition group-hover:rotate-6" strokeWidth={2.2} />
                  <h3 className="mt-4 font-display text-2xl font-extrabold">{s.title}</h3>
                  <p className="mt-1 font-medium text-ink/75">{s.description}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="mt-14">
          <div className="rounded-3xl bg-navy p-6 text-white sm:p-10">
            <h3 className="font-display text-2xl font-extrabold sm:text-3xl">{x.featuresTitle}</h3>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {x.features.map((label, i) => {
                const Icon = FEATURE_ICONS[i % FEATURE_ICONS.length];
                return (
                  <li key={label} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-sun text-ink"><Icon className="size-5" /></span>{label}
                  </li>
                );
              })}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Events({ data }: { data: SiteData }) {
  if (!data.eventCards.length) return null;
  return (
    <section className="bg-soft py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal><SectionTitle eyebrow={C.events.eyebrow} title={C.events.title} /></Reveal>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {data.eventCards.map((c, i) => (
            <Reveal key={c.id} delay={(i % 4) * 70}>
              <article className={clsx('group relative aspect-[4/5] overflow-hidden rounded-2xl border-[3px] border-ink bg-sky shadow-[5px_5px_0_0_#171717] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#FFDE59] sm:rounded-3xl', i % 2 ? 'sm:translate-y-4' : '')}>
                {c.image_url && <img src={c.image_url} alt={c.title} loading="lazy" className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105" />}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3 text-white sm:p-5">
                  <h3 className="font-display text-base font-extrabold leading-tight sm:text-xl">{c.title}</h3>
                  {c.description && <p className="mt-1 hidden text-sm text-white/80 sm:block">{c.description}</p>}
                </div>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-16 text-center">
          <p className="font-display text-2xl font-extrabold sm:text-3xl">{data.settings.events_cta_text}</p>
          <a href="#contact" className="mt-5 inline-flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-6 py-3.5 font-display font-extrabold shadow-[5px_5px_0_0_#171717] transition hover:-translate-y-0.5">
            {C.events.cta} <ArrowRight className="size-5" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/** Plain reel video: autoplays muted while on screen, pauses when scrolled away. Tap for sound/controls. */
function ReelVideo({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.4 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return <video ref={ref} src={src} aria-label={title} muted loop playsInline controls preload="metadata" className="block aspect-[9/16] w-full bg-ink object-cover" />;
}

// Pixels of Instagram's reel embed hidden at the top (header + song name) and bottom (footer).
const REEL_CROP_TOP = 64;
const REEL_CROP_BOTTOM = 110;
// Posts: hide the header (avatar + username); the window below is a square, so the variable-height
// footer (likes, caption) falls outside it. Change POST_ASPECT to 'aspect-[4/5]' for portrait photos.
const POST_CROP_TOP = 60;
const POST_ASPECT = 'aspect-square';

/** Instagram embed that resizes itself: the embed page posts its measured height to the parent window. */
function InstagramEmbed({ kind, code, title }: { kind: 'reel' | 'post'; code: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(640);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow || !e.origin.endsWith('instagram.com')) return;
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        const h = Number(d?.details?.height);
        if (d?.type === 'MEASURE' && h > 100) setHeight(Math.ceil(h));
      } catch { /* not an Instagram sizing message */ }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const src = `https://www.instagram.com/${kind === 'post' ? 'p' : 'reel'}/${code}/embed`;
  // Posts: fixed-ratio window, frame pushed up so Instagram's header is clipped and the footer falls below.
  if (kind === 'post') {
    return (
      <div className={`relative w-full overflow-hidden bg-ink ${POST_ASPECT}`}>
        <iframe ref={ref} src={src} title={title} loading="lazy" allowFullScreen scrolling="no"
          style={{ height, top: -POST_CROP_TOP }} className="absolute left-0 block w-full border-0 bg-white" />
      </div>
    );
  }
  // Reels: clip Instagram's own header (avatar, username, song name) and footer by pushing the frame up inside
  // an overflow-hidden box. Tune REEL_CROP_* if too much / too little shows.
  return (
    <div className="overflow-hidden bg-ink" style={{ height: height - REEL_CROP_TOP - REEL_CROP_BOTTOM }}>
      <iframe ref={ref} src={src} title={title} loading="lazy" allowFullScreen scrolling="no"
        style={{ height, marginTop: -REEL_CROP_TOP }} className="block w-full border-0 bg-white" />
    </div>
  );
}

function SocialWork({ data }: { data: SiteData }) {
  const s = C.social;
  const igUrl = data.settings.instagram_url;
  const handle = data.settings.instagram_handle;
  if (!data.social.length) return null;
  return (
    <section id="work" className="bg-cream py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal><SectionTitle eyebrow={s.eyebrow} title={s.title} sub={s.sub} /></Reveal>
        <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-8">
          {data.social.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 80} className="w-full max-w-[340px]">
              <figure className="overflow-hidden rounded-3xl border-[3px] border-ink bg-white shadow-[6px_6px_0_0_#171717]">
                {handle && (
                  <a href={igUrl || `https://www.instagram.com/${handle}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 border-b-[3px] border-ink bg-sun px-4 py-2.5 font-display text-sm font-extrabold text-ink transition hover:bg-ink hover:text-sun">
                    <Instagram className="size-4 shrink-0" /> <span className="truncate">@{handle}</span>
                  </a>
                )}
                {p.kind === 'video' && p.video_url
                  ? <ReelVideo src={p.video_url} title={p.caption || s.embedTitle} />
                  : p.code && <InstagramEmbed kind={p.kind === 'post' ? 'post' : 'reel'} code={p.code} title={p.caption || s.embedTitle} />}
                {p.caption && <figcaption className="border-t-[3px] border-ink px-4 py-3 text-center text-sm font-bold">{p.caption}</figcaption>}
              </figure>
            </Reveal>
          ))}
        </div>
        {igUrl && (
          <Reveal className="mt-12 text-center">
            <a href={igUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-6 py-3.5 font-display font-extrabold shadow-[5px_5px_0_0_#171717] transition hover:-translate-y-0.5">
              <Instagram className="size-5" /> {s.followCta}
            </a>
          </Reveal>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Packages({ data }: { data: SiteData }) {
  const k = C.packages;
  if (!data.packages.length) return null;
  return (
    <section id="packages" className="bg-sky py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal><SectionTitle eyebrow={k.eyebrow} title={k.title} sub={k.sub} /></Reveal>
        <div className="grid items-stretch gap-6 lg:grid-cols-3 lg:gap-8">
          {data.packages.map((p, i) => (
            <Reveal key={p.id} delay={i * 100} className="h-full">
              <div className={clsx('relative flex h-full flex-col rounded-3xl border-[3px] border-ink p-6 sm:p-8', p.highlighted ? 'bg-ink text-white shadow-[10px_10px_0_0_#FFDE59] lg:-translate-y-4' : 'bg-white shadow-[8px_8px_0_0_#171717]')}>
                {p.highlighted && <span className="absolute -top-4 left-6 -rotate-2 rounded-full border-2 border-ink bg-sun px-4 py-1 text-xs font-extrabold uppercase tracking-wider text-ink">{k.recommendedBadge}</span>}
                <h3 className="font-display text-2xl font-extrabold">{p.name}</h3>
                {p.tagline && <p className={clsx('mt-1 text-sm', p.highlighted ? 'text-white/70' : 'text-ink/60')}>{p.tagline}</p>}
                <div className="mt-5 flex items-baseline gap-2">
                  <span className="font-display text-5xl font-extrabold">{inr(p.price)}</span>
                  <span className={clsx('text-sm font-bold', p.highlighted ? 'text-sun' : 'text-ink/60')}>{t(k.perDuration, { hours: p.duration_hours })}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-[15px] font-medium">
                      <Check className={clsx('mt-0.5 size-5 shrink-0 rounded-full p-0.5', p.highlighted ? 'bg-sun text-ink' : 'bg-sky text-ink')} strokeWidth={3} />{f}
                    </li>
                  ))}
                </ul>
                <a href={`#contact`} onClick={() => window.dispatchEvent(new CustomEvent('pal:package', { detail: p.code }))}
                  className={clsx('mt-8 inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-ink px-5 py-3.5 font-display font-extrabold transition hover:-translate-y-0.5', p.highlighted ? 'bg-sun text-ink shadow-[4px_4px_0_0_#fff]' : 'bg-sun shadow-[4px_4px_0_0_#171717]')}>
                  {p.cta_label || t(k.defaultCta, { code: p.code })} <ArrowRight className="size-5" />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mx-auto mt-12 max-w-xl text-center text-sm font-semibold text-ink/75">{k.footnote}</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function HowItWorks() {
  const b = C.booking;
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <Reveal><SectionTitle eyebrow={b.eyebrow} title={b.title} /></Reveal>
        <ol className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {b.steps.map((s, i) => (
            <Reveal key={s} delay={i * 90}>
              <li className="relative h-full rounded-2xl border-[3px] border-ink bg-cream p-5 shadow-[5px_5px_0_0_#FFDE59]">
                <span className="grid size-11 place-items-center rounded-full border-2 border-ink bg-sky font-display text-xl font-extrabold">{i + 1}</span>
                <p className="mt-4 font-display text-lg font-extrabold leading-snug">{s}</p>
              </li>
            </Reveal>
          ))}
        </ol>
        <Reveal className="mt-12 text-center">
          <a href="#contact" className="inline-flex items-center gap-2 rounded-2xl border-2 border-ink bg-sun px-7 py-4 font-display text-lg font-extrabold shadow-[5px_5px_0_0_#171717] transition hover:-translate-y-0.5">{b.cta} <ArrowRight className="size-5" /></a>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Faq({ data }: { data: SiteData }) {
  const [open, setOpen] = useState<number | null>(0);
  if (!data.faqs.length) return null;
  return (
    <section id="faq" className="bg-soft py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <Reveal><SectionTitle eyebrow={C.faq.eyebrow} title={C.faq.title} /></Reveal>
        <div className="space-y-3">
          {data.faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.id} className={clsx('overflow-hidden rounded-2xl border-[3px] border-ink bg-white transition', isOpen && 'shadow-[5px_5px_0_0_#FFDE59]')}>
                <h3>
                  <button id={`faq-b-${f.id}`} aria-expanded={isOpen} aria-controls={`faq-p-${f.id}`} onClick={() => setOpen(isOpen ? null : i)} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-display text-base font-extrabold sm:text-lg">
                    {f.question}
                    <span className={clsx('grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink transition', isOpen ? 'rotate-45 bg-sun' : 'bg-white')}>+</span>
                  </button>
                </h3>
                <div id={`faq-p-${f.id}`} role="region" aria-labelledby={`faq-b-${f.id}`} className={clsx('grid transition-all duration-300', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="overflow-hidden"><p className="px-5 pb-5 text-[15px] font-medium text-ink/75">{f.answer}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
interface FormState { customer_name: string; phone: string; event_date: string; start_time: string; duration_hours: string; venue_name: string; location: string; guest_count: string; event_type: string; package_code: string; notes: string; website: string }
const EMPTY: FormState = { customer_name: '', phone: '', event_date: '', start_time: '', duration_hours: '4', venue_name: '', location: '', guest_count: '', event_type: '', package_code: 'Not Sure', notes: '', website: '' };

function Contact({ data }: { data: SiteData }) {
  const s = data.settings;
  const c = C.contact;
  const fm = c.form;
  const [f, setF] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ ref: string; msg: string } | null>(null);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    const h = (e: Event) => setF((p) => ({ ...p, package_code: (e as CustomEvent<string>).detail }));
    window.addEventListener('pal:package', h);
    return () => window.removeEventListener('pal:package', h);
  }, []);

  const message = (ref?: string) => {
    const m = c.whatsappMessage;
    return [
      ref ? t(m.introWithRef, { ref }) : m.intro,
      t(m.name, { value: f.customer_name }), t(m.phone, { value: f.phone }), t(m.event, { value: f.event_type }),
      f.event_date && (f.start_time ? t(m.dateWithTime, { value: f.event_date, time: f.start_time }) : t(m.date, { value: f.event_date })),
      f.duration_hours && t(m.duration, { value: f.duration_hours }),
      f.venue_name && `Venue: ${f.venue_name}`, f.location && t(m.location, { value: f.location }),
      f.guest_count && t(m.guests, { value: f.guest_count }), t(m.package, { value: f.package_code }), f.notes && t(m.notes, { value: f.notes }),
    ].filter(Boolean).join('\n');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await api.post<{ reference: string }>('/public/inquiry', {
        ...f, duration_hours: f.duration_hours || null, guest_count: f.guest_count || null,
      });
      setDone({ ref: r.reference, msg: message(r.reference) });
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : fm.sendError);
    } finally { setBusy(false); }
  };

  const wa = s.whatsapp_number;
  const lbl = 'mb-1.5 block text-sm font-extrabold';
  const inp = 'w-full rounded-xl border-2 border-ink bg-white px-4 py-3 text-base font-medium placeholder:text-ink/35 focus:outline-none focus:ring-4 focus:ring-sun';
  return (
    <section id="contact" className="relative bg-navy py-20 text-white sm:py-28">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[.8fr_1.2fr] lg:gap-16">
        <div>
          <Reveal>
            <SectionTitle center={false} light eyebrow={c.eyebrow} title={<>{c.titleBefore} <span className="text-sun">{c.titleHighlight}</span></>} sub={c.sub} />
          </Reveal>
          <div className="space-y-3">
            {wa && <a href={waLink(wa, s.whatsapp_greeting)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-[#25D366] px-5 py-3.5 font-extrabold text-ink transition hover:brightness-105"><WhatsApp className="size-6" /> {c.whatsappButton}</a>}
            {s.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-3.5 font-extrabold transition hover:bg-white/20"><Instagram className="size-6 text-sun" /> @{s.instagram_handle}</a>}
            {s.phone && <a href={`tel:${s.phone}`} className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-3.5 font-extrabold transition hover:bg-white/20"><Phone className="size-6 text-sun" /> {s.phone}</a>}
            {s.email && <a href={`mailto:${s.email}`} className="flex items-center gap-3 rounded-2xl bg-white/10 px-5 py-3.5 font-extrabold transition hover:bg-white/20"><Mail className="size-6 text-sun" /> {s.email}</a>}
            <p className="px-1 pt-2 text-sm text-white/65">{s.service_area}</p>
          </div>
        </div>

        <Reveal>
          {done ? (
            <div className="rounded-3xl border-[3px] border-ink bg-sun p-8 text-ink shadow-[8px_8px_0_0_#A4D7EB] sm:p-10" role="status">
              <span className="grid size-14 place-items-center rounded-full border-2 border-ink bg-white"><Check className="size-8" strokeWidth={3} /></span>
              <h3 className="mt-5 font-display text-3xl font-extrabold">{t(c.success.title, { name: f.customer_name.split(' ')[0] })}</h3>
              <p className="mt-2 font-medium">{c.success.messageBeforeRef}<b>{done.ref}</b>{c.success.messageAfterRef}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                {wa && <a href={waLink(wa, done.msg)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-2xl border-2 border-ink bg-[#25D366] px-5 py-3 font-extrabold shadow-[4px_4px_0_0_#171717]"><WhatsApp className="size-5" /> {c.success.whatsappButton}</a>}
                <button onClick={() => { setDone(null); setF(EMPTY); }} className="rounded-2xl border-2 border-ink bg-white px-5 py-3 font-extrabold">{c.success.anotherButton}</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="rounded-3xl border-[3px] border-ink bg-white p-5 text-ink shadow-[8px_8px_0_0_#FFDE59] sm:p-8" noValidate>
              <div className="grid gap-4 sm:grid-cols-2">
                <label><span className={lbl}>{fm.fullName.label}</span><input className={inp} required value={f.customer_name} onChange={set('customer_name')} autoComplete="name" placeholder={fm.fullName.placeholder} /></label>
                <label><span className={lbl}>{fm.phone.label}</span><input className={inp} required type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" placeholder={fm.phone.placeholder} /></label>
                <label><span className={lbl}>{fm.eventType.label}</span>
                  <select className={inp} required value={f.event_type} onChange={set('event_type')}><option value="">{fm.eventType.placeholder}</option>{EVENT_TYPES.map((o) => <option key={o}>{o}</option>)}</select></label>
                <label><span className={lbl}>{fm.package.label}</span>
                  <select className={inp} value={f.package_code} onChange={set('package_code')}>{['MINI', 'PLUS', 'PREMIUM', 'Not Sure'].map((o) => <option key={o}>{o}</option>)}</select></label>
                <label><span className={lbl}>{fm.eventDate.label}</span><input className={inp} type="date" value={f.event_date} onChange={set('event_date')} min={new Date().toISOString().slice(0, 10)} /></label>
                <label><span className={lbl}>{fm.startTime.label}</span><input className={inp} type="time" value={f.start_time} onChange={set('start_time')} /></label>
                <label><span className={lbl}>{fm.duration.label}</span><input className={inp} type="number" min="1" step="0.5" value={f.duration_hours} onChange={set('duration_hours')} /></label>
                <label><span className={lbl}>{fm.guests.label}</span><input className={inp} type="number" min="1" inputMode="numeric" value={f.guest_count} onChange={set('guest_count')} placeholder={fm.guests.placeholder} /></label>
                <label><span className={lbl}>Venue name</span><input className={inp} value={f.venue_name} onChange={set('venue_name')} placeholder="e.g. Torino Social" /></label>
                <label><span className={lbl}>Venue address</span><input className={inp} value={f.location} onChange={set('location')} placeholder="Behind Bombay Kitchen, Vadodara" /></label>
                <label className="sm:col-span-2"><span className={lbl}>{fm.notes.label} <span className="font-medium text-ink/50">{fm.notes.optional}</span></span><textarea className={inp} rows={3} value={f.notes} onChange={set('notes')} placeholder={fm.notes.placeholder} /></label>
                {/* Honeypot: hidden from people, tempting for bots */}
                <input tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" name="website" value={f.website} onChange={set('website')} />
              </div>
              {err && <p className="mt-4 rounded-xl border-2 border-bad bg-bad/10 px-4 py-2.5 text-sm font-bold text-bad" role="alert">{err}</p>}
              <button disabled={busy} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-sun px-6 py-4 font-display text-lg font-extrabold shadow-[5px_5px_0_0_#171717] transition hover:-translate-y-0.5 disabled:opacity-60">
                {busy ? fm.sending : <>{fm.submit} <ArrowRight className="size-5" /></>}
              </button>
              <p className="mt-3 text-center text-xs font-medium text-ink/55">{fm.savedNote}</p>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Footer({ data }: { data: SiteData }) {
  const s = data.settings;
  const ft = C.footer;
  return (
    <footer className="bg-ink text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <img src="/logo.png" alt={brand} className="size-28 rounded-2xl border-2 border-sun object-cover" />
          <p className="mt-4 max-w-sm text-sm text-white/70">{s.about_text}</p>
          <div className="mt-5 flex gap-3">
            {s.instagram_url && <a href={s.instagram_url} target="_blank" rel="noopener noreferrer" aria-label={ft.instagramAriaLabel} className="grid size-11 place-items-center rounded-full bg-sun text-ink transition hover:-translate-y-1"><Instagram className="size-5" /></a>}
            {s.whatsapp_number && <a href={waLink(s.whatsapp_number, s.whatsapp_greeting)} target="_blank" rel="noopener noreferrer" aria-label={ft.whatsappAriaLabel} className="grid size-11 place-items-center rounded-full bg-[#25D366] text-ink transition hover:-translate-y-1"><WhatsApp className="size-5" /></a>}
            {s.email && <a href={`mailto:${s.email}`} aria-label={ft.emailAriaLabel} className="grid size-11 place-items-center rounded-full bg-sky text-ink transition hover:-translate-y-1"><Mail className="size-5" /></a>}
          </div>
        </div>
        <nav aria-label={ft.navAriaLabel}><h4 className="font-display text-lg font-extrabold text-sun">{ft.exploreTitle}</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/75">{navFor(data).map(({ label, href }) => <li key={href}><a href={href} className="hover:text-sun">{label}</a></li>)}<li><a href="#faq" className="hover:text-sun">{ft.faqLink}</a></li></ul>
        </nav>
        <div><h4 className="font-display text-lg font-extrabold text-sun">{ft.contactTitle}</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/75">
            <li>{s.city}</li>
            {s.phone && <li><a href={`tel:${s.phone}`} className="hover:text-sun">{s.phone}</a></li>}
            {s.email && <li><a href={`mailto:${s.email}`} className="hover:text-sun">{s.email}</a></li>}
            {s.instagram_handle && <li><a href={s.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-sun">@{s.instagram_handle}</a></li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/50">{t(ft.copyright, { year: new Date().getFullYear(), footerText: s.footer_text })}</div>
    </footer>
  );
}

function FloatingWhatsApp({ data }: { data: SiteData }) {
  const s = data.settings;
  if (!s.whatsapp_number) return null;
  return (
    <a href={waLink(s.whatsapp_number, s.whatsapp_greeting)} target="_blank" rel="noopener noreferrer" aria-label={C.floatingWhatsApp.ariaLabel}
      className="fixed bottom-4 right-4 z-30 grid size-14 place-items-center rounded-full border-2 border-ink bg-[#25D366] text-ink shadow-[3px_3px_0_0_#171717] transition hover:scale-105">
      <WhatsApp className="size-7" />
    </a>
  );
}
