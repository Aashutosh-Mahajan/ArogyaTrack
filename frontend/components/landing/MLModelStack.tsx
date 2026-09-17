'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

const MODELS = [
  {
    title: 'Prophet Forecasting',
    desc: '7, 14, and 30-day case forecasts with 95% confidence intervals, trained on multi-year district-level surveillance data.',
    metric: '95%',
    metricLabel: 'Confidence interval',
    accent: '#2ECB71',
  },
  {
    title: 'DBSCAN Clustering',
    desc: 'Geographic hotspot detection across a 50km radius, surfacing emerging clusters before they show up in aggregate case counts.',
    metric: '50km',
    metricLabel: 'Cluster radius',
    accent: '#5EEEAD',
  },
  {
    title: 'Isolation Forest',
    desc: 'Unsupervised anomaly detection that flags statistically unusual outbreak patterns invisible to threshold-based alerting.',
    metric: '24/7',
    metricLabel: 'Continuous scoring',
    accent: '#7FE0D6',
  },
  {
    title: 'XGBoost Risk Scoring',
    desc: '20+ environmental and demographic features fused into a single per-region risk score, updated hourly.',
    metric: '20+',
    metricLabel: 'Input features',
    accent: '#B8F0A8',
  },
];

export default function MLModelStack() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      // Desktop / tablet: pinned scroll-scrubbed card stack.
      mm.add('(min-width: 768px)', () => {
        const cards = gsap.utils.toArray<HTMLElement>('.ml-stack-card');

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: root.current,
            start: 'top top+=80',
            end: () => `+=${cards.length * 420}`,
            scrub: 0.6,
            pin: true,
            anticipatePin: 1,
          },
        });

        cards.forEach((card, i) => {
          if (i === 0) return;
          // Each subsequent card rises from below and settles into the stack,
          // while the previous card sinks slightly and dims — real depth, not a fade.
          tl.fromTo(
            card,
            { yPercent: 60, opacity: 0, scale: 0.92 },
            { yPercent: 0, opacity: 1, scale: 1, duration: 1, ease: 'none' },
            i * 1
          );
          tl.to(
            cards[i - 1],
            { scale: 0.94, opacity: 0.35, filter: 'blur(2px)', duration: 1, ease: 'none' },
            i * 1
          );
        });

        return () => tl.scrollTrigger?.kill();
      });

      // Mobile: no pin/scrub (avoids janky pinning on small viewports) — just a
      // simple per-card fade-up as each scrolls into view.
      mm.add('(max-width: 767px)', () => {
        const cards = gsap.utils.toArray<HTMLElement>('.ml-stack-card');
        cards.forEach((card) => {
          gsap.fromTo(
            card,
            { y: 32, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.7,
              ease: 'power2.out',
              scrollTrigger: { trigger: card, start: 'top 85%' },
            }
          );
        });
      });

      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div ref={root} className="relative grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 md:gap-16 items-center">
      {/* Pinned label column */}
      <div>
        <span className="eyebrow bg-emerald-500/15 text-emerald-300 mb-5">Decision Fusion Engine</span>
        <h2 className="font-syne font-extrabold text-4xl sm:text-5xl text-white mb-5 leading-tight">
          Four models.<br />One unified score.
        </h2>
        <p className="text-white/50 text-lg leading-relaxed max-w-md">
          Each model specializes in one failure mode of outbreak detection. Scroll to see how they stack into a single, fused risk signal.
        </p>
      </div>

      {/* Scroll-scrubbed card stack (desktop) / vertical list (mobile) */}
      <div className="relative space-y-5 md:space-y-0 md:h-[420px]">
        {MODELS.map((m, i) => (
          <div
            key={m.title}
            className="ml-stack-card relative md:absolute md:inset-0 bezel-shell-dark shadow-2xl"
            style={{ zIndex: i + 1 }}
          >
            <div className="bezel-core-dark p-8 h-full flex flex-col justify-between">
              <div>
                <div className="h-1 w-12 rounded-full mb-6" style={{ backgroundColor: m.accent }} />
                <h3 className="font-syne font-bold text-2xl text-white mb-3">{m.title}</h3>
                <p className="text-white/50 leading-relaxed">{m.desc}</p>
              </div>
              <div className="flex items-baseline gap-2 mt-6">
                <span className="font-syne font-extrabold text-3xl" style={{ color: m.accent }}>{m.metric}</span>
                <span className="text-white/40 text-sm">{m.metricLabel}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
