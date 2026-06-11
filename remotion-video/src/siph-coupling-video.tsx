import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const steps = [
  'TLS',
  'Polarisation',
  'Fiber',
  'Interface',
  'Grating',
  'Taper',
  'Waveguide',
  'OPM / OSA',
  '3D Overview',
];

const colors = {
  bg: '#07111f',
  panel: 'rgba(10, 18, 35, 0.86)',
  border: 'rgba(107, 213, 255, 0.28)',
  laser: '#ff3868',
  guided: '#14f1b2',
  text: '#f4f7ff',
  muted: '#a9b5cf',
};

export const SiPHCouplingVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const progress = frame / Math.max(1, durationInFrames - 1);
  const stepIndex = Math.min(8, Math.floor(progress * steps.length));
  const pulseX = interpolate(progress, [0, 1], [220, 1620], {
    easing: Easing.inOut(Easing.cubic),
  });
  const pulseOpacity = spring({
    frame,
    fps,
    config: {damping: 18, stiffness: 80},
  });
  const sweep = interpolate(frame % 90, [0, 89], [0, 1]);
  const coupling = interpolate(progress, [0, 0.55, 1], [100, 99.9, 95.4]);

  return (
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(circle at 18% 12%, rgba(255,56,104,0.18), transparent 34%), linear-gradient(135deg, #090d19 0%, #071827 62%, #08131f 100%)',
        color: colors.text,
        fontFamily: 'Arial, Helvetica, sans-serif',
        overflow: 'hidden',
      }}
    >
      <GridBackdrop />
      <Header />
      <main style={{position: 'absolute', inset: '132px 70px 62px'}}>
        <section
          style={{
            position: 'absolute',
            inset: '0 0 120px',
            border: `1px solid ${colors.border}`,
            borderRadius: 18,
            background: 'rgba(6, 16, 34, 0.62)',
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          }}
        >
          <SceneLabels frame={frame} stepIndex={stepIndex} />
          <WaveguideScene pulseX={pulseX} pulseOpacity={pulseOpacity} sweep={sweep} />
          <LiveCalculations coupling={coupling} />
        </section>
        <Timeline stepIndex={stepIndex} />
      </main>
    </AbsoluteFill>
  );
};

const Header: React.FC = () => (
  <header
    style={{
      position: 'absolute',
      top: 30,
      left: 70,
      right: 70,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}
  >
    <div>
      <div style={{fontSize: 42, fontWeight: 800, letterSpacing: 0}}>
        SiPH Total Coupling Efficiency Simulation
      </div>
      <div style={{fontSize: 22, color: colors.muted, marginTop: 8}}>
        created by UMC/TPES/TPSG 2026 Ver 1.0
      </div>
    </div>
    <img
      src="https://upload.wikimedia.org/wikipedia/commons/9/9d/UMC-Logo.svg"
      style={{
        width: 170,
        height: 70,
        objectFit: 'contain',
        padding: '12px 18px',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.95)',
      }}
    />
  </header>
);

const GridBackdrop: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      backgroundImage:
        'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
      backgroundSize: '48px 48px',
      transform: 'skewX(-12deg) scale(1.18)',
      opacity: 0.5,
    }}
  />
);

const SceneLabels: React.FC<{frame: number; stepIndex: number}> = ({frame, stepIndex}) => {
  const glow = interpolate(Math.sin(frame / 10), [-1, 1], [0.55, 1]);
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: 44,
          top: 34,
          width: 560,
          padding: 26,
          borderRadius: 16,
          border: `1px solid ${colors.laser}`,
          background: colors.panel,
        }}
      >
        <div style={{color: colors.laser, fontSize: 22, fontWeight: 800}}>
          PHYSICS & MATHEMATICS
        </div>
        <div style={{fontFamily: 'monospace', fontSize: 24, marginTop: 16}}>
          eta_total = eta_phase × eta_pol × eta_align × eta_back × eta_prop
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          right: 44,
          top: 34,
          width: 540,
          padding: 26,
          borderRadius: 16,
          border: `1px solid ${colors.border}`,
          background: colors.panel,
        }}
      >
        <div style={{color: colors.muted, fontSize: 22, fontWeight: 800}}>
          NARRATION PLAYBACK
        </div>
        <div style={{fontSize: 23, lineHeight: 1.35, marginTop: 14}}>
          Step {stepIndex + 1}: {steps[stepIndex]} model contributes to the total coupling budget.
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          left: 64,
          top: 360,
          color: colors.laser,
          fontSize: 30,
          fontWeight: 800,
          opacity: glow,
        }}
      >
        Optical signal path
      </div>
    </>
  );
};

const WaveguideScene: React.FC<{pulseX: number; pulseOpacity: number; sweep: number}> = ({
  pulseX,
  pulseOpacity,
  sweep,
}) => (
  <svg viewBox="0 0 1780 820" style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}>
    <defs>
      <filter id="laserGlow">
        <feGaussianBlur stdDeviation="8" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <linearGradient id="chip" x1="0" x2="1">
        <stop offset="0" stopColor="#6f8199" />
        <stop offset="1" stopColor="#dce9f7" />
      </linearGradient>
    </defs>
    <path
      d="M-40 408 C110 408 140 468 246 452 C330 438 356 355 436 374 C510 392 534 476 622 466 C694 458 716 392 770 408"
      fill="none"
      stroke="rgba(255,255,255,0.18)"
      strokeWidth="48"
    />
    <path
      d="M-40 408 C110 408 140 468 246 452 C330 438 356 355 436 374 C510 392 534 476 622 466 C694 458 716 392 770 408"
      fill="none"
      stroke={colors.laser}
      strokeWidth="12"
      filter="url(#laserGlow)"
      strokeDasharray="18 10"
    />
    <polygon points="770,396 1160,396 1160,464 770,464" fill="url(#chip)" opacity="0.9" />
    <polygon points="1160,396 1480,410 1480,450 1160,464" fill="url(#chip)" opacity="0.95" />
    <rect x="1480" y="410" width="330" height="40" fill="#cfe2f7" opacity="0.92" />
    {Array.from({length: 10}).map((_, i) => (
      <rect key={i} x={790 + i * 30} y="390" width="15" height="28" fill="#122035" stroke="#dbeafe" strokeWidth="4" />
    ))}
    <circle cx={pulseX} cy={430} r={18 + sweep * 10} fill={colors.laser} opacity={0.2 * pulseOpacity} />
    <circle cx={pulseX} cy={430} r="12" fill={colors.laser} filter="url(#laserGlow)" opacity={pulseOpacity} />
    <path
      d="M820 430 C900 388 1000 394 1120 430 C1240 468 1360 468 1480 430 C1560 404 1640 406 1780 430"
      fill="none"
      stroke={colors.guided}
      strokeWidth="7"
      strokeDasharray="14 11"
      opacity="0.95"
    />
  </svg>
);

const LiveCalculations: React.FC<{coupling: number}> = ({coupling}) => {
  const tiles = [
    ['η_phase', '100.0%'],
    ['η_polarisation', '100.0%'],
    ['η_alignment', '100.0%'],
    ['η_backreflection', '99.9%'],
    ['η_propagation', '95.5%'],
    ['Total Coupling', `${coupling.toFixed(1)}%`],
  ];
  return (
    <div
      style={{
        position: 'absolute',
        left: 44,
        right: 44,
        bottom: 34,
        padding: 20,
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        background: 'rgba(5, 12, 27, 0.86)',
      }}
    >
      <div style={{color: colors.laser, fontSize: 22, fontWeight: 800, marginBottom: 12}}>
        LIVE CALCULATIONS
      </div>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12}}>
        {tiles.map(([label, value]) => (
          <div
            key={label}
            style={{
              border: '1px solid rgba(148,163,184,0.25)',
              borderRadius: 12,
              padding: 14,
              background: 'linear-gradient(180deg, rgba(148,163,184,0.12), rgba(15,23,42,0.18))',
            }}
          >
            <div style={{fontSize: 17, color: colors.muted, fontWeight: 700}}>{label}</div>
            <div style={{fontSize: 25, color: colors.guided, fontWeight: 800, marginTop: 6}}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Timeline: React.FC<{stepIndex: number}> = ({stepIndex}) => (
  <div
    style={{
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 86,
      display: 'grid',
      gridTemplateColumns: 'repeat(9, 1fr)',
      gap: 12,
      alignItems: 'center',
    }}
  >
    {steps.map((step, i) => (
      <div key={step} style={{textAlign: 'center', color: i === stepIndex ? colors.laser : colors.muted}}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            margin: '0 auto 8px',
            display: 'grid',
            placeItems: 'center',
            background: i === stepIndex ? colors.laser : 'rgba(148,163,184,0.12)',
            color: '#fff',
            fontWeight: 800,
            boxShadow: i === stepIndex ? '0 0 24px rgba(255,56,104,0.6)' : 'none',
          }}
        >
          {i + 1}
        </div>
        <div style={{fontSize: 16, fontWeight: 700}}>{step}</div>
      </div>
    ))}
  </div>
);
