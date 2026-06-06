/* ==========================================================================
   SiPH Laser Coupling Explanation Video — Controller (app.js)
   ========================================================================== */

(() => {
  'use strict';

  const STEP_MIN = 1;
  const STEP_MAX = 9;
  const C = 299792458;
  const C_NM_PER_PS = 299792.458;
  const GRATING_PITCH_NM = 578;
  const BASE_NEFF = 2.44;
  const TLS_MIN_WAVELENGTH = 1260;
  const TLS_MAX_WAVELENGTH = 1360;
  const TLS_STEP_NM = 5;
  const STEP_DURATION_MS = 3200;

  const PARAMETER_DEFAULTS = {
    fiberTiltAngle: 10,
    lateralOffset: 0,
    fiberGap: 3,
    laserWavelength: 1310,
    laserPower: 10.0,
    tlsLinewidthMHz: 1.0,
    tlsSweepSpeed: 20,
    tlsSweepMode: 'off',
    tlsSweepDirection: 1,
    tlsStepAccumulator: 0,
    polarisationAngle: 0,
    waveguideWidth: 500,
    waveguideHeight: 220
  };

  // State Management
  const state = {
    step: 1, // Active step (1 to 8)
    language: 'en', // 'en' or 'zh'
    theme: 'dark', // 'dark' or 'light'
    isPlaying: false,
    speed: 'normal', // 'slow' (120ms tick), 'normal' (60ms tick), 'fast' (25ms tick)
    playMode: 'movie', // 'movie' (auto-advance) or 'interactive' (manual)
    fiberTiltAngle: 10, // Added for dynamic diffraction simulation
    lateralOffset: 0, // Fiber-to-grating lateral offset in micrometers
    fiberGap: 3, // Fiber-to-chip vertical gap in micrometers
    laserWavelength: 1310, // Added for tunable laser wavelength (1260 to 1360 nm)
    laserPower: 10.0, // Added for adjustable laser power (0 to 20 mW)
    tlsLinewidthMHz: 1.0,
    tlsSweepSpeed: 20,
    tlsSweepMode: 'off',
    tlsSweepDirection: 1,
    tlsStepAccumulator: 0,
    polarisationAngle: 0, // Polarization angle in degrees (0 = TE, 90 = TM)
    waveguideWidth: 500, // Waveguide Width in nm (Step 6)
    waveguideHeight: 220, // Waveguide Height in nm (Step 6)
    
    // Animation variables
    wavePhase: 0,
    pulseProgress: 0, // 0 to 1 along the active step segment
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 1
  };

  const urlParams = new URLSearchParams(window.location.search);
  const qStep = parseInt(urlParams.get('step'), 10);
  if (!isNaN(qStep) && qStep >= STEP_MIN && qStep <= STEP_MAX) {
    state.step = qStep;
  }

  // Playback multipliers. Progress is now time-based, so animation speed
  // stays consistent across devices and display refresh rates.
  const SPEED_CONFIGS = {
    slow: 0.55,
    normal: 1,
    fast: 1.8
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getById(id) {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing required simulator element: #${id}`);
    return el;
  }

  function formatWavelength(value) {
    return Number.isInteger(value) ? `${value}nm` : `${value.toFixed(1)}nm`;
  }


  function resetAllParameters() {
    Object.assign(state, PARAMETER_DEFAULTS);
    state.pulseProgress = 0;
    updateLabelsDisplay();
  }

  // Theme color maps for HTML5 canvas rendering (since CSS vars aren't parsed natively inside canvas contexts)
  const THEME_COLORS = {
    dark: {
      laser: '#e11d48',      // Rich rose/crimson for high contrast on navy blue
      guided: '#059669',     // Rich emerald green for high contrast on navy blue
      taper: '#d97706',      // Rich amber orange
      glow: 'rgba(225, 29, 72, 0.18)',
      bg: '#08142b',         // Navy blue background (entire video background)
      silica: '#e7eef8',     // Bright Buried Oxide (BOX) layer
      bulkSilicon: '#56677f',// Slate grey for Bulk Silicon substrate (real SiPH SOI)
      core: '#28384d',       // Silicon Core
      border: '#7890ad',     // Crisp metallic borders
      fiberTube: '#9fb1c9',  // Translucent cladding
      fiberCore: '#e5edf7'   // Fiber core
    },
    light: {
      laser: '#dc2626',      // Rich bright crimson
      guided: '#059669',     // Rich emerald green
      taper: '#d97706',      // Deep warm amber
      glow: 'rgba(220, 38, 38, 0.2)',
      bg: '#f7fbff',         // Soft lab background
      silica: '#ffffff',     // White-slate Buried Oxide (BOX) layer
      bulkSilicon: '#d2dce8',// Slate grey Bulk Silicon
      core: '#50627a',       // Silicon Core
      border: '#8ea2b8',     // Crisp borders
      fiberTube: '#b7c5d7',
      fiberCore: '#475569'
    }
  };

  // Step Database containing narratives, metrics, formulas, and geometry anchors
  const STEPS_DATA = {
    1: {
      indexStr: 'STEP 01',
      titleEn: 'TLS Tunable Laser Source',
      titleZh: 'TLS 可調諧雷射光源',
      narrativeEn: 'A continuous wave (CW) laser operates at a wavelength of 1310 nm in free space (vacuum). As the wave propagates, its frequency remains constant at 228.9 THz.',
      narrativeZh: '連續波(CW)雷射在真空/自由空間中的發射波長為 1310 nm。光波向前傳播時，其頻率始終保持為 228.9 THz 恆定不變。',
      wavelength: '1310 nm',
      frequency: '228.9 THz',
      velocity: '3.00 &times; 10⁸ m/s',
      index: '1.00 (Vacuum)',
      orderEn: 'N/A',
      orderZh: '無',
      tiltEn: 'N/A',
      tiltZh: '無',
      math: 'f = c / &lambda;₀ = 3.00 &times; 10⁸ / 1310 &times; 10⁻⁹ = 228.9 THz',
      explanationEn: 'The frequency of light is determined strictly by its source and remains constant across all media.',
      explanationZh: '光子的頻率僅由波源（雷射腔）決定，在傳播跨越任何介質時都保持恆定。',
      
      // Camera target coordinates on canvas
      camX: -60,
      camY: 100,
      zoom: 3.6
    },
    2: {
      indexStr: 'STEP 02',
      titleEn: 'Polarisation PLC',
      titleZh: 'PLC 偏振控制器',
      narrativeEn: 'Vary the Polarisation Angle to align the electric field mode. Silicon grating couplers are highly polarization-sensitive and typically require transverse electric (TE) mode for maximum coupling efficiency.',
      narrativeZh: '調整偏振角度以對齊電場模式。矽光柵耦合器具有高度的偏振敏感性，通常需要橫電波 (TE 模式) 以達到最高耦合效率。',
      wavelength: '1310 nm',
      frequency: '228.9 THz',
      velocity: '3.00 &times; 10⁸ m/s',
      index: '1.45 (Silica core)',
      orderEn: 'N/A',
      orderZh: '無',
      tiltEn: 'N/A',
      tiltZh: '無',
      math: 'P_{TE} = P_{in} &middot; cos^2(&phi;), P_{TM} = P_{in} &middot; sin^2(&phi;)',
      explanationEn: 'Varying the polarisation angle changes the mode from TE (0°) to TM (90°). TM mode fails to match the grating coupler diffraction phase condition.',
      explanationZh: '改變偏振角會將模式自 TE (0°) 切換至 TM (90°)。TM 模式將無法匹配光柵耦合器的繞射相位條件，導致無法耦合。',
      
      // Camera target coordinates on canvas
      camX: 80,
      camY: 100,
      zoom: 3.2
    },
    3: {
      indexStr: 'STEP 03',
      titleEn: 'Fiber Coupling',
      titleZh: '光纖耦合傳輸',
      narrativeEn: 'The laser is coupled into a single-mode silica optical fiber (SMF). Within the fiber, light propagates guided with low loss. The wavelength and frequency remain unchanged at the fiber output.',
      narrativeZh: '雷射被耦合引導進入單模二氧化矽光纖(SMF)。光在光纖芯中以極低損耗進行導模傳輸。在光纖輸出端端面處，其波長和頻率仍舊保持不變。',
      wavelength: '1310 nm',
      frequency: '228.9 THz',
      velocity: '3.00 &times; 10⁸ m/s',
      index: '1.00 (Air output)',
      orderEn: 'N/A',
      orderZh: '無',
      tiltEn: 'N/A',
      tiltZh: '無',
      math: '&lambda;_fiber = &lambda;₀ = 1310 nm (at output)',
      explanationEn: 'At the fiber output face, the light wave exits into the air/cladding gap before striking the silicon chip.',
      explanationZh: '在光纖輸出端端面處，光波在射向光柵前短暫穿過空氣/包層縫隙。',
      
      camX: 200,
      camY: 110,
      zoom: 1.6
    },
    4: {
      indexStr: 'STEP 04',
      titleEn: 'Incident on Grating Coupler',
      titleZh: '入射光柵耦合器',
      narrativeEn: 'The light exiting the fiber is incident on the grating coupler at a specific angle θ_in. The wave travels through the air/cladding gap to make contact with the silicon grating grooves.',
      narrativeZh: '自光纖射出的光束，以特定入射角 θ_in 照射到矽晶片表面的光柵耦合器上。此時光波仍處於空氣或二氧化矽包層中傳播。',
      wavelength: '1310 nm',
      frequency: '228.9 THz',
      velocity: '3.00 &times; 10⁸ m/s',
      index: '1.00 (Cladding gap)',
      orderEn: 'N/A',
      orderZh: '無',
      tiltEn: '10&deg;',
      tiltZh: '10&deg;',
      math: '&theta;_in &approx; 8&deg; - 12&deg; (typical tilt)',
      explanationEn: 'The fibers are tilted (typically 10°) to prevent back-reflection into the fiber, which would destabilize the cavity of the laser source.',
      explanationZh: '光學入射角傾斜（通常為 10°）旨在避免光束垂直反射回光纖，從而干擾並破壞雷射源腔體的穩定性。',
      
      camX: 320,
      camY: 130,
      zoom: 1.8
    },
    5: {
      indexStr: 'STEP 05',
      titleEn: 'Diffraction by Grating',
      titleZh: '光柵繞射與耦合',
      narrativeEn: 'The periodic grating grooves diffract the incident light beam, matching the phase velocity and coupling the light into the in-plane waveguide core.',
      narrativeZh: '光柵表面的週期性條紋結構對入射光束進行繞射與相干干涉，從而實現相位匹配，將光束偏轉並耦併入片上二維波導纖芯中。',
      wavelength: '1310 nm',
      frequency: '228.9 THz',
      velocity: '3.00 &times; 10⁸ m/s',
      index: 'Frequency stays constant',
      orderEn: 'm = -1 (Picked)',
      orderZh: 'm = -1 (已選繞射級)',
      tiltEn: '10&deg;',
      tiltZh: '10&deg;',
      math: 'n_eff = n_clad &middot; sin(&theta;_in) - m &middot; (&lambda;₀ / &Lambda;)',
      explanationEn: 'This represents the phase-matching condition. Λ is the grating pitch, and m is the diffraction order (typically -1).',
      explanationZh: '這是光柵耦合的相位匹配公式。Λ 為光柵週期，m 為繞射級數（通常為第一級繞射 -1）。',
      
      camX: 420,
      camY: 150,
      zoom: 1.8
    },
    6: {
      indexStr: 'STEP 06',
      titleEn: 'Adiabatic Mode Transformation',
      titleZh: '絕熱模態轉換 (關鍵步驟)',
      narrativeEn: 'The coupled light enters a shallow taper region. The waveguide width and height are tapered gradually. This adiabatic transition converts the large diffraction field into a tightly confined waveguide guided mode without radiation losses.',
      narrativeZh: '耦合後的光波進入絕熱漸變區(Taper)。波導寬度與高度以極緩慢幾何漸變方式收縮。該絕熱過渡使得寬大的繞射模態平滑轉換為緊湊的波導導模，避免輻射與反射損耗。',
      wavelength: 'Transition / 漸變',
      frequency: '228.9 THz',
      velocity: 'Decreasing / 漸減',
      index: 'n_eff smoothly increases',
      orderEn: 'm = -1 (Guided)',
      orderZh: 'm = -1 (導模傳導)',
      tiltEn: '10&deg;',
      tiltZh: '10&deg;',
      math: '|dn_eff / dz| &le; (2&pi; / &lambda;₀) &middot; (n_core&sup2; - n_clad&sup2;)&sup1;&sup2;',
      explanationEn: 'The adiabatic condition ensures the effective index rate of change along z is tiny compared to confinement, preventing coupling to radiation states.',
      explanationZh: '絕熱條件規定，有效折射率沿傳播方向 z 的變化率必須極小，以防止能量散射轉換至包層輻射模式中。',
      
      camX: 520,
      camY: 155,
      zoom: 1.8
    },
    7: {
      indexStr: 'STEP 07',
      titleEn: 'Propagation in Waveguide',
      titleZh: '波導中傳播 (波長發生變化)',
      narrativeEn: 'Inside the silicon waveguide core, light is guided via Total Internal Reflection. Because silicon has a high refractive index (n = 3.48), the phase velocity drops, and the wavelength compresses to approximately 545 nm.',
      narrativeZh: '在矽波導纖芯(n=3.48)中，光波通過全內反射進行導光傳播。由於矽的折射率極高，光速在此處急劇下降，導致波長被壓縮至約 545 nm。',
      wavelength: '&lambda;_g &approx; 545 nm',
      frequency: '228.9 THz',
      velocity: 'v &approx; c / n_eff &approx; 1.25 &times; 10⁸ m/s',
      index: 'n_eff &approx; 2.4 - 2.5',
      orderEn: 'm = -1 (Guided)',
      orderZh: 'm = -1 (導模傳導)',
      tiltEn: '10&deg;',
      tiltZh: '10&deg;',
      math: '&lambda;_g = &lambda;₀ / n_eff = 1310 / 2.4 = 545.8 nm',
      explanationEn: 'Inside high-index waveguides, the effective index n_eff scales down velocity (v = c/n_eff) and wavelength (λ_g = λ₀/n_eff). Frequency remains unchanged.',
      explanationZh: '在波導中，有效折射率 n_eff 成為縮放比例因子。速度縮小 (v=c/n_eff) 且波長被壓縮 (λ_g=λ₀/n_eff)，但頻率不變。',
      
      camX: 680,
      camY: 155,
      zoom: 1.7
    },
    8: {
      indexStr: 'STEP 08',
      titleEn: 'OPM & OSA Diagnostics',
      titleZh: '儀器量測與波譜分析',
      narrativeEn: 'The split guided modes propagate to on-chip diagnostic instruments: Output A connects to the Optical Power Meter (OPM) to measure coupling power, and Output B connects to the Optical Spectrum Analyzer (OSA) to analyze the wavelength spectrum.',
      narrativeZh: '分路後的導模傳導至光學量測儀器：輸出端 A 連接至光功率計 (OPM) 測量耦合功率與損耗，輸出端 B 連接至光譜分析儀 (OSA) 監測光波波長與光譜分布。',
      wavelength: '545 nm',
      frequency: '228.9 THz',
      velocity: '1.25 &times; 10⁸ m/s',
      index: 'n_eff &approx; 2.4',
      orderEn: 'm = -1 (Guided)',
      orderZh: 'm = -1 (導模傳導)',
      tiltEn: '10&deg;',
      tiltZh: '10&deg;',
      math: '&lambda;_guided = 545 nm, f = 228.9 THz (Unchanged)',
      explanationEn: 'The guided signal split paths deliver optical signals to standard diagnostic units for performance verification.',
      explanationZh: '分流後的導光訊號被引導送入標準檢測與分析單元，進行耦合效能與頻譜特性驗證。',
      
      camX: 886,
      camY: 155,
      zoom: 1.6
    },
    9: {
      indexStr: 'STEP 09',
      titleEn: '3D System Overview',
      titleZh: '3D 系統總覽',
      narrativeEn: 'The complete SiPH coupling path is shown as a 3D-style system view: TLS, fiber, grating coupler, taper, silicon waveguide, splitter, OPM, and OSA are connected as one optimized optical chain.',
      narrativeZh: '完整的矽光子耦合路徑以 3D 風格總覽呈現：TLS、光纖、光柵耦合器、漸變波導、矽波導、分光器、OPM 與 OSA 形成一條最佳化光鏈路。',
      wavelength: 'System view',
      frequency: '228.9 THz',
      velocity: 'Optimized guided path',
      index: 'Matched n_eff path',
      orderEn: 'm = -1 (Guided)',
      orderZh: 'm = -1 (導模傳導)',
      tiltEn: '10&deg;',
      tiltZh: '10&deg;',
      math: 'η_total = η_grating · η_alignment · η_polarisation · η_waveguide',
      explanationEn: 'This final overview combines phase matching, alignment tolerance, polarisation, taper conversion, and diagnostics into one 3D system-level interpretation.',
      explanationZh: '此最終總覽將相位匹配、對準容差、偏振、漸變轉換與儀器診斷整合為一個 3D 系統層級解讀。',
      camX: 455,
      camY: 145,
      zoom: 1.05
    }
  };

  // Geometry coordinate segments mapping each step's path on the canvas
  const PATH_SEGMENTS = {
    1: { startX: -110, startY: 100, endX: 55, endY: 100, color: 'var(--accent-laser)' }, // Starts at DFB chip facet, propagates to Polarisation PLC at x=55
    2: { startX: 55, startY: 100, endX: 110, endY: 100, color: 'var(--accent-laser)' }, // Polarisation PLC to fiber loop interface
    3: { startX: 110, startY: 100, endX: 240, endY: 100, color: 'var(--accent-laser)' }, // fiber loop center is ~180,100
    4: { startX: 240, startY: 100, endX: 325, endY: 150, color: 'var(--accent-laser)' }, // incident beam down
    5: { startX: 325, startY: 155, endX: 430, endY: 155, color: 'var(--accent-taper)' }, // diffracted in grating slab
    6: { startX: 430, startY: 155, endX: 570, endY: 160, color: 'var(--accent-taper)' }, // taper narrowing
    7: { startX: 570, startY: 160, endX: 740, endY: 160, color: 'var(--accent-guided)' }, // narrow waveguide core
    8: { startX: 740, startY: 160, endX: 835, endY: 160, color: 'var(--accent-guided)' },  // splits and routes
    9: { startX: -110, startY: 100, endX: 920, endY: 160, color: 'var(--accent-guided)' }  // final full-system overview
  };

  function getAlignmentMetrics() {
    const tiltError = state.fiberTiltAngle - 10;
    const offsetError = state.lateralOffset;
    const gapError = state.fiberGap - 3;

    const tiltFactor = Math.exp(-Math.pow(tiltError / 4.5, 2));
    const offsetFactor = Math.exp(-Math.pow(offsetError / 2.2, 2));
    const gapFactor = Math.exp(-Math.pow(gapError / 3.0, 2));
    const alignmentFactor = tiltFactor * offsetFactor * gapFactor;

    return {
      tiltError,
      offsetError,
      gapError,
      tiltFactor,
      offsetFactor,
      gapFactor,
      alignmentFactor,
      alignmentLossDb: alignmentFactor <= 0 ? Infinity : -10 * Math.log10(alignmentFactor)
    };
  }

  // Helper to calculate wavelength, tilt angle, alignment, and waveguide dimensions combined coupling efficiency
  function getCouplingEfficiency() {
    // 1. Calculate required matching index for the grating coupler based on tilt angle and wavelength
    const sinTheta = Math.sin(state.fiberTiltAngle * Math.PI / 180);
    const targetNeff = 1.00 * sinTheta + state.laserWavelength / GRATING_PITCH_NM;
    
    // 2. Calculate actual effective index of the silicon waveguide core
    const actualNeff = getWaveguideEffectiveIndex();
    
    // 3. Compute phase mismatch and resulting coupling efficiency drop
    const dNeff = actualNeff - targetNeff;
    const baseEff = Math.exp(-Math.pow(dNeff, 2) / 0.015); // tolerance width factor 0.015 for realistic coupling curve
    
    // 4. Incorporate polarisation projection and fiber alignment tolerance.
    const phiRad = state.polarisationAngle * Math.PI / 180;
    const polFactor = Math.pow(Math.cos(phiRad), 2);
    const alignment = getAlignmentMetrics();
    
    return baseEff * polFactor * alignment.alignmentFactor;
  }

  // Helper to calculate effective index n_eff dynamically based on waveguide width and height
  function getWaveguideEffectiveIndex() {
    // Base n_eff is BASE_NEFF for 500nm width and 220nm height
    const dw = state.waveguideWidth - 500;
    const dh = state.waveguideHeight - 220;
    const neff = BASE_NEFF + 0.0015 * dw + 0.003 * dh;
    return Math.max(1.5, Math.min(3.4, neff));
  }

  // Helper to search points index in fiber coordinates based on X coordinate
  function findFiberIndex(points, xVal) {
    if (!points || !points.length) return -1;
    for (let i = 0; i < points.length; i++) {
      if (points[i] && points[i].x >= xVal) return i;
    }
    return -1;
  }

  // Highly compatible path helper for rounded rectangles on all browser canvases
  function drawRoundRectPath(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
  }

  function getLargestCanvasFont(ctx, lines, maxWidth, maxSize, minSize, weight, family) {
    for (let size = maxSize; size >= minSize; size -= 0.25) {
      ctx.font = `${weight} ${size}px ${family}`;
      if (lines.every(line => ctx.measureText(line).width <= maxWidth)) {
        return size;
      }
    }
    return minSize;
  }


  function drawSceneDepthBackdrop(ctx, width, height) {
    const isDark = state.theme === 'dark';
    const glow = ctx.createRadialGradient(width * 0.54, height * 0.42, 20, width * 0.54, height * 0.42, Math.max(width, height) * 0.78);
    glow.addColorStop(0, isDark ? 'rgba(30, 64, 175, 0.16)' : 'rgba(125, 211, 252, 0.22)');
    glow.addColorStop(0.58, isDark ? 'rgba(8, 20, 43, 0.10)' : 'rgba(255, 255, 255, 0.06)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.save();
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = -height; x < width + height; x += 44) {
      ctx.moveTo(x, height);
      ctx.lineTo(x + height * 0.72, 0);
    }
    for (let x = 0; x < width + height; x += 54) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x - height * 0.72, height);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawExtrudedRect(ctx, x, y, w, h, depthX, depthY, fill, side, top, stroke) {
    ctx.save();
    ctx.fillStyle = side;
    ctx.beginPath();
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w + depthX, y - depthY);
    ctx.lineTo(x + w + depthX, y + h - depthY);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + depthX, y - depthY);
    ctx.lineTo(x + w + depthX, y - depthY);
    ctx.lineTo(x + w, y);
    ctx.closePath();
    ctx.fill();

    const body = ctx.createLinearGradient(x, y, x, y + h);
    body.addColorStop(0, fill);
    body.addColorStop(0.52, fill);
    body.addColorStop(1, side);
    ctx.fillStyle = body;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }

  function drawExtrudedPath(ctx, pathBuilder, depthX, depthY, fill, side, top, stroke) {
    ctx.save();
    ctx.translate(depthX, -depthY);
    ctx.beginPath();
    pathBuilder(ctx);
    ctx.fillStyle = side;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(depthX * 0.45, -depthY * 0.45);
    ctx.beginPath();
    pathBuilder(ctx);
    ctx.fillStyle = top;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    pathBuilder(ctx);
    const body = ctx.createLinearGradient(320, 135, 920, 205);
    body.addColorStop(0, fill);
    body.addColorStop(0.56, fill);
    body.addColorStop(1, side);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function draw3DHighlight(ctx, x, y, w, h, radius) {
    ctx.save();
    const shine = ctx.createLinearGradient(x, y, x + w, y + h);
    shine.addColorStop(0, 'rgba(255,255,255,0.34)');
    shine.addColorStop(0.36, 'rgba(255,255,255,0.08)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    ctx.beginPath();
    drawRoundRectPath(ctx, x + 2, y + 2, Math.max(0, w - 4), Math.max(0, h * 0.38), Math.min(radius, 5));
    ctx.fill();
    ctx.restore();
  }

  function drawStep9OverviewHalo(ctx) {
    if (state.step !== 9) return;
    ctx.save();
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(0, 255, 170, 0.52)' : 'rgba(5, 150, 105, 0.45)';
    ctx.lineWidth = 2.2;
    ctx.setLineDash([8, 5]);
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(-116, 100);
    ctx.bezierCurveTo(40, 72, 180, 86, 240, 100);
    ctx.lineTo(325, 155);
    ctx.lineTo(570, 160);
    ctx.lineTo(740, 160);
    ctx.lineTo(835, 160);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = state.theme === 'dark' ? 'rgba(0, 255, 170, 0.08)' : 'rgba(5, 150, 105, 0.08)';
    ctx.beginPath();
    drawRoundRectPath(ctx, -145, 38, 1115, 220, 16);
    ctx.fill();
    ctx.restore();
  }

  function drawCenteredReadoutLines(ctx, lines, centerX, centerY, maxWidth, maxSize, minSize, color) {
    const size = getLargestCanvasFont(ctx, lines, maxWidth, maxSize, minSize, '700', '"JetBrains Mono", monospace');
    const lineGap = size * 1.38;
    const startY = centerY - ((lines.length - 1) * lineGap) / 2;

    ctx.fillStyle = color;
    ctx.font = `700 ${size}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((line, index) => ctx.fillText(line, centerX, startY + index * lineGap));
  }


  // Generate high-resolution points along the silica fiber core axis for geometry rendering & wave guiding
  function getFiberGeometry() {
    const points = [];
    
    // Segment 1: Straight line from inside FAU block (x=-92) to loop start (x=110)
    const N1 = 200;
    const dx1 = 110 - (-92);
    for (let i = 0; i <= N1; i++) {
      const t = i / N1;
      const x = -92 + t * dx1;
      const y = 100;
      points.push({ x, y, dx: dx1, dy: 0, dist: t * dx1 });
    }
    
    // Segment 2: Quadratic Bezier curve
    // P2=(110,100), P3=(150,60), P4=(180,100)
    const N2 = 150;
    let accumDist = dx1;
    let prevX = 110;
    let prevY = 100;
    for (let i = 1; i <= N2; i++) {
      const t = i / N2;
      const x = (1-t)*(1-t)*110 + 2*(1-t)*t*150 + t*t*180;
      const y = (1-t)*(1-t)*100 + 2*(1-t)*t*60 + t*t*100;
      
      const dx = 2*(1-t)*(150-110) + 2*t*(180-150);
      const dy = 2*(1-t)*(60-100) + 2*t*(100-60);
      
      const segmentLen = Math.sqrt((x - prevX)*(x - prevX) + (y - prevY)*(y - prevY));
      accumDist += segmentLen;
      prevX = x;
      prevY = y;
      
      points.push({ x, y, dx, dy, dist: accumDist });
    }
    
    // Segment 3: Quadratic Bezier curve
    // P4=(180,100), P5=(210,140), P6=(240,100)
    const N3 = 150;
    for (let i = 1; i <= N3; i++) {
      const t = i / N3;
      const x = (1-t)*(1-t)*180 + 2*(1-t)*t*210 + t*t*240;
      const y = (1-t)*(1-t)*100 + 2*(1-t)*t*140 + t*t*100;
      
      const dx = 2*(1-t)*(210-180) + 2*t*(240-210);
      const dy = 2*(1-t)*(140-100) + 2*t*(100-140);
      
      const segmentLen = Math.sqrt((x - prevX)*(x - prevX) + (y - prevY)*(y - prevY));
      accumDist += segmentLen;
      prevX = x;
      prevY = y;
      
      points.push({ x, y, dx, dy, dist: accumDist });
    }
    
    // Segment 4: Straight line to grating coupler input tip
    // P6=(240,100) to P7=(315,145) - dynamically tilted based on fiberTiltAngle
    const N4 = 100;
    const thetaDraw = (59 + (state.fiberTiltAngle - 10) * 1.0) * Math.PI / 180;
    const p7x = 240 + 45 * Math.tan(thetaDraw);
    const p7y = 145;
    const dx4 = p7x - 240;
    const dy4 = p7y - 100;
    for (let i = 1; i <= N4; i++) {
      const t = i / N4;
      const x = 240 + t * dx4;
      const y = 100 + t * dy4;
      
      const segmentLen = Math.sqrt((x - prevX)*(x - prevX) + (y - prevY)*(y - prevY));
      accumDist += segmentLen;
      prevX = x;
      prevY = y;
      
      points.push({ x, y, dx: dx4, dy: dy4, dist: accumDist });
    }
    
    return points;
  }

  // Label configuration coordinates and bilingual text for visual overlay mapping (adjusted to prevent overlaps)
  const LABELS_DATA = [
    { step: 1, textEn: 'TLS Tunable Laser Source', textZh: 'TLS 可調諧雷射光源', x: -100, y: 46, align: 'center' },
    { step: 2, textEn: 'Polarisation PLC', textZh: 'PLC 偏振控制器', x: 65, y: 72, align: 'center' },
    { step: 3, textEn: 'Silica Optical Fiber', textZh: '單模光纖傳輸', x: 180, y: 210, align: 'center' },
    { step: 5, textEn: 'Grating Coupler', textZh: '光柵耦合器', x: 360, y: 210, align: 'center' },
    { step: 6, textEn: 'Adiabatic Taper', textZh: '絕熱漸變區 (Taper)', x: 500, y: 210, align: 'center' },
    { step: 7, textEn: 'Silicon Waveguide Core', textZh: '矽波導單模纖芯', x: 650, y: 210, align: 'center' }
  ];

  // DOM Elements references
  let canvas, ctx;
  let playBtn, speedSelect, modeSelect, scrubber, prevBtn, nextBtn, rewindBtn;

  // Initialize and bind events
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Elements bindings
    canvas = getById('video-canvas');
    ctx = canvas.getContext('2d');
    
    playBtn = getById('btn-play-pause');
    speedSelect = getById('play-speed');
    modeSelect = getById('play-mode-select');
    scrubber = getById('timeline-scrubber');
    prevBtn = getById('btn-step-prev');
    nextBtn = getById('btn-step-next');
    rewindBtn = getById('btn-rewind');

    // Static parameter sliders binding
    const wlSlider = document.getElementById('param-wl-slider');
    const wlVal = document.getElementById('param-wl-val');
    const powerSlider = document.getElementById('param-power-slider');
    const powerVal = document.getElementById('param-power-val');
    const linewidthSlider = document.getElementById('param-linewidth-slider');
    const linewidthVal = document.getElementById('param-linewidth-val');
    const sweepSpeedSlider = document.getElementById('param-sweep-speed-slider');
    const sweepSpeedVal = document.getElementById('param-sweep-speed-val');
    const sweepModeSelect = document.getElementById('param-sweep-mode-select');
    const polSlider = document.getElementById('param-pol-slider');
    const polVal = document.getElementById('param-pol-val');
    const tiltSlider = document.getElementById('param-tilt-slider');
    const tiltVal = document.getElementById('param-tilt-val');
    const offsetSlider = document.getElementById('param-offset-slider');
    const offsetVal = document.getElementById('param-offset-val');
    const gapSlider = document.getElementById('param-gap-slider');
    const gapVal = document.getElementById('param-gap-val');
    const wgWidthSlider = document.getElementById('param-wg-width-slider');
    const wgWidthVal = document.getElementById('param-wg-width-val');
    const wgHeightSlider = document.getElementById('param-wg-height-slider');
    const wgHeightVal = document.getElementById('param-wg-height-val');

    wlSlider.addEventListener('input', (e) => {
      state.laserWavelength = parseFloat(e.target.value);
      state.tlsStepAccumulator = 0;
      wlVal.innerText = formatWavelength(state.laserWavelength);
      updateLabelsDisplay();
    });

    powerSlider.addEventListener('input', (e) => {
      state.laserPower = parseFloat(e.target.value);
      powerVal.innerText = `${state.laserPower.toFixed(1)}mW`;
      updateLabelsDisplay();
    });

    linewidthSlider.addEventListener('input', (e) => {
      state.tlsLinewidthMHz = parseFloat(e.target.value);
      linewidthVal.innerText = `${state.tlsLinewidthMHz.toFixed(1)}MHz`;
      updateLabelsDisplay();
    });

    sweepSpeedSlider.addEventListener('input', (e) => {
      state.tlsSweepSpeed = parseFloat(e.target.value);
      sweepSpeedVal.innerText = `${state.tlsSweepSpeed.toFixed(0)}nm/s`;
      updateLabelsDisplay();
    });

    sweepModeSelect.addEventListener('change', (e) => {
      state.tlsSweepMode = e.target.value;
      state.tlsStepAccumulator = 0;
      updateLabelsDisplay();
    });

    polSlider.addEventListener('input', (e) => {
      state.polarisationAngle = parseInt(e.target.value, 10);
      let modeText = 'TE';
      if (state.polarisationAngle === 90) {
        modeText = 'TM';
      } else if (state.polarisationAngle > 0) {
        modeText = 'Mixed';
      }
      polVal.innerText = `${state.polarisationAngle}° (${modeText})`;
      updateLabelsDisplay();
    });

    tiltSlider.addEventListener('input', (e) => {
      state.fiberTiltAngle = parseInt(e.target.value, 10);
      tiltVal.innerText = `${state.fiberTiltAngle}°`;
      updateLabelsDisplay();
    });

    offsetSlider.addEventListener('input', (e) => {
      state.lateralOffset = parseFloat(e.target.value);
      offsetVal.innerText = `${state.lateralOffset.toFixed(1)}µm`;
      updateLabelsDisplay();
    });

    gapSlider.addEventListener('input', (e) => {
      state.fiberGap = parseFloat(e.target.value);
      gapVal.innerText = `${state.fiberGap.toFixed(1)}µm`;
      updateLabelsDisplay();
    });

    wgWidthSlider.addEventListener('input', (e) => {
      state.waveguideWidth = parseInt(e.target.value, 10);
      wgWidthVal.innerText = `${state.waveguideWidth}nm`;
      updateLabelsDisplay();
    });

    wgHeightSlider.addEventListener('input', (e) => {
      state.waveguideHeight = parseInt(e.target.value, 10);
      wgHeightVal.innerText = `${state.waveguideHeight}nm`;
      updateLabelsDisplay();
    });

    // 2. Playback Speed configurations
    speedSelect.addEventListener('change', () => {
      if (state.isPlaying) {
        lastFrameTime = performance.now();
      }
    });

    // 3. Play Mode configuration
    modeSelect.addEventListener('change', (e) => {
      state.playMode = e.target.value;
    });

    // 4. Play/Pause toggle
    playBtn.addEventListener('click', togglePlay);

    // 5. Scrubber control
    scrubber.addEventListener('input', (e) => {
      const s = parseInt(e.target.value, 10);
      setStep(s);
    });

    // 6. Stepper buttons
    prevBtn.addEventListener('click', () => {
      setStep(state.step - 1);
    });

    nextBtn.addEventListener('click', () => {
      setStep(state.step + 1);
    });

    rewindBtn.addEventListener('click', () => {
      setStep(1);
    });

    // Timeline ticks click handlers
    document.querySelectorAll('.timeline-ticks .tick').forEach(tick => {
      tick.addEventListener('click', () => {
        setStep(parseInt(tick.dataset.step, 10));
      });
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'SELECT') return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        setStep(state.step + 1);
      } else if (e.key === 'ArrowLeft') {
        setStep(state.step - 1);
      }
    });

    // 7. Lang/Theme Toggles
    document.getElementById('global-reset-btn').addEventListener('click', resetAllParameters);

    document.getElementById('lang-toggle-btn').addEventListener('click', () => {
      document.body.classList.remove(`lang-${state.language}`);
      state.language = state.language === 'en' ? 'zh' : 'en';
      document.body.classList.add(`lang-${state.language}`);
      
      const langBtn = getById('lang-toggle-btn');
      langBtn.querySelector('.lang-en-only').style.display = state.language === 'en' ? '' : 'none';
      langBtn.querySelector('.lang-zh-only').style.display = state.language === 'zh' ? '' : 'none';
      
      updateLabelsDisplay();
    });

    document.getElementById('theme-toggle-btn').addEventListener('click', () => {
      document.body.classList.remove(`${state.theme}-theme`);
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      document.body.classList.add(`${state.theme}-theme`);
      
      document.getElementById('theme-toggle-btn').innerText = state.theme === 'dark' ? '☀️' : '🌙';
    });

    // Resize canvas
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Set initial camera target coordinates immediately
    const data = STEPS_DATA[state.step];
    state.cameraX = data.camX;
    state.cameraY = data.camY;
    state.cameraZoom = data.zoom;

    // Boot Animations
    boot();
  });

  // ==========================================================================
  // Layout updates
  // ==========================================================================
  function setStep(s) {
    s = parseInt(s, 10);
    if (isNaN(s) || s < STEP_MIN || s > STEP_MAX) return;
    state.step = s;
    document.body.dataset.step = String(s);
    state.pulseProgress = 0; // reset pulse tracking


    
    // Update Scrubber and navigational highlights
    scrubber.value = s;
    
    document.querySelectorAll('.step-nav-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.step, 10) === s);
    });

    document.querySelectorAll('.timeline-ticks .tick').forEach(tick => {
      tick.classList.toggle('active', parseInt(tick.dataset.step, 10) === s);
    });

    updateLabelsDisplay();
  }

  function updateLabelsDisplay() {
    const data = STEPS_DATA[state.step];
    
    // Step Titles and text narratives
    document.getElementById('step-title').innerText = state.language === 'en' ? data.titleEn : data.titleZh;
    document.querySelector('.step-index-badge').innerText = data.indexStr;
    document.getElementById('step-narrative').innerText = state.language === 'en' ? data.narrativeEn : data.narrativeZh;
    document.getElementById('anchor-step-label').innerText = `${data.indexStr}: ${state.language === 'en' ? data.titleEn : data.titleZh}`;

    // Update slider UI values to match the current state
    const wlSlider = document.getElementById('param-wl-slider');
    const wlVal = document.getElementById('param-wl-val');
    wlSlider.value = state.laserWavelength;
    wlVal.innerText = formatWavelength(state.laserWavelength);

    const powerSlider = document.getElementById('param-power-slider');
    const powerVal = document.getElementById('param-power-val');
    powerSlider.value = state.laserPower;
    powerVal.innerText = `${state.laserPower.toFixed(1)}mW`;

    const linewidthSlider = document.getElementById('param-linewidth-slider');
    const linewidthVal = document.getElementById('param-linewidth-val');
    linewidthSlider.value = state.tlsLinewidthMHz;
    linewidthVal.innerText = `${state.tlsLinewidthMHz.toFixed(1)}MHz`;

    const sweepSpeedSlider = document.getElementById('param-sweep-speed-slider');
    const sweepSpeedVal = document.getElementById('param-sweep-speed-val');
    sweepSpeedSlider.value = state.tlsSweepSpeed;
    sweepSpeedVal.innerText = `${state.tlsSweepSpeed.toFixed(0)}nm/s`;

    const sweepModeSelect = document.getElementById('param-sweep-mode-select');
    sweepModeSelect.value = state.tlsSweepMode;

    const tiltSlider = document.getElementById('param-tilt-slider');
    const tiltVal = document.getElementById('param-tilt-val');
    tiltSlider.value = state.fiberTiltAngle;
    tiltVal.innerText = `${state.fiberTiltAngle}°`;

    const offsetSlider = document.getElementById('param-offset-slider');
    const offsetVal = document.getElementById('param-offset-val');
    offsetSlider.value = state.lateralOffset;
    offsetVal.innerText = `${state.lateralOffset.toFixed(1)}µm`;

    const gapSlider = document.getElementById('param-gap-slider');
    const gapVal = document.getElementById('param-gap-val');
    gapSlider.value = state.fiberGap;
    gapVal.innerText = `${state.fiberGap.toFixed(1)}µm`;

    // Manage slider values and visibility
    const wgWidthSlider = document.getElementById('param-wg-width-slider');
    const wgWidthVal = document.getElementById('param-wg-width-val');
    wgWidthSlider.value = state.waveguideWidth;
    wgWidthVal.innerText = `${state.waveguideWidth}nm`;

    const wgHeightSlider = document.getElementById('param-wg-height-slider');
    const wgHeightVal = document.getElementById('param-wg-height-val');
    wgHeightSlider.value = state.waveguideHeight;
    wgHeightVal.innerText = `${state.waveguideHeight}nm`;

    const polSlider = document.getElementById('param-pol-slider');
    const polVal = document.getElementById('param-pol-val');
    polSlider.value = state.polarisationAngle;
    let modeText = 'TE';
    if (state.polarisationAngle === 90) {
      modeText = 'TM';
    } else if (state.polarisationAngle > 0) {
      modeText = 'Mixed';
    }
    polVal.innerText = `${state.polarisationAngle}° (${modeText})`;

    // Toggle card-level displays
    const cardPol = document.getElementById('card-pol-angle');
    if (state.step >= 2) {
      cardPol.style.display = 'flex';
    } else {
      cardPol.style.display = 'none';
    }

    const cardTilt = document.getElementById('card-tilt-angle');
    const cardOffset = document.getElementById('card-lateral-offset');
    const cardGap = document.getElementById('card-fiber-gap');
    if (state.step >= 4) {
      cardTilt.style.display = 'flex';
      cardOffset.style.display = 'flex';
      cardGap.style.display = 'flex';
    } else {
      cardTilt.style.display = 'none';
      cardOffset.style.display = 'none';
      cardGap.style.display = 'none';
    }

    const cardWgWidth = document.getElementById('card-wg-width');
    const cardWgHeight = document.getElementById('card-wg-height');
    if (state.step >= 7) { // shifted from 6 to 7
      cardWgWidth.style.display = 'flex';
      cardWgHeight.style.display = 'flex';
    } else {
      cardWgWidth.style.display = 'none';
      cardWgHeight.style.display = 'none';
    }

    // Dynamic Parameter calculations
    // 1. Frequency (constant c / lambda)
    const freq = (C_NM_PER_PS / state.laserWavelength).toFixed(1);
    document.getElementById('param-frequency').innerText = `${freq} THz`;

    // 2. Phase Velocity (c/n)
    let velocityText;
    if (state.step <= 5) { // shifted from 4 to 5
      velocityText = '3.00 × 10⁸ m/s';
    } else if (state.step === 6) { // shifted from 5 to 6
      velocityText = state.language === 'en' ? 'Decreasing' : '漸減';
    } else {
      const neff = getWaveguideEffectiveIndex();
      const v = (C / neff / 1e8).toFixed(2);
      velocityText = `${v} × 10⁸ m/s`;
    }
    document.getElementById('param-velocity').innerText = velocityText;

    // 3. Refractive Index
    let indexText;
    if (state.step === 1) {
      indexText = state.language === 'en' ? '1.00 (Vacuum)' : '1.00 (真空)';
    } else if (state.step === 2 || state.step === 3) {
      indexText = state.language === 'en' ? '1.45 (Silica core)' : '1.45 (二氧化矽纖芯)';
    } else if (state.step === 4) {
      indexText = state.language === 'en' ? '1.00 (Air output / Cladding gap)' : '1.00 (空氣輸出 / 包層空隙)';
    } else if (state.step === 5) {
      indexText = state.language === 'en' ? 'Frequency constant' : '頻率保持恆定';
    } else if (state.step === 6) {
      indexText = state.language === 'en' ? 'n_eff smoothly increases' : 'n_eff 漸增';
    } else {
      const neff = getWaveguideEffectiveIndex();
      indexText = `n_eff ≈ ${neff.toFixed(2)}`;
    }
    document.getElementById('param-index').innerText = indexText;

    // 4. Coupling Efficiency
    let effText = '';
    let couplingEfficiencyPercent = null;
    if (state.step >= 4) {
      const eff = getCouplingEfficiency();
      couplingEfficiencyPercent = eff * 100;
      effText = `${couplingEfficiencyPercent.toFixed(1)}%`;
    } else {
      effText = state.language === 'en' ? 'N/A' : '無';
    }
    document.getElementById('param-efficiency').innerText = effText;
    const efficiencyTile = document.getElementById('coupling-efficiency-tile');
    if (efficiencyTile) {
      efficiencyTile.classList.toggle('calculation-warning', couplingEfficiencyPercent !== null && couplingEfficiencyPercent < 90);
    }

    const alignmentLossEl = document.getElementById('param-alignment-loss');
    const alignmentLossTile = document.getElementById('alignment-loss-tile');
    let alignmentLossDb = null;
    if (alignmentLossEl) {
      if (state.step >= 4) {
        const alignment = getAlignmentMetrics();
        alignmentLossDb = alignment.alignmentLossDb;
        alignmentLossEl.innerText = `${alignmentLossDb.toFixed(2)} dB`;
      } else {
        alignmentLossEl.innerText = state.language === 'en' ? 'N/A' : '無';
      }
    }
    if (alignmentLossTile) {
      alignmentLossTile.classList.toggle('calculation-warning', alignmentLossDb !== null && alignmentLossDb > 2);
    }


    // 5. Diffraction Order
    if (state.step >= 5) {
      document.getElementById('param-order').innerText = state.language === 'en' ? 'm = -1 (Guided)' : 'm = -1 (導模傳導)';
    } else {
      document.getElementById('param-order').innerText = state.language === 'en' ? 'N/A' : '無';
    }

    // Mathematical formula block & explanation
    updateStepMathAndFormulas();
  }

  function updateStepMathAndFormulas() {
    const data = STEPS_DATA[state.step];
    const mathEl = document.getElementById('formula-math');
    const explEl = document.getElementById('formula-explanation');
    const wl = state.laserWavelength;
    const freq = (C_NM_PER_PS / wl).toFixed(1);
    
    if (state.step === 1) {
      mathEl.innerHTML = `f = c / &lambda;₀ = 3.00 &times; 10⁸ / (${wl.toFixed(1)} &times; 10⁻⁹) = ${freq} THz`;
      explEl.innerText = state.language === 'en'
        ? `TLS source: λ₀ = ${wl.toFixed(1)} nm, power = ${state.laserPower.toFixed(1)} mW, linewidth = ${state.tlsLinewidthMHz.toFixed(1)} MHz, sweep mode = ${state.tlsSweepMode}, tuning speed = ${state.tlsSweepSpeed.toFixed(0)} nm/s.`
        : `TLS 光源：λ₀ = ${wl.toFixed(1)} nm，功率 = ${state.laserPower.toFixed(1)} mW，線寬 = ${state.tlsLinewidthMHz.toFixed(1)} MHz，掃描模式 = ${state.tlsSweepMode}，調諧速度 = ${state.tlsSweepSpeed.toFixed(0)} nm/s。`;
    } else if (state.step === 2) {
      mathEl.innerHTML = `P<sub>TE</sub> = P<sub>in</sub> &middot; cos²(&phi;), &nbsp; P<sub>TM</sub> = P<sub>in</sub> &middot; sin²(&phi;)`;
      explEl.innerText = state.language === 'en' ? data.explanationEn : data.explanationZh;
    } else if (state.step === 3) {
      mathEl.innerHTML = `&lambda;<sub>fiber</sub> = &lambda;₀ = ${wl} nm`;
      explEl.innerText = state.language === 'en'
        ? `Light remains guided within the optical fiber core with constant wavelength of ${wl} nm.`
        : `光束在單模光纖纖芯中傳導，維持 ${wl} nm 的波長恆定傳輸。`;
    } else if (state.step === 5) {
      const theta = state.fiberTiltAngle;
      const sinTheta = Math.sin(theta * Math.PI / 180);
      const targetNeff = (1.00 * sinTheta + wl / GRATING_PITCH_NM).toFixed(2);
      const eff = getCouplingEfficiency();
      const effPercent = (eff * 100).toFixed(1);
      
      mathEl.innerHTML = `n<sub>eff</sub> = 1.00 &middot; sin(${theta}&deg;) - (-1) &middot; (${wl} / ${GRATING_PITCH_NM}) = ${targetNeff}`;
      const alignment = getAlignmentMetrics();
      explEl.innerText = state.language === 'en'
        ? `At θ_in = ${theta}°, Δx = ${state.lateralOffset.toFixed(1)} µm, and gap = ${state.fiberGap.toFixed(1)} µm, the target n_eff is ${targetNeff}. Alignment loss is ${alignment.alignmentLossDb.toFixed(2)} dB and coupling efficiency is ${effPercent}%.`
        : `當 θ_in = ${theta}°、Δx = ${state.lateralOffset.toFixed(1)} µm、間距 = ${state.fiberGap.toFixed(1)} µm 時，目標 n_eff = ${targetNeff}。對準損耗為 ${alignment.alignmentLossDb.toFixed(2)} dB，耦合效率為 ${effPercent}%。`;
    } else if (state.step === 6) {
      const neff = getWaveguideEffectiveIndex();
      mathEl.innerHTML = `|dn<sub>eff</sub>/dz| &ll; 2&pi;/&lambda;₀, &nbsp; n<sub>eff</sub> target &rarr; ${neff.toFixed(2)}`;
      explEl.innerText = state.language === 'en'
        ? `The taper changes geometry slowly enough for the optical mode to follow the local effective index toward ${neff.toFixed(2)} without scattering into radiation modes.`
        : `漸變區讓幾何變化足夠緩慢，使光模態可跟隨局部有效折射率至 ${neff.toFixed(2)}，避免散射至輻射模態。`;
    } else if (state.step === 7) {
      const neff = getWaveguideEffectiveIndex();
      const wlGuided = (wl / neff).toFixed(1);
      mathEl.innerHTML = `&lambda;<sub>g</sub> = &lambda;₀ / n<sub>eff</sub> = ${wl} / ${neff.toFixed(2)} = ${wlGuided} nm`;
      explEl.innerText = state.language === 'en'
        ? `Inside high-index waveguides, the effective index n_eff (${neff.toFixed(2)}) scales down velocity (v = c/n_eff) and wavelength (λ_g = ${wlGuided} nm). Frequency remains unchanged.`
        : `在矽波導中，有效折射率 n_eff (${neff.toFixed(2)}) 成為縮放比例因子。速度縮小且波長被壓縮至 ${wlGuided} nm，但頻率不變。`;
    } else if (state.step === 8) {
      const neff = getWaveguideEffectiveIndex();
      const wlGuided = (wl / neff).toFixed(1);
      mathEl.innerHTML = `&lambda;<sub>guided</sub> = ${wlGuided} nm, &nbsp; f = ${freq} THz (Unchanged)`;
      explEl.innerText = state.language === 'en'
        ? `The guided signal split paths deliver optical signals to standard diagnostic units for performance verification. Wavelength is compressed to ${wlGuided} nm.`
        : `分流後的導光訊號被引導送入標準檢測與分析單元，進行耦合效能與頻譜特性驗證。波長被壓縮至 ${wlGuided} nm。`;
    } else if (state.step === 9) {
      const eff = (getCouplingEfficiency() * 100).toFixed(1);
      const alignment = getAlignmentMetrics();
      mathEl.innerHTML = `&eta;<sub>total</sub> = ${eff}%;&nbsp; L<sub>align</sub> = ${alignment.alignmentLossDb.toFixed(2)} dB`;
      explEl.innerText = state.language === 'en'
        ? `3D overview: full optical path is optimized when polarisation is TE, alignment loss is low, and coupling efficiency is near 100%.`
        : `3D 總覽：當偏振為 TE、對準損耗低且耦合效率接近 100% 時，完整光路達到最佳化。`;
    } else {
      mathEl.innerHTML = data.math;
      explEl.innerText = state.language === 'en' ? data.explanationEn : data.explanationZh;
    }
  }

  // ==========================================================================
  // Media Playback interval controllers
  // ==========================================================================
  let lastFrameTime = performance.now();

  function togglePlay() {
    if (state.isPlaying) {
      pauseVideo();
    } else {
      playVideo();
    }
  }

  function playVideo() {
    if (state.isPlaying) return;
    state.isPlaying = true;

    playBtn.classList.add('playing');
    playBtn.querySelector('.play-icon').style.display = 'none';
    playBtn.querySelector('.pause-icon').style.display = 'inline';

    lastFrameTime = performance.now();
  }

  function pauseVideo() {
    if (!state.isPlaying) return;
    state.isPlaying = false;

    playBtn.classList.remove('playing');
    playBtn.querySelector('.play-icon').style.display = 'inline';
    playBtn.querySelector('.pause-icon').style.display = 'none';

  }

  function updatePlayback(deltaMs) {
    if (!state.isPlaying) return;
    updateTlsSweep(deltaMs);
    const speed = SPEED_CONFIGS[speedSelect.value] || SPEED_CONFIGS.normal;
    state.pulseProgress += (deltaMs / STEP_DURATION_MS) * speed;

    while (state.pulseProgress >= 1) {
      state.pulseProgress -= 1;

      if (state.playMode === 'movie') {
        setStep(state.step < STEP_MAX ? state.step + 1 : STEP_MIN);
      }
    }
  }

  function updateTlsSweep(deltaMs) {
    if (state.tlsSweepMode === 'off') return;

    const deltaNm = state.tlsSweepSpeed * deltaMs / 1000;
    if (state.tlsSweepMode === 'continuous') {
      state.laserWavelength += deltaNm * state.tlsSweepDirection;
    } else {
      state.tlsStepAccumulator += deltaNm;
      if (state.tlsStepAccumulator < TLS_STEP_NM) return;
      const steps = Math.floor(state.tlsStepAccumulator / TLS_STEP_NM);
      state.tlsStepAccumulator -= steps * TLS_STEP_NM;
      state.laserWavelength += steps * TLS_STEP_NM * state.tlsSweepDirection;
    }

    if (state.laserWavelength >= TLS_MAX_WAVELENGTH) {
      state.laserWavelength = TLS_MAX_WAVELENGTH;
      state.tlsSweepDirection = -1;
    } else if (state.laserWavelength <= TLS_MIN_WAVELENGTH) {
      state.laserWavelength = TLS_MIN_WAVELENGTH;
      state.tlsSweepDirection = 1;
    }

    updateLabelsDisplay();
  }

  // ==========================================================================
  // Canvas Geometry and Animation Loop
  // ==========================================================================
  function resizeCanvas() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const displayWidth = Math.max(1, Math.floor(canvas.parentElement.clientWidth));
    const displayHeight = Math.max(1, Math.floor(canvas.parentElement.clientHeight));
    const pixelWidth = Math.round(displayWidth * dpr);
    const pixelHeight = Math.round(displayHeight * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function boot() {
    // Bind Step clicks
    document.querySelectorAll('.step-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        setStep(parseInt(btn.dataset.step, 10));
      });
    });

    setStep(state.step);
    requestAnimationFrame(animationLoop);
  }

  function animationLoop(timestamp) {
    const deltaMs = clamp(timestamp - lastFrameTime, 0, 100);
    lastFrameTime = timestamp;

    // Auto-resize canvas if container dimensions change or are computed post-load.
    resizeCanvas();
    updatePlayback(deltaMs);

    const width = canvas.width / window.devicePixelRatio;
    const height = canvas.height / window.devicePixelRatio;

    // Clear and fill Canvas with grey background color
    const colors = THEME_COLORS[state.theme];
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, width, height);
    drawSceneDepthBackdrop(ctx, width, height);


    // 1. Camera Panning Interpolation (Smooth tracking of the step camera targets)
    const targetData = STEPS_DATA[state.step];
    state.cameraX += (targetData.camX - state.cameraX) * 0.06;
    state.cameraY += (targetData.camY - state.cameraY) * 0.06;
    state.cameraZoom += (targetData.zoom - state.cameraZoom) * 0.06;

    ctx.save();
    
    // Center camera on active coordinate target
    ctx.translate(width / 2, height / 2);
    ctx.scale(state.cameraZoom, state.cameraZoom);
    ctx.translate(-state.cameraX, -state.cameraY);

    // 2. Draw static components
    drawWaveguideStaticGeometry(ctx);
    drawStep9OverviewHalo(ctx);

    // 3. Draw active wave propagation
    drawOpticalWaves(ctx);

    // 4. Draw glowing HUD camera target box (Disabled as per user request to remove 'frame' indicate)
    // drawCameraHUDOutline(ctx, targetData);

    // 5. Draw descriptive text labels and pointers directly on canvas components
    drawComponentLabels(ctx);

    // 6. Draw detailed physical representation of diffraction, reflections, and phase-matching (Step 4 details)
    drawDiffractionDetails(ctx);

    // 7. Draw optical tilt angle indicator and cavity back-reflection explanation (Step 3 details)
    drawTiltAngleIndicator(ctx);

    ctx.restore();

    // 8. Draw dynamic parameters display bar directly on the canvas (green text font)
    drawHUDParameters(ctx, width, height);

    // Increment wave phase offset over time for propagation
    state.wavePhase += 0.08;

    requestAnimationFrame(animationLoop);
  }

  function drawHUDParameters(ctx, width, height) {
    const boxW = Math.min(width - 24, state.language === 'en' ? 820 : 620);
    const boxH = width < 760 ? 40 : 46;
    const boxX = (width - boxW) / 2;
    const boxY = height - boxH - 18; // 18px margin from bottom edge of canvas

    const isLight = state.theme === 'light';
    const borderCol = isLight ? 'rgba(5, 150, 105, 0.4)' : 'rgba(0, 255, 170, 0.3)';
    const textCol = isLight ? '#059669' : '#00ffaa';
    
    ctx.beginPath();
    drawRoundRectPath(ctx, boxX, boxY, boxW, boxH, 6);

    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(7, 13, 26, 0.84)';
    ctx.strokeStyle = borderCol;
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = textCol;
    if (!isLight) {
      ctx.shadowColor = 'rgba(0, 255, 170, 0.35)';
      ctx.shadowBlur = 6;
    }
    ctx.font = `bold ${width < 760 ? 13 : 20}px "Orbitron", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let effText = '';
    if (state.step >= 4) {
      const eff = getCouplingEfficiency();
      effText = `${(eff * 100).toFixed(1)}%`;
    } else {
      effText = state.language === 'en' ? 'N/A' : '無';
    }

    const displayText = state.language === 'en'
      ? `POWER ${state.laserPower.toFixed(1)} mW  |  EFFICIENCY ${effText}`
      : `功率 ${state.laserPower.toFixed(1)} mW  |  效率 ${effText}`;

    ctx.fillText(displayText, width / 2, boxY + boxH / 2);

    if (!isLight) {
      ctx.shadowBlur = 0;
    }
  }

  // Draw static silicon photonics structure
  function drawWaveguideStaticGeometry(ctx) {
    // Styling tags depending on theme mode
    const colors = THEME_COLORS[state.theme];
    const coreColor = colors.core;
    const silicaColor = colors.silica;
    const borderColor = colors.border;
    const eff = getCouplingEfficiency();
    
    ctx.save();

    // 1. 3D SOI wafer stack: BOX layer over bulk silicon with bevel and side depth.
    ctx.shadowColor = state.theme === 'dark' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(15, 23, 42, 0.22)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 10;
    ctx.shadowOffsetY = 12;
    drawExtrudedRect(ctx, 320, 155, 600, 40, 18, 10, colors.bulkSilicon, state.theme === 'dark' ? '#334155' : '#aebccc', state.theme === 'dark' ? '#dbeafe' : '#ffffff', borderColor);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    const boxGrad = ctx.createLinearGradient(320, 155, 320, 170);
    boxGrad.addColorStop(0, '#ffffff');
    boxGrad.addColorStop(1, silicaColor);
    ctx.fillStyle = boxGrad;
    ctx.fillRect(320, 155, 600, 15);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(320, 170);
    ctx.lineTo(920, 170);
    ctx.stroke();

    // Grating Coupler Profile (sawtooth or rectangular grooves)
    ctx.fillStyle = coreColor;
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    
    // Draw Grating grooves
    const grooveX = 325;
    const grooveY = 155;
    const grooveW = 8;
    const grooveH = 6;
    const period = 16;
    const count = 7;
    
    const gratingPath = (pctx) => {
      pctx.moveTo(grooveX, grooveY);
      for (let i = 0; i < count; i++) {
        pctx.lineTo(grooveX + i * period, grooveY);
        pctx.lineTo(grooveX + i * period, grooveY + grooveH);
        pctx.lineTo(grooveX + i * period + grooveW, grooveY + grooveH);
        pctx.lineTo(grooveX + i * period + grooveW, grooveY);
      }
      pctx.lineTo(grooveX + count * period, grooveY);
      pctx.lineTo(grooveX + count * period, grooveY + 15);
      pctx.lineTo(grooveX, grooveY + 15);
      pctx.closePath();
    };
    drawExtrudedPath(ctx, gratingPath, 8, 5, coreColor, state.theme === 'dark' ? '#172033' : '#3d4d62', state.theme === 'dark' ? '#5f7390' : '#93a7bd', borderColor);

    // Dynamic waveguide height thickness calculation (base: 10 units at 220nm)
    const scaleH = state.waveguideHeight / 220;
    const coreThickness = 10 * scaleH;
    const coreY1 = 160 - 5 * scaleH;
    const coreY2 = 160 + 5 * scaleH;

    // Adiabatic Taper (slanted transition)
    // Connecting grating block (grooveX + count * period = 437) to narrow waveguide (570)
    const taperPath = (pctx) => {
      pctx.moveTo(437, grooveY);
      pctx.lineTo(570, coreY1);
      pctx.lineTo(570, coreY2);
      pctx.lineTo(437, 170);
      pctx.closePath();
    };
    drawExtrudedPath(ctx, taperPath, 8, 5, coreColor, state.theme === 'dark' ? '#172033' : '#3d4d62', state.theme === 'dark' ? '#64748b' : '#a3b3c5', borderColor);

    // Waveguide Core (Silicon Core n = 3.48)
    // thin channel starting from 570 to splitter at 740
    drawExtrudedRect(ctx, 570, coreY1, 170, coreThickness, 8, 5, coreColor, state.theme === 'dark' ? '#172033' : '#3d4d62', state.theme === 'dark' ? '#64748b' : '#a3b3c5', borderColor);

    // Splitter port (Y-junction split to devices)
    const topBranchY1 = 112 - 2 * scaleH;
    const topBranchY2 = 112 + 2 * scaleH;
    const bottomBranchY1 = 198 - 2 * scaleH;
    const bottomBranchY2 = 198 + 2 * scaleH;

    const splitterPath = (pctx) => {
    pctx.moveTo(740, coreY1);
    ctx.lineTo(760, 160 - 5 * scaleH); // Top transition slope boundary
    // top branch
    ctx.lineTo(790, topBranchY1);
    ctx.lineTo(835, topBranchY1);
    ctx.lineTo(835, topBranchY2);
    ctx.lineTo(792, topBranchY2);
    ctx.lineTo(760, 160); // split center point
    // bottom branch
    ctx.lineTo(792, bottomBranchY1);
    ctx.lineTo(835, bottomBranchY1);
    ctx.lineTo(835, bottomBranchY2);
    ctx.lineTo(790, bottomBranchY2);
    ctx.lineTo(760, 160 + 5 * scaleH); // Bottom transition slope boundary
    pctx.lineTo(740, coreY2);
    pctx.closePath();
    };
    drawExtrudedPath(ctx, splitterPath, 8, 5, coreColor, state.theme === 'dark' ? '#172033' : '#3d4d62', state.theme === 'dark' ? '#64748b' : '#a3b3c5', borderColor);

    // Optical Power Meter (OPM) Instrument (Output A, top branch) - Scaled Larger
    ctx.save();
    ctx.fillStyle = '#1e293b'; // dark slate case
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    drawRoundRectPath(ctx, 835, 55, 120, 92, 6);
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 7;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();
    draw3DHighlight(ctx, 835, 55, 120, 92, 6);
    
    // OPM Screen
    ctx.fillStyle = '#070814'; // black screen
    ctx.fillRect(844, 64, 102, 46);
    
    // OPM reading text (calculated input & coupled output power readout)
    const coupledPower = state.laserPower * eff;
    const pinText = `P_in  = ${state.laserPower.toFixed(2)} mW`;
    const poutMwText = `P_out = ${coupledPower.toFixed(2)} mW`;
    const poutDbmText = `      = ${coupledPower <= 0 ? '-Inf' : (10 * Math.log10(coupledPower)).toFixed(2)} dBm`;

    drawCenteredReadoutLines(ctx, [pinText, poutMwText, poutDbmText], 895, 87, 90, 7.4, 3.2, '#00ffaa');
    
    // OPM Labels & button indicators
    const opmLabelSize = getLargestCanvasFont(ctx, ['OPM'], 52, 7.5, 2.5, '800', '"Orbitron", sans-serif');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.font = `800 ${opmLabelSize}px "Orbitron", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OPM', 895, 135);
    
    // buttons
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(862, 135, 2.0, 0, Math.PI * 2);
    ctx.arc(874, 135, 2.0, 0, Math.PI * 2);
    ctx.fill();
    // red LED indicator
    ctx.fillStyle = state.isPlaying ? '#ff2a5f' : '#475569';
    ctx.beginPath();
    ctx.arc(928, 135, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Optical Spectrum Analyzer (OSA) Instrument (Output B, bottom branch) - Scaled larger to accommodate readouts
    ctx.save();
    ctx.fillStyle = '#1e293b'; // dark slate case
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    drawRoundRectPath(ctx, 835, 152, 120, 92, 6);
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 7;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();
    draw3DHighlight(ctx, 835, 152, 120, 92, 6);
    
    // OSA Screen
    ctx.fillStyle = '#070814'; // black screen
    ctx.fillRect(844, 161, 102, 46);

    // Draw light dotted grid lines on screen
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'; // visible white grid
    ctx.lineWidth = 0.4;
    ctx.setLineDash([1, 1.5]); // dotted style
    ctx.beginPath();
    // 3 Horizontal lines
    for (let gy = 161 + 11.5; gy < 207; gy += 11.5) {
      ctx.moveTo(844, gy);
      ctx.lineTo(946, gy);
    }
    // 5 Vertical lines
    for (let gx = 844 + 17; gx < 946; gx += 17) {
      ctx.moveTo(gx, 161);
      ctx.lineTo(gx, 207);
    }
    ctx.stroke();
    ctx.restore();
    
    // OSA Spectrum peak rendering (intensity scales with coupling efficiency and power, center shifts with wavelength)
    const screenLeft = 848;
    const screenRight = 942;
    const screenBottom = 205;
    const peakCenter = 895 + (state.laserWavelength - 1310) * 0.36;
    const peakHeight = 32 * eff * (state.laserPower / 10);
    const linewidthSigma = 72 + state.tlsLinewidthMHz * 7;

    ctx.strokeStyle = '#00ffaa'; // glowing spectral trace
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(screenLeft, screenBottom);
    for (let sx = screenLeft; sx <= screenRight; sx++) {
      const g = Math.exp(-Math.pow(sx - peakCenter, 2) / linewidthSigma);
      const sy = screenBottom - g * peakHeight;
      ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // OSA readouts: placed around the spectrum trace for clearer interpretation.
    const peakValText = coupledPower <= 0 ? '-Inf dBm' : `${(10 * Math.log10(coupledPower)).toFixed(2)} dBm`;
    const peakText = `PEAK ${peakValText}`;
    const noiseText = 'NOISE -60.00 dBm';

    ctx.save();
    ctx.fillStyle = '#00ffaa';
    ctx.textBaseline = 'middle';

    const peakFontSize = getLargestCanvasFont(ctx, [peakText], 76, 5.8, 3.2, '700', '"JetBrains Mono", monospace');
    ctx.font = `700 ${peakFontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(peakText, peakCenter, 169);

    const noiseFontSize = getLargestCanvasFont(ctx, [noiseText], 72, 5.8, 3.2, '700', '"JetBrains Mono", monospace');
    ctx.font = `700 ${noiseFontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(noiseText, screenLeft + 2, 197);
    ctx.restore();
    
    // OSA Labels & buttons
    const osaLabelSize = getLargestCanvasFont(ctx, ['OSA'], 52, 7.5, 2.5, '800', '"Orbitron", sans-serif');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.font = `800 ${osaLabelSize}px "Orbitron", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('OSA', 895, 232);
    
    // buttons
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(862, 232, 2.0, 0, Math.PI * 2);
    ctx.arc(874, 232, 2.0, 0, Math.PI * 2);
    ctx.fill();
    // green active LED indicator
    ctx.fillStyle = state.isPlaying ? '#00ffaa' : '#475569';
    ctx.beginPath();
    ctx.arc(928, 232, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Fiber Cladding & Core Double coaxial layers using calculated normal vector offsets
    const fiberPoints = getFiberGeometry();
    const R_clad = 10;
    const R_core = 2.5;

    // 1. Draw Cladding Glass Fill
    ctx.save();
    ctx.beginPath();
    
    // Top cladding boundary from start to end
    const pt0 = fiberPoints[0];
    const len0 = Math.sqrt(pt0.dx*pt0.dx + pt0.dy*pt0.dy);
    const nx0 = -pt0.dy / len0;
    const ny0 = pt0.dx / len0;
    ctx.moveTo(pt0.x - nx0 * R_clad, pt0.y - ny0 * R_clad);
    
    for (let i = 1; i < fiberPoints.length; i++) {
      const pt = fiberPoints[i];
      const len = Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy);
      const nx = -pt.dy / len;
      const ny = pt.dx / len;
      ctx.lineTo(pt.x - nx * R_clad, pt.y - ny * R_clad);
    }
    
    // End facet (at fiber tip)
    const ptLast = fiberPoints[fiberPoints.length - 1];
    const lenLast = Math.sqrt(ptLast.dx*ptLast.dx + ptLast.dy*ptLast.dy);
    const nxLast = -ptLast.dy / lenLast;
    const nyLast = ptLast.dx / lenLast;
    ctx.lineTo(ptLast.x + nxLast * R_clad, ptLast.y + nyLast * R_clad);
    
    // Bottom cladding boundary from end to start
    for (let i = fiberPoints.length - 2; i >= 0; i--) {
      const pt = fiberPoints[i];
      const len = Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy);
      const nx = -pt.dy / len;
      const ny = pt.dx / len;
      ctx.lineTo(pt.x + nx * R_clad, pt.y + ny * R_clad);
    }
    ctx.closePath();
    
    // Cladding background fill with subtle 3D glass depth.
    ctx.shadowColor = state.theme === 'dark' ? 'rgba(0, 0, 0, 0.32)' : 'rgba(15, 23, 42, 0.18)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = state.theme === 'dark' ? 'rgba(78, 87, 155, 0.22)' : 'rgba(148, 163, 184, 0.18)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Cladding borders (outer glass walls)
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(78, 87, 155, 0.5)' : 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1.0;
    
    // Glossy upper highlight and tube borders.
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(pt0.x - nx0 * (R_clad - 2.2), pt0.y - ny0 * (R_clad - 2.2));
    for (let i = 1; i < fiberPoints.length; i++) {
      const pt = fiberPoints[i];
      const len = Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy);
      ctx.lineTo(pt.x - (-pt.dy / len) * (R_clad - 2.2), pt.y - (pt.dx / len) * (R_clad - 2.2));
    }
    ctx.stroke();
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(78, 87, 155, 0.5)' : 'rgba(100, 116, 139, 0.4)';
    ctx.lineWidth = 1.0;

    // Top border line
    ctx.beginPath();
    ctx.moveTo(pt0.x - nx0 * R_clad, pt0.y - ny0 * R_clad);
    for (let i = 1; i < fiberPoints.length; i++) {
      const pt = fiberPoints[i];
      const len = Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy);
      ctx.lineTo(pt.x - (-pt.dy / len) * R_clad, pt.y - (pt.dx / len) * R_clad);
    }
    ctx.stroke();
    
    // Bottom border line
    ctx.beginPath();
    ctx.moveTo(pt0.x + nx0 * R_clad, pt0.y + ny0 * R_clad);
    for (let i = 1; i < fiberPoints.length; i++) {
      const pt = fiberPoints[i];
      const len = Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy);
      ctx.lineTo(pt.x + (-pt.dy / len) * R_clad, pt.y + (pt.dx / len) * R_clad);
    }
    ctx.stroke();

    // 2. Draw Core (Waveguide Channel) Glass Fill
    ctx.beginPath();
    ctx.moveTo(pt0.x - nx0 * R_core, pt0.y - ny0 * R_core);
    for (let i = 1; i < fiberPoints.length; i++) {
      const pt = fiberPoints[i];
      const len = Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy);
      const nx = -pt.dy / len;
      const ny = pt.dx / len;
      ctx.lineTo(pt.x - nx * R_core, pt.y - ny * R_core);
    }
    ctx.lineTo(ptLast.x + nxLast * R_core, ptLast.y + nyLast * R_core);
    for (let i = fiberPoints.length - 2; i >= 0; i--) {
      const pt = fiberPoints[i];
      const len = Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy);
      const nx = -pt.dy / len;
      const ny = pt.dx / len;
      ctx.lineTo(pt.x + nx * R_core, pt.y + ny * R_core);
    }
    ctx.closePath();
    ctx.fillStyle = state.theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
    
    // Core borders (dashed lines for fiber core definition)
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(51, 65, 85, 0.28)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);
    
    // Top core border
    ctx.beginPath();
    ctx.moveTo(pt0.x - nx0 * R_core, pt0.y - ny0 * R_core);
    for (let i = 1; i < fiberPoints.length; i++) {
      const pt = fiberPoints[i];
      const len = Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy);
      ctx.lineTo(pt.x - (-pt.dy / len) * R_core, pt.y - (pt.dx / len) * R_core);
    }
    ctx.stroke();
    
    // Bottom core border
    ctx.beginPath();
    ctx.moveTo(pt0.x + nx0 * R_core, pt0.y + ny0 * R_core);
    for (let i = 1; i < fiberPoints.length; i++) {
      const pt = fiberPoints[i];
      const len = Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy);
      ctx.lineTo(pt.x + (-pt.dy / len) * R_core, pt.y + (pt.dx / len) * R_core);
    }
    ctx.stroke();
    ctx.setLineDash([]); // reset dash

    // 3. Draw Cleaved Face at Tip (Flat cleaved facet)
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(71, 85, 105, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ptLast.x - nxLast * R_clad, ptLast.y - nyLast * R_clad);
    ctx.lineTo(ptLast.x + nxLast * R_clad, ptLast.y + nyLast * R_clad);
    ctx.stroke();
    ctx.restore();

    // Polarisation PLC device housing (Step 2)
    ctx.save();
    ctx.fillStyle = state.theme === 'dark' ? 'rgba(30, 41, 59, 0.45)' : 'rgba(255, 255, 255, 0.45)';
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(0, 255, 170, 0.4)' : 'rgba(5, 150, 105, 0.4)';
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    drawRoundRectPath(ctx, 55, 88, 20, 24, 3);
    ctx.fill();
    ctx.stroke();

    // Rotating dial background circle inside the device
    ctx.beginPath();
    ctx.arc(65, 100, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#060913';
    ctx.fill();
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(0, 255, 170, 0.25)' : 'rgba(5, 150, 105, 0.25)';
    ctx.stroke();

    // Draw dial indicator (vector line matching polarisationAngle)
    ctx.save();
    ctx.translate(65, 100);
    ctx.rotate((state.polarisationAngle - 90) * Math.PI / 180);
    
    // Rotating line representing the polarization angle
    ctx.strokeStyle = state.theme === 'dark' ? '#00ffaa' : '#059669';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    
    // Double-headed arrows on the line
    ctx.fillStyle = state.theme === 'dark' ? '#00ffaa' : '#059669';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(3, -2);
    ctx.lineTo(3, 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-3, -2);
    ctx.lineTo(-3, 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
    ctx.restore();

    // Laser Source / Fiber Array Unit (FAU) Block housing (Step 1)
    ctx.save();
    
    // Sleek metallic gradient for the FAU housing block
    const fauGrad = ctx.createLinearGradient(-135, 60, -65, 140);
    fauGrad.addColorStop(0, '#1e293b'); // Slate blue-grey
    fauGrad.addColorStop(0.5, '#0f172a');
    fauGrad.addColorStop(1, '#020617'); // Dark slate navy
    
    ctx.fillStyle = fauGrad;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; // light glass bevel highlight
    ctx.lineWidth = 1.0;
    ctx.beginPath();
    drawRoundRectPath(ctx, -135, 60, 70, 80, 5);
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 7;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.stroke();
    draw3DHighlight(ctx, -135, 60, 70, 80, 5);

    // Active emission channel waveguide path (sleek glowing laser stripe)
    ctx.fillStyle = colors.laser;
    ctx.fillRect(-132, 99.2, 31, 1.6);

    // Antireflection (AR) coating halo around the ball lens
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(-101, 100, 3.8, 0, Math.PI * 2);
    ctx.stroke();

    // 3D radial gradient ball lens focusing emitted laser light into fiber core
    const lensGrad = ctx.createRadialGradient(-102, 98.8, 0.4, -101, 100, 3.2);
    lensGrad.addColorStop(0, '#ffffff');       // highlight reflection
    lensGrad.addColorStop(0.35, '#bae6fd');     // glass blue
    lensGrad.addColorStop(0.85, '#0284c7');    // deep core blue
    lensGrad.addColorStop(1, '#0369a1');       // shadow border
    
    ctx.fillStyle = lensGrad;
    ctx.beginPath();
    ctx.arc(-101, 100, 3.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.arc(-101, 100, 3.2, 0, Math.PI * 2);
    ctx.stroke();

    // 1. Top parameters display screen (Wavelength)
    ctx.fillStyle = '#060913';
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(255, 42, 95, 0.45)' : 'rgba(220, 38, 38, 0.4)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    drawRoundRectPath(ctx, -126, 64, 32, 15, 1.5);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 3.2px "Orbitron", sans-serif';
    ctx.fillText(state.language === 'en' ? 'WAVELENGTH' : '波長參數', -110, 68.0);

    ctx.fillStyle = colors.laser;
    ctx.font = 'bold 4.4px "JetBrains Mono", monospace';
    ctx.fillText(`${state.laserWavelength.toFixed(1)} nm`, -110, 74.2);

    // 2. Bottom parameters display screen (Laser Power)
    ctx.fillStyle = '#060913';
    ctx.strokeStyle = state.theme === 'dark' ? 'rgba(255, 42, 95, 0.45)' : 'rgba(220, 38, 38, 0.4)';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    drawRoundRectPath(ctx, -106, 121, 32, 15, 1.5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 3.2px "Orbitron", sans-serif';
    ctx.fillText(state.language === 'en' ? 'LASER POWER' : '雷射功率', -90, 125.0);

    ctx.fillStyle = colors.laser;
    ctx.font = 'bold 4.4px "JetBrains Mono", monospace';
    ctx.fillText(`${state.laserPower.toFixed(1)} mW`, -90, 131.2);

    // Emitter light source point (active region glowing output facet)
    ctx.fillStyle = colors.laser;
    ctx.shadowBlur = 8;
    ctx.shadowColor = colors.laser;
    ctx.beginPath();
    ctx.arc(-110, 100, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset

    ctx.restore();

    ctx.restore();
  }

  // Draw translucent coupling beam envelope from laser diode to fiber core
  function drawCouplingBeamEnvelope(ctx, limitX) {
    if (limitX <= -110) return;
    
    ctx.save();
    const colors = THEME_COLORS[state.theme];
    ctx.fillStyle = colors.laser === '#e11d48' ? 'rgba(225, 29, 72, 0.22)' : 'rgba(220, 38, 38, 0.22)';
    
    // First cone: x = -110 to min(-101, limitX)
    if (limitX > -110) {
      const endX = Math.min(-101, limitX);
      const t = (endX - (-110)) / 9; // fraction of first cone
      const topY = 100 - (0.5 + t * 2.0);
      const bottomY = 100 + (0.5 + t * 2.0);
      
      ctx.beginPath();
      ctx.moveTo(-110, 99.5);
      ctx.lineTo(endX, topY);
      ctx.lineTo(endX, bottomY);
      ctx.lineTo(-110, 100.5);
      ctx.closePath();
      ctx.fill();
    }
    
    // Second cone: x = -101 to min(-92, limitX)
    if (limitX > -101) {
      const endX = Math.min(-92, limitX);
      const t = (endX - (-101)) / 9; // fraction of second cone
      const topY = 97.5 + t * 1.4;
      const bottomY = 102.5 - t * 1.4;
      
      ctx.beginPath();
      ctx.moveTo(-101, 97.5);
      ctx.lineTo(endX, topY);
      ctx.lineTo(endX, bottomY);
      ctx.lineTo(-101, 102.5);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
  }

  // Render propagating electromagnetic wave along the entire assembly (gradually propagating from Step 1 to Step 7)
  function drawOpticalWaves(ctx) {
    const colors = THEME_COLORS[state.theme];
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const wlScale = state.laserWavelength / 1310;
    const ampScale = state.laserPower / 10;
    const scaleH = state.waveguideHeight / 220;

    // 1. FREE-SPACE / FIBER WAVES (Steps 1, 2, 3)
    // Red color, loose spatial period (λ = 1310 nm)
    ctx.strokeStyle = colors.laser;
    ctx.lineWidth = 1.5; // Slimmer stroke width (1.5 instead of 2.5)
    ctx.shadowBlur = 8;
    ctx.shadowColor = colors.laser;

    // Step 1: Laser output (propagate from DFB chip facet at x=-110 to x=55 inside fiber core)
    if (state.step === 1) {
      const limitX = -110 + 165 * state.pulseProgress;
      
      // Draw coupling beam envelope
      drawCouplingBeamEnvelope(ctx, limitX);
      
      // Draw free-space gap wave (x=-110 to min(-92, limitX))
      const endGapX = Math.min(-92, limitX);
      
      // 1a. Electric Field (E-field) - Solid Red
      ctx.save();
      ctx.strokeStyle = colors.laser;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = colors.laser;
      ctx.globalAlpha = Math.min(1.0, Math.max(0, ampScale));
      ctx.beginPath();
      for (let x = -110; x <= endGapX; x++) {
        let amp = 1.1;
        if (x <= -101) {
          const t = (x - (-110)) / 9;
          amp = 0.5 + t * 2.0;
        } else {
          const t = (x - (-101)) / 9;
          amp = 2.5 - t * 1.4;
        }
        const phase = ((x - (-92)) * Math.PI * 2) / (45 * wlScale) - state.wavePhase * 2.2;
        const y = 100 + Math.sin(phase) * amp * ampScale;
        if (x === -110) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // 1b. Magnetic Field (B-field) - Dashed Orange-Red
      ctx.save();
      ctx.strokeStyle = state.theme === 'dark' ? '#ff6b3d' : '#ea580c';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 2]);
      ctx.shadowBlur = 4;
      ctx.shadowColor = state.theme === 'dark' ? '#ff6b3d' : '#ea580c';
      ctx.globalAlpha = Math.min(0.85, Math.max(0, ampScale * 0.85));
      ctx.beginPath();
      for (let x = -110; x <= endGapX; x++) {
        let amp = 1.1;
        if (x <= -101) {
          const t = (x - (-110)) / 9;
          amp = 0.5 + t * 2.0;
        } else {
          const t = (x - (-101)) / 9;
          amp = 2.5 - t * 1.4;
        }
        const phase = ((x - (-92)) * Math.PI * 2) / (45 * wlScale) - state.wavePhase * 2.2;
        const offset = Math.sin(phase) * amp * ampScale;
        const wx = x + offset * 0.5;
        const wy = 100 - offset * 0.35;
        if (x === -110) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      ctx.restore();
      
      // Draw guided fiber wave (x=-92 to limitX)
      if (limitX > -92) {
        // 2a. Electric Field (E-field) - Solid Red
        ctx.save();
        ctx.strokeStyle = colors.laser;
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = colors.laser;
        ctx.globalAlpha = Math.min(1.0, Math.max(0, ampScale));
        ctx.beginPath();
        for (let x = -92; x <= limitX; x++) {
          const phase = ((x - (-92)) * Math.PI * 2) / (25 * wlScale) - state.wavePhase * 2.2;
          const y = 100 + Math.sin(phase) * 1.1 * ampScale;
          if (x === -92) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.restore();

        // 2b. Magnetic Field (B-field) - Dashed Orange-Red
        ctx.save();
        ctx.strokeStyle = state.theme === 'dark' ? '#ff6b3d' : '#ea580c';
        ctx.lineWidth = 1.0;
        ctx.setLineDash([2, 2]);
        ctx.shadowBlur = 4;
        ctx.shadowColor = state.theme === 'dark' ? '#ff6b3d' : '#ea580c';
        ctx.globalAlpha = Math.min(0.85, Math.max(0, ampScale * 0.85));
        ctx.beginPath();
        for (let x = -92; x <= limitX; x++) {
          const phase = ((x - (-92)) * Math.PI * 2) / (25 * wlScale) - state.wavePhase * 2.2;
          const offset = Math.sin(phase) * 1.1 * ampScale;
          const wx = x + offset * 0.5;
          const wy = 100 - offset * 0.35;
          if (x === -92) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    // Step 2 & 3: Fiber guidance (propagate along sampled fiber points)
    if (state.step >= 2) {
      const fiberPoints = getFiberGeometry();
      const maxIndex = fiberPoints.length - 1;
      let limitIndex = maxIndex;
      
      let plcStartIndex = findFiberIndex(fiberPoints, 55);
      if (plcStartIndex === -1) plcStartIndex = 25;
      
      let loopStartIndex = findFiberIndex(fiberPoints, 110);
      if (loopStartIndex === -1) loopStartIndex = 40;
      
      let loopEndIndex = findFiberIndex(fiberPoints, 240);
      if (loopEndIndex === -1) loopEndIndex = 100;
      
      if (state.step === 2) {
        // Starts at Polarisation PLC x=55 and propagates to loop start x=110
        limitIndex = plcStartIndex + Math.floor((loopStartIndex - plcStartIndex) * state.pulseProgress);
      } else if (state.step === 3) {
        // Starts at loop interface x=110 and propagates to end of loop x=240
        limitIndex = loopStartIndex + Math.floor((loopEndIndex - loopStartIndex) * state.pulseProgress);
      }

      // Safety bounds clamp
      limitIndex = Math.max(0, Math.min(fiberPoints.length - 1, limitIndex));
      
      ctx.save();
      
      // Draw fully established coupling beam envelope in the gap (x=-110 to -92)
      drawCouplingBeamEnvelope(ctx, -92);
      
      // Draw fully established wave in the gap (x=-110 to -92)
      // 1a. Electric Field (E-field) - Solid Red
      ctx.save();
      ctx.strokeStyle = colors.laser;
      ctx.lineWidth = 1.0;
      ctx.shadowBlur = 6;
      ctx.shadowColor = colors.laser;
      ctx.globalAlpha = Math.min(1.0, Math.max(0, ampScale));
      ctx.beginPath();
      for (let x = -110; x <= -92; x++) {
        let amp = 1.1;
        if (x <= -101) {
          const t = (x - (-110)) / 9;
          amp = 0.5 + t * 2.0;
        } else {
          const t = (x - (-101)) / 9;
          amp = 2.5 - t * 1.4;
        }
        const phase = ((x - (-92)) * Math.PI * 2) / (45 * wlScale) - state.wavePhase * 2.2;
        const y = 100 + Math.sin(phase) * amp * ampScale;
        if (x === -110) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      // 1b. Magnetic Field (B-field) - Dashed Orange-Red
      ctx.save();
      ctx.strokeStyle = state.theme === 'dark' ? '#ff6b3d' : '#ea580c';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 2]);
      ctx.shadowBlur = 3;
      ctx.shadowColor = state.theme === 'dark' ? '#ff6b3d' : '#ea580c';
      ctx.globalAlpha = Math.min(0.85, Math.max(0, ampScale * 0.85));
      ctx.beginPath();
      for (let x = -110; x <= -92; x++) {
        let amp = 1.1;
        if (x <= -101) {
          const t = (x - (-110)) / 9;
          amp = 0.5 + t * 2.0;
        } else {
          const t = (x - (-101)) / 9;
          amp = 2.5 - t * 1.4;
        }
        const phase = ((x - (-92)) * Math.PI * 2) / (45 * wlScale) - state.wavePhase * 2.2;
        const offset = Math.sin(phase) * amp * ampScale;
        const wx = x + offset * 0.5;
        const wy = 100 - offset * 0.35;
        if (x === -110) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      ctx.restore();

      // 1. Draw mode glow (Gaussian-like guiding intensity profile)
      ctx.strokeStyle = colors.laser;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Outer soft mode glow
      ctx.lineWidth = 3.5; // Slimmer glow
      ctx.globalAlpha = 0.15 * Math.min(1.0, Math.max(0, ampScale));
      if (fiberPoints[0]) {
        ctx.beginPath();
        ctx.moveTo(fiberPoints[0].x, fiberPoints[0].y);
        for (let i = 1; i <= limitIndex; i++) {
          if (fiberPoints[i]) {
            ctx.lineTo(fiberPoints[i].x, fiberPoints[i].y);
          }
        }
        ctx.stroke();
      }
      
      // Inner tighter core mode glow
      ctx.lineWidth = 2.0; // Slimmer glow
      ctx.globalAlpha = 0.35 * Math.min(1.0, Math.max(0, ampScale));
      if (fiberPoints[0]) {
        ctx.beginPath();
        ctx.moveTo(fiberPoints[0].x, fiberPoints[0].y);
        for (let i = 1; i <= limitIndex; i++) {
          if (fiberPoints[i]) {
            ctx.lineTo(fiberPoints[i].x, fiberPoints[i].y);
          }
        }
        ctx.stroke();
      }
      
      // 2. Draw oscillating electromagnetic waves (Electric & Magnetic fields confined inside core)
      const waveAmp = 1.1;
      
      // 2a. Electric Field (E-field) - Solid Red
      ctx.save();
      ctx.strokeStyle = colors.laser;
      ctx.lineWidth = 1.0;
      ctx.shadowBlur = 6;
      ctx.shadowColor = colors.laser;
      ctx.globalAlpha = Math.min(1.0, Math.max(0, ampScale));
      ctx.beginPath();
      for (let i = 0; i <= limitIndex; i++) {
        const pt = fiberPoints[i];
        if (!pt) continue;
        const len = Math.sqrt(pt.dx*pt.dx + pt.dy*pt.dy);
        const nx = -pt.dy / len;
        const ny = pt.dx / len;
        const phase = (pt.dist * Math.PI * 2) / (25 * wlScale) - state.wavePhase * 2.2;
        
        const phiRad = state.polarisationAngle * Math.PI / 180;
        const cosPhi = Math.cos(phiRad);
        let factor = 1.0;
        if (pt.x > 75) {
          factor = cosPhi;
        } else if (pt.x >= 55) {
          const t = (pt.x - 55) / 20;
          factor = 1.0 + t * (cosPhi - 1.0);
        }
        const waveOffset = Math.sin(phase) * waveAmp * factor * ampScale;
        const wx = pt.x + nx * waveOffset;
        const wy = pt.y + ny * waveOffset;
        
        if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      ctx.restore();

      // 2b. Magnetic Field (B-field) - Dashed Orange-Red
      ctx.save();
      ctx.strokeStyle = state.theme === 'dark' ? '#ff6b3d' : '#ea580c';
      ctx.lineWidth = 1.0;
      ctx.setLineDash([2, 2]);
      ctx.shadowBlur = 4;
      ctx.shadowColor = state.theme === 'dark' ? '#ff6b3d' : '#ea580c';
      ctx.globalAlpha = Math.min(0.85, Math.max(0, ampScale * 0.85));
      ctx.beginPath();
      for (let i = 0; i <= limitIndex; i++) {
        const pt = fiberPoints[i];
        if (!pt) continue;
        const phase = (pt.dist * Math.PI * 2) / (25 * wlScale) - state.wavePhase * 2.2;
        
        const phiRad = state.polarisationAngle * Math.PI / 180;
        const cosPhi = Math.cos(phiRad);
        let factor = 1.0;
        if (pt.x > 75) {
          factor = cosPhi;
        } else if (pt.x >= 55) {
          const t = (pt.x - 55) / 20;
          factor = 1.0 + t * (cosPhi - 1.0);
        }
        const waveOffset = Math.sin(phase) * waveAmp * factor * ampScale;
        const wx = pt.x + waveOffset * 0.5;
        const wy = pt.y - waveOffset * 0.35;
        
        if (i === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 2. INCIDENT & DIFFRACTIVE TRANSITION (Steps 4 & 5)
    // Show expanding wavefront arcs exiting the single-mode fiber tip dynamically towards the grating
    if (state.step >= 4) {
      ctx.save();
      ctx.strokeStyle = colors.laser;
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = colors.laser;
      ctx.globalAlpha = Math.min(1.0, Math.max(0, ampScale));
      
      const fiberPoints = getFiberGeometry();
      const ptLast = fiberPoints[fiberPoints.length - 1];
      const fiberTipX = ptLast.x;
      const fiberTipY = ptLast.y;
      const angle = Math.atan2(ptLast.dy, ptLast.dx); // Dynamic fiber tip angle
      
      const maxD = state.step === 4 ? 45 * state.pulseProgress : 45; // limit incident propagation
      
      for (let k = 0; k < 4; k++) {
        // Distance propagates forward from the tip down to the grating slab
        const d = (((state.wavePhase * 1.5) % 15) + k * 15) * wlScale;
        if (d > maxD) continue; // Cut off wavefront arcs that haven't arrived yet
        
        ctx.beginPath();
        // Draw wavefront arc perpendicular to the incident direction
        ctx.arc(fiberTipX, fiberTipY, d, angle - 0.35, angle + 0.35);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Secondary Huygens wavelets expanding from periodic grating grooves (Step 5 diffraction mechanism)
    if (state.step >= 5) {
      ctx.save();
      ctx.lineWidth = 1.0;
      ctx.globalAlpha = Math.min(1.0, Math.max(0, ampScale));
      
      const grooveY = 155;
      const period = 16;
      const count = 7;
      
      for (let j = 0; j < count; j++) {
        const gx = 325 + j * period + 4; // groove center
        
        // Grooves are excited sequentially as the wavefront propagates across the grating slab
        const grooveProgress = (j / count);
        let activeScale = 0;
        if (state.step === 5) {
          if (state.pulseProgress < grooveProgress) continue; // wavefront hasn't reached this groove
          activeScale = (state.pulseProgress - grooveProgress) * count; // local wavelet emission growth
        } else {
          activeScale = 1.0; // fully excited in later stages
        }
        
        // Emitted circular wavelets propagating upward (cladding)
        for (let w = 0; w < 3; w++) {
          const r = (((state.wavePhase * 1.2) % 12) + w * 12) * wlScale;
          if (state.step === 5 && r > activeScale * 25) continue; // limit wavelet radius by propagation front
          
          ctx.strokeStyle = `rgba(255, 170, 0, ${Math.max(0, 0.45 - r/36) * Math.min(1.0, Math.max(0, ampScale))})`;
          ctx.beginPath();
          ctx.arc(gx, grooveY, r, Math.PI, 0); // upward semi-circle
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // 3. TRANSITION / ADIABATIC TAPER MODE (Step 5 & 6)
    // Waves gradually squeeze in width and transition color from Red/Orange to Green
    if (state.step >= 5) {
      let limitX = 325;
      if (state.step === 5) {
        limitX = 325 + (430 - 325) * state.pulseProgress; // propagates across grating block
      } else if (state.step === 6) {
        limitX = 430 + (570 - 430) * state.pulseProgress; // propagates down taper
      } else {
        limitX = 570; // fully populated in step 7+
      }
      
      ctx.save();
      const eff = getCouplingEfficiency();
      ctx.globalAlpha = eff * Math.min(1.0, Math.max(0, ampScale));
      ctx.lineWidth = 1.2; // Slimmer wave stroke width (1.2 instead of 2.5)
      ctx.shadowBlur = 6;
      ctx.beginPath();
      for (let x = 325; x <= limitX; x++) {
        const normalized = (x - 325) / (570 - 325); // 0 to 1
        
        // Interpolate wavelength (loose 40px cycle -> tight 16px cycle)
        const waveCycle = (40 - normalized * 24) * wlScale; 
        const phaseSpeed = state.wavePhase * (2.2 - normalized * 0.8);
        const amp = (4.2 - normalized * 2.5) * ampScale; // Slimmer amplitude (squeezed from 6..2.5 to 4.2..1.7)
        
        const y = 155 + Math.sin((x * Math.PI * 2) / waveCycle - phaseSpeed) * amp;
        
        // Interpolate color (Red ➔ Orange ➔ Green)
        let color = colors.laser;
        if (normalized > 0.35 && normalized <= 0.7) {
          color = colors.taper;
        } else if (normalized > 0.7) {
          color = colors.guided;
        }
        
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        
        if (x === 325) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    // 4. GUIDED WAVEGUIDE CORE WAVES (Steps 7 & 8)
    // Green-cyan color, tightly compressed (λ_guided ≈ 545 nm)
    if (state.step >= 7) {
      const limitX = state.step === 7 ? 570 + (740 - 570) * state.pulseProgress : 740;
      ctx.save();
      const eff = getCouplingEfficiency();
      ctx.globalAlpha = eff * Math.min(1.0, Math.max(0, ampScale));
      ctx.strokeStyle = colors.guided;
      ctx.shadowColor = colors.guided;
      ctx.lineWidth = 1.2; // Slimmer wave stroke width (1.2 instead of 2.0)
      ctx.shadowBlur = 6;

      const neff = getWaveguideEffectiveIndex();
      const periodScale = wlScale * (BASE_NEFF / neff);
      const phaseMultiplier = 1.4 * (BASE_NEFF / neff);

      // Single-mode core
      ctx.beginPath();
      for (let x = 570; x <= limitX; x++) {
        const y = 160 + Math.sin((x * Math.PI * 2) / (16 * periodScale) - state.wavePhase * phaseMultiplier) * 1.6 * ampScale; // Slimmer amplitude (1.6 instead of 2.2)
        if (x === 570) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Splitter branches (Step 8) - Rerouted to center at y=112 and y=198
    if (state.step >= 8) {
      const limitX = state.step === 8 ? 740 + (835 - 740) * state.pulseProgress : 835;
      ctx.save();
      const eff = getCouplingEfficiency();
      ctx.globalAlpha = eff * Math.min(1.0, Math.max(0, ampScale));
      ctx.strokeStyle = colors.guided;
      ctx.shadowColor = colors.guided;
      ctx.lineWidth = 1.0; // Slimmer wave stroke width (1.0 instead of 2.0)
      ctx.shadowBlur = 6;
      
      const neff = getWaveguideEffectiveIndex();
      const periodScale = wlScale * (BASE_NEFF / neff);
      const phaseMultiplier = 1.4 * (BASE_NEFF / neff);

      ctx.beginPath();
      // Top branch routing
      for (let x = 740; x <= limitX; x++) {
        let py;
        if (x <= 760) {
          py = 160 - 2.5 * scaleH;
        } else if (x <= 790) {
          const startY = 160 - 2.5 * scaleH;
          py = startY + (x - 760) * (112 - startY) / 30;
        } else {
          py = 112;
        }
        const y = py + Math.sin((x * Math.PI * 2) / (16 * periodScale) - state.wavePhase * phaseMultiplier) * 1.1 * ampScale;
        if (x === 740) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();

      ctx.beginPath();
      // Bottom branch routing
      for (let x = 740; x <= limitX; x++) {
        let py;
        if (x <= 760) {
          py = 160 + 2.5 * scaleH;
        } else if (x <= 790) {
          const startY = 160 + 2.5 * scaleH;
          py = startY + (x - 760) * (198 - startY) / 30;
        } else {
          py = 198;
        }
        const y = py + Math.sin((x * Math.PI * 2) / (16 * periodScale) - state.wavePhase * phaseMultiplier) * 1.5 * ampScale;
        if (x === 740) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      
      ctx.restore();
    }
    
    ctx.shadowBlur = 0; // reset

    // 5. TRAVELING SIGNAL HIGHLIGHT packet (visual guide dot - shrunk to 2px for cleaner looks)
    if (state.isPlaying) {
      const segment = PATH_SEGMENTS[state.step];
      if (segment) {
        // Interpolate position along segment
        const px = segment.startX + (segment.endX - segment.startX) * state.pulseProgress;
        ctx.save();
        if (state.step >= 5) {
          const eff = getCouplingEfficiency();
          ctx.globalAlpha = eff * Math.min(1.0, Math.max(0, ampScale));
        } else {
          ctx.globalAlpha = Math.min(1.0, Math.max(0, ampScale));
        }
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffffff';

        if (state.step === 8) {
          // Split into top and bottom guide dots
          let pyTop;
          if (px <= 760) {
            pyTop = 160 - 2.5 * scaleH;
          } else if (px <= 790) {
            const startY = 160 - 2.5 * scaleH;
            pyTop = startY + (px - 760) * (112 - startY) / 30;
          } else {
            pyTop = 112;
          }
          ctx.beginPath();
          ctx.arc(px, pyTop, 2.0, 0, Math.PI * 2);
          ctx.fill();

          let pyBottom;
          if (px <= 760) {
            pyBottom = 160 + 2.5 * scaleH;
          } else if (px <= 790) {
            const startY = 160 + 2.5 * scaleH;
            pyBottom = startY + (px - 760) * (198 - startY) / 30;
          } else {
            pyBottom = 198;
          }
          ctx.beginPath();
          ctx.arc(px, pyBottom, 2.0, 0, Math.PI * 2);
          ctx.fill();
        } else if (state.step === 2 || state.step === 3) {
          const fiberPoints = getFiberGeometry();
          let plcStartIndex = findFiberIndex(fiberPoints, 55);
          if (plcStartIndex === -1) plcStartIndex = 25;
          let loopStartIndex = findFiberIndex(fiberPoints, 110);
          if (loopStartIndex === -1) loopStartIndex = 40;
          let loopEndIndex = findFiberIndex(fiberPoints, 240);
          if (loopEndIndex === -1) loopEndIndex = 100;
          
          let limitIndex;
          if (state.step === 2) {
            limitIndex = plcStartIndex + Math.floor((loopStartIndex - plcStartIndex) * state.pulseProgress);
          } else {
            limitIndex = loopStartIndex + Math.floor((loopEndIndex - loopStartIndex) * state.pulseProgress);
          }
          limitIndex = Math.max(0, Math.min(fiberPoints.length - 1, limitIndex));
          const pt = fiberPoints[limitIndex];
          if (pt) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 2.0, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (state.step === 4) {
          const fiberPoints = getFiberGeometry();
          const ptLast = fiberPoints[fiberPoints.length - 1] || { x: 240, y: 100 };
          const pxGap = ptLast.x + (325 - ptLast.x) * state.pulseProgress;
          const pyGap = ptLast.y + (155 - ptLast.y) * state.pulseProgress;
          ctx.beginPath();
          ctx.arc(pxGap, pyGap, 2.0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const py = segment.startY + (segment.endY - segment.startY) * state.pulseProgress;
          ctx.beginPath();
          ctx.arc(px, py, 2.0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0; // reset
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // Draw glowing camera focus HUD outline around the step boundary
  function drawCameraHUDOutline(ctx, data) {
    ctx.save();
    
    // Style HUD based on step properties
    const colors = THEME_COLORS[state.theme];
    const isStep5 = state.step === 5;
    ctx.strokeStyle = isStep5 ? colors.taper : colors.laser;
    ctx.shadowColor = isStep5 ? colors.taper : colors.laser;
    
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.shadowBlur = 6;

    // Boundary boxes based on camera focus coordinates
    const w = 120 / state.cameraZoom;
    const h = 70 / state.cameraZoom;
    const rx = data.camX - w / 2;
    const ry = data.camY - h / 2;

    ctx.strokeRect(rx, ry, w, h);

    // Corner bracket markers
    ctx.setLineDash([]);
    ctx.lineWidth = 2.0;
    const cornerSize = 8;
    
    // Top-Left corner
    ctx.beginPath();
    ctx.moveTo(rx + cornerSize, ry);
    ctx.lineTo(rx, ry);
    ctx.lineTo(rx, ry + cornerSize);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(rx + w - cornerSize, ry);
    ctx.lineTo(rx + w, ry);
    ctx.lineTo(rx + w, ry + cornerSize);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(rx + cornerSize, ry + h);
    ctx.lineTo(rx, ry + h);
    ctx.lineTo(rx, ry + h - cornerSize);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(rx + w - cornerSize, ry + h);
    ctx.lineTo(rx + w, ry + h);
    ctx.lineTo(rx + w, ry + h - cornerSize);
    ctx.stroke();

    ctx.restore();
  }

  // Draw descriptive text labels and pointers directly on the canvas components
  function drawComponentLabels(ctx) {
    const colors = THEME_COLORS[state.theme];
    const isDark = state.theme === 'dark';
    
    ctx.save();
    
    LABELS_DATA.forEach(lbl => {
      const isActive = state.step === lbl.step;
      
      // Select baseline font and color weights
      if (isActive) {
        ctx.fillStyle = isDark ? '#ffffff' : '#000000';
        ctx.font = 'bold 7px "Orbitron", sans-serif';
      } else {
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)';
        ctx.font = '500 7px "Orbitron", sans-serif';
      }
      
      ctx.textAlign = lbl.align;
      ctx.textBaseline = 'middle';
      
      const text = state.language === 'en' ? lbl.textEn : lbl.textZh;
      
      // Active step features custom colored pointers linking to device
      if (isActive) {
        ctx.strokeStyle = colors.laser;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 4;
        ctx.shadowColor = colors.laser;
        
        ctx.beginPath();
        let componentY = 100;
        if (lbl.step === 5 || lbl.step === 6 || lbl.step === 7) {
          componentY = 155;
        } else if (lbl.step === 4) {
          componentY = 135;
        } else if (lbl.step === 8) {
          componentY = 142;
        }
        
        const targetX = lbl.step === 1 ? -100 :
                        lbl.step === 2 ? 65 :
                        lbl.step === 3 ? 180 :
                        lbl.step === 4 ? 315 :
                        lbl.step === 5 ? 380 :
                        lbl.step === 6 ? 500 :
                        lbl.step === 7 ? 650 : 840;
                        
        ctx.moveTo(lbl.x, lbl.y + (lbl.y > componentY ? -4 : 4));
        ctx.lineTo(targetX, componentY);
        ctx.stroke();
        
        // Target dot
        ctx.fillStyle = colors.laser;
        ctx.beginPath();
        ctx.arc(targetX, componentY, 2.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
      }
      
      // Draw background card for text readability
      ctx.save();
      const textWidth = ctx.measureText(text).width;
      
      if (isActive) {
        ctx.fillStyle = isDark ? 'rgba(11, 12, 35, 0.9)' : 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = colors.laser;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 6;
        ctx.shadowColor = colors.laser;
      } else {
        ctx.fillStyle = isDark ? 'rgba(7, 8, 20, 0.55)' : 'rgba(241, 245, 249, 0.8)';
        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)';
        ctx.lineWidth = 0.5;
        ctx.shadowBlur = 0;
      }
      
      let rx = lbl.x;
      if (lbl.align === 'center') rx = lbl.x - textWidth / 2 - 4;
      else if (lbl.align === 'right') rx = lbl.x - textWidth - 8;
      else rx = lbl.x - 4;
      
      const ry = lbl.y - 6;
      const rw = textWidth + 8;
      const rh = 12;
      
      ctx.beginPath();
      drawRoundRectPath(ctx, rx, ry, rw, rh, 3);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      
      // Print text character string
      if (isActive) {
        ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
        ctx.font = 'bold 7px "Orbitron", sans-serif';
      } else {
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(15, 23, 42, 0.6)';
        ctx.font = '500 7px "Orbitron", sans-serif';
      }
      ctx.fillText(text, lbl.x, lbl.y);
    });
    
    ctx.restore();
  }

  // Draw detailed physical representation of diffraction, reflections, and m = -1 phase-matching (Step 4 details)
  function drawDiffractionDetails(ctx) {
    if (state.step !== 5) return;
    
    const colors = THEME_COLORS[state.theme];
    const isDark = state.theme === 'dark';
    const eff = getCouplingEfficiency();
    const ampScale = state.laserPower / 10;
    const wlScale = state.laserWavelength / 1310;
    const lossOpacity = (0.2 + 0.65 * (1 - eff)) * Math.min(1.0, Math.max(0, ampScale));
    
    ctx.save();
    
    // 1. Draw Animating 0th Order Reflection Wave (m = 0)
    // Starts at x = 325. Fades/propagates in after progress passes 0.05.
    const progressLimit0 = state.pulseProgress;
    if (progressLimit0 > 0.05) {
      const activeScale0 = Math.min(1.0, (progressLimit0 - 0.05) / 0.35);
      ctx.strokeStyle = isDark ? `rgba(255, 42, 95, ${lossOpacity * activeScale0})` : `rgba(220, 38, 38, ${lossOpacity * activeScale0})`;
      ctx.lineWidth = 0.8; // Slimmer (0.8 instead of 1.2)
      ctx.shadowBlur = 4;
      ctx.shadowColor = colors.laser;
      
      const angle0 = Math.atan2(-40, 70); // Reflected wave angle
      ctx.beginPath();
      const len0 = 80 * activeScale0;
      for (let d = 0; d <= len0; d++) {
        const px = 325 + Math.cos(angle0) * d;
        const py = 155 + Math.sin(angle0) * d;
        // Wave oscillation normal to propagation direction
        const normalOffset = Math.sin((d * Math.PI * 2) / (35 * wlScale) - state.wavePhase * 2.2) * 1.8 * ampScale; // Slimmer, scaled by wlScale and ampScale
        const wx = px - Math.sin(angle0) * normalOffset;
        const wy = py + Math.cos(angle0) * normalOffset;
        if (d === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      
      // Draw 0th order text label (shifted to empty space above waveguide routing)
      ctx.fillStyle = isDark ? `rgba(255, 42, 95, ${lossOpacity * activeScale0})` : `rgba(220, 38, 38, ${lossOpacity * activeScale0})`;
      ctx.font = 'bold 5.5px "Orbitron", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const textRefl = state.language === 'en' ? 'Reflected m=0 (Loss)' : '反射波 m=0 (損耗)';
      ctx.fillText(textRefl, 425, 100);
      
      // Pointer from label to wave center point
      ctx.strokeStyle = isDark ? `rgba(255, 42, 95, ${lossOpacity * 0.5 * activeScale0})` : `rgba(220, 38, 38, ${lossOpacity * 0.5 * activeScale0})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(422, 100);
      ctx.lineTo(365, 132);
      ctx.stroke();
      
      ctx.fillStyle = isDark ? `rgba(255, 42, 95, ${lossOpacity * activeScale0})` : `rgba(220, 38, 38, ${lossOpacity * activeScale0})`;
      ctx.beginPath();
      ctx.arc(365, 132, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 2. Draw Animating +1st Order Upward Diffraction Wave (m = +1)
    // Starts at middle grating grooves x = 373. Fades/propagates in after progress passes 0.45.
    const progressLimit1 = state.pulseProgress;
    if (progressLimit1 > 0.45) {
      const activeScale1 = Math.min(1.0, (progressLimit1 - 0.45) / 0.35);
      ctx.strokeStyle = isDark ? `rgba(255, 170, 0, ${lossOpacity * activeScale1})` : `rgba(217, 119, 6, ${lossOpacity * activeScale1})`;
      ctx.shadowColor = colors.taper;
      ctx.lineWidth = 0.8; // Slimmer wave
      
      const angle1 = Math.atan2(-45, -43); // +1 diffraction angle
      ctx.beginPath();
      const len1 = 60 * activeScale1;
      for (let d = 0; d <= len1; d++) {
        const px = 373 + Math.cos(angle1) * d;
        const py = 155 + Math.sin(angle1) * d;
        const normalOffset = Math.sin((d * Math.PI * 2) / (35 * wlScale) - state.wavePhase * 2.2) * 1.8 * ampScale; // Slimmer amplitude, scaled by wlScale and ampScale
        const wx = px - Math.sin(angle1) * normalOffset;
        const wy = py + Math.cos(angle1) * normalOffset;
        if (d === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      
      // Draw +1st order label (shifted to empty space above fiber)
      ctx.fillStyle = isDark ? `rgba(255, 170, 0, ${lossOpacity * activeScale1})` : `rgba(217, 119, 6, ${lossOpacity * activeScale1})`;
      ctx.font = 'bold 5.5px "Orbitron", sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const textRad = state.language === 'en' ? 'Radiation m=+1 (Loss)' : '輻射波 m=+1 (損耗)';
      ctx.fillText(textRad, 245, 80);
      
      // Pointer from label to wave center point
      ctx.strokeStyle = isDark ? `rgba(255, 170, 0, ${lossOpacity * 0.5 * activeScale1})` : `rgba(217, 119, 6, ${lossOpacity * 0.5 * activeScale1})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(248, 80);
      ctx.lineTo(350, 133);
      ctx.stroke();
      
      ctx.fillStyle = isDark ? `rgba(255, 170, 0, ${lossOpacity * activeScale1})` : `rgba(217, 119, 6, ${lossOpacity * activeScale1})`;
      ctx.beginPath();
      ctx.arc(350, 133, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 3. Highlight -1st Order constructive phase-matching
    ctx.save();
    ctx.globalAlpha = eff * Math.min(1.0, Math.max(0, ampScale));
    ctx.strokeStyle = colors.guided;
    ctx.shadowBlur = 6;
    ctx.shadowColor = colors.guided;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    
    const crestCount = 6;
    const peakPeriod = 16 * wlScale;
    const wavePhaseOffset = state.wavePhase * 1.4;
    const waveOffset = (wavePhaseOffset / (Math.PI * 2)) * peakPeriod;
    
    // Guided wave propagates across grating block (325 to 430)
    const limitX = 325 + (430 - 325) * state.pulseProgress;
    
    for (let c = 0; c < crestCount; c++) {
      const cx = 325 + (waveOffset % peakPeriod) + c * peakPeriod;
      if (cx > limitX) continue; // Cut off wavefronts that haven't propagated yet
      
      ctx.beginPath();
      ctx.moveTo(cx, 155);
      ctx.lineTo(cx, 170);
      ctx.stroke();
    }
    ctx.restore(); // restore phase matching style
    
    // Draw annotation indicator pointing to the phase-matched guided wavefronts
    // Only display label when wave front has advanced past x = 390 (progress ~0.62)
    if (state.pulseProgress > 0.62) {
      const activeScaleLabel = Math.min(1.0, (state.pulseProgress - 0.62) / 0.2);
      ctx.save();
      ctx.globalAlpha = activeScaleLabel * eff * Math.min(1.0, Math.max(0, ampScale));
      
      ctx.strokeStyle = colors.guided;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(432, 135);
      ctx.lineTo(405, 160);
      ctx.stroke();
      
      ctx.fillStyle = colors.guided;
      ctx.beginPath();
      ctx.arc(405, 160, 2, 0, Math.PI * 2);
      ctx.fill();
      
      const labelText = state.language === 'en' ? 'Phase-Matched Mode (m = -1)' : '一級相位匹配導模 (m = -1)';
      const textWidth = ctx.measureText(labelText).width;
      
      ctx.fillStyle = isDark ? 'rgba(11, 12, 35, 0.9)' : 'rgba(255, 255, 255, 0.95)';
      ctx.strokeStyle = colors.guided;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      drawRoundRectPath(ctx, 435 - 4, 129, textWidth + 8, 12, 3);
      ctx.fill();
      ctx.stroke();
      
      ctx.fillStyle = isDark ? '#ffffff' : '#059669';
      ctx.font = 'bold 6px "Orbitron", sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, 435, 135);
      ctx.restore();
    }
    
    ctx.restore();
    ctx.restore();
  }

  // Draw visual tilt angle indicator and cavity back-reflection explanation (Step 3)
  function drawTiltAngleIndicator(ctx) {
    if (state.step !== 4) return;
    
    const colors = THEME_COLORS[state.theme];
    const isDark = state.theme === 'dark';
    
    const fiberPoints = getFiberGeometry();
    const ptLast = fiberPoints[fiberPoints.length - 1];
    const fiberTipX = ptLast.x;
    const fiberTipY = ptLast.y;
    
    ctx.save();
    
    // 1. Draw vertical normal line (extended higher for visual clarity)
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(fiberTipX, fiberTipY);
    ctx.lineTo(fiberTipX, fiberTipY - 50);
    ctx.stroke();
    
    // 2. Draw angle arc (with a larger radius to be clearly outside cladding boundary)
    ctx.strokeStyle = colors.laser;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    
    const fiberAngle = Math.atan2(-ptLast.dy, -ptLast.dx);
    ctx.arc(fiberTipX, fiberTipY, 22, -Math.PI / 2, fiberAngle, true); // CCW from normal to fiber line
    ctx.stroke();
    
    // 3. Draw label text pointing to the tilt angle (split into 2 lines, moved to background open space)
    ctx.fillStyle = colors.laser;
    ctx.font = 'bold 5.5px "Orbitron", sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    
    const labelLine1 = state.language === 'en' 
      ? `Fiber Tilt Angle θ_in = ${state.fiberTiltAngle}°` 
      : `光纖入射角 θ_in = ${state.fiberTiltAngle}°`;
    const labelLine2 = state.language === 'en'
      ? '(Prevents Cavity Back-Reflection)'
      : '(防止腔體回反射)';
      
    ctx.fillText(labelLine1, 260, 50);
    ctx.font = '500 5px "Orbitron", sans-serif';
    ctx.fillText(labelLine2, 260, 57);
    
    // Pointer line from text to arc center (perfectly clear of the cladding boundary)
    const arcAngle = -Math.PI / 2 + (fiberAngle - (-Math.PI / 2)) * 0.5;
    const arcX = fiberTipX + 22 * Math.cos(arcAngle);
    const arcY = fiberTipY + 22 * Math.sin(arcAngle);
    
    ctx.strokeStyle = colors.laser;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(262, 53);
    ctx.lineTo(arcX, arcY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(arcX, arcY, 1.2, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  }

})();
