import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { jsPDF } from 'jspdf';
import SignaturePad from './SignaturePad';
import QRSignatureModal from './QRSignatureModal';

// Mobile detection
function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 768);
}

// --- Cookie helpers ---
function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : '';
}

// --- Session storage helpers ---
const STORAGE_KEY = 'ovikreta_form';

function loadSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveSession(data) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { }
}

const signatures = [
  { src: '/signatures/20040821T180600-GC2004-Johnathan_Wendel-Fatal1ty-Signature.svg', alt: 'Aláírás 1' },
  { src: '/signatures/ADONXS_signature_2022.svg', alt: 'Aláírás 2' },
  { src: '/signatures/Aleksandrs_Bartaševičs_sign.svg', alt: 'Aláírás 3' },
  { src: '/signatures/Ben_Bernanke_signature.svg', alt: 'Aláírás 4' },
];

const signatureFonts = [
  { family: "'Mr Dafoe', cursive", label: 'Lendületes', size: '1.6rem' },
  { family: "'Mrs Saint Delafield', cursive", label: 'Klasszikus', size: '1.6rem' },
  { family: "'Kristi', cursive", label: 'Gyors', size: '1.8rem' },
  { family: "'Homemade Apple', cursive", label: 'Kézírásos', size: '1.2rem' },
  { family: "'Herr Von Muellerhoff', cursive", label: 'Elegáns', size: '1.6rem' },
];

// --- Signature-to-image helper for PDF embedding ---
async function renderSignatureToImage(selSig, sigs, customName, font, drawnSig) {
  // Drawn signature — trim whitespace and return clean PNG
  if (selSig === 'drawn' && drawnSig) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const src = document.createElement('canvas');
        src.width = img.naturalWidth;
        src.height = img.naturalHeight;
        const sCtx = src.getContext('2d');
        sCtx.drawImage(img, 0, 0);

        const iData = sCtx.getImageData(0, 0, src.width, src.height).data;
        let minX = src.width, maxX = 0, minY = src.height, maxY = 0;
        for (let py = 0; py < src.height; py++) {
          for (let px = 0; px < src.width; px++) {
            if (iData[(py * src.width + px) * 4 + 3] > 10) {
              minX = Math.min(minX, px);
              maxX = Math.max(maxX, px);
              minY = Math.min(minY, py);
              maxY = Math.max(maxY, py);
            }
          }
        }

        if (maxX <= minX || maxY <= minY) { resolve(drawnSig); return; }

        const pad = 10;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(src.width, maxX + pad);
        maxY = Math.min(src.height, maxY + pad);

        const out = document.createElement('canvas');
        out.width = maxX - minX;
        out.height = maxY - minY;
        const oCtx = out.getContext('2d');
        oCtx.drawImage(src, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
        resolve(out.toDataURL('image/png'));
      };
      img.onerror = () => resolve(drawnSig);
      img.src = drawnSig;
    });
  }

  const canvas = document.createElement('canvas');
  const dpr = 2;
  canvas.width = 400 * dpr;
  canvas.height = 100 * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  if (selSig === 'custom') {
    ctx.font = `48px ${font.family}`;
    ctx.fillStyle = '#3b2d8b';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(customName, 200, 50);
    return canvas.toDataURL('image/png');
  }

  // SVG image signature
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      const drawH = 90;
      const drawW = drawH * aspectRatio;
      const x = (400 - drawW) / 2;
      const y = (100 - drawH) / 2 + 8;
      ctx.drawImage(img, x, y, drawW, drawH);
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = '#3b2d8b';
      ctx.fillRect(0, 0, 400, 100);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Failed to load signature SVG'));
    img.src = sigs[selSig].src;
  });
}

// Initialise state from session/cookie
const saved = loadSession();
const cookieChildName = getCookie('ovikreta_child_name');

// --- Toast component ---
function SuccessToast({ show, onDone }) {
  useEffect(() => {
    if (show) {
      const t = setTimeout(onDone, 3000);
      return () => clearTimeout(t);
    }
  }, [show, onDone]);

  if (!show) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] animate-slide-down">
      <div className="flex items-center gap-2.5 bg-green-600 dark:bg-green-500 text-white pl-4 pr-5 py-3 rounded-2xl shadow-2xl">
        <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-sm font-semibold">PDF sikeresen letöltve!</span>
      </div>
    </div>
  );
}

export default function ParentalAbsenceForm() {
  const [childName, setChildName] = useState(cookieChildName || saved.childName || '');
  const [kindergartenName, setKindergartenName] = useState(saved.kindergartenName ?? 'Budapest Főváros XIII. Kerületi Önkormányzat Egyesített Óvoda Zöld Ág Tagóvodája');
  const [fromDate, setFromDate] = useState(saved.fromDate || '');
  const [toDate, setToDate] = useState(saved.toDate || '');
  const [selectedSignature, setSelectedSignature] = useState(saved.selectedSignature ?? null);
  const [customSignatureName, setCustomSignatureName] = useState(saved.customSignatureName || '');
  const [selectedFont, setSelectedFont] = useState(saved.selectedFont ?? 0);
  const [signatureDate, setSignatureDate] = useState(saved.signatureDate || new Date().toISOString().split('T')[0]);
  const [drawnSignature, setDrawnSignature] = useState(saved.drawnSignature || null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDesktopPad, setShowDesktopPad] = useState(false);
  const isMobile = useMemo(() => isMobileDevice(), []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Validation state
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [shakeButton, setShakeButton] = useState(false);
  const childNameRef = useRef(null);
  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);
  const signatureSectionRef = useRef(null);

  // Dark mode
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ovikreta_dark');
      if (stored !== null) return stored === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('ovikreta_dark', String(darkMode));
  }, [darkMode]);

  // Persist all fields to sessionStorage on every change
  useEffect(() => {
    saveSession({ childName, kindergartenName, fromDate, toDate, selectedSignature, customSignatureName, selectedFont, signatureDate, drawnSignature });
  }, [childName, kindergartenName, fromDate, toDate, selectedSignature, customSignatureName, selectedFont, signatureDate, drawnSignature]);

  // Persist childName to cookie specifically
  useEffect(() => {
    setCookie('ovikreta_child_name', childName);
  }, [childName]);

  const formatDateHungarian = (dateStr) => {
    if (!dateStr) return { month: '...............', day: '......' };
    const date = new Date(dateStr);
    const months = ['január', 'február', 'március', 'április', 'május', 'június',
      'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
    return {
      month: months[date.getMonth()],
      day: date.getDate().toString()
    };
  };

  const formatYear = (dateStr) => {
    if (!dateStr) return '....';
    return new Date(dateStr).getFullYear().toString().slice(-2);
  };

  const fromFormatted = formatDateHungarian(fromDate);
  const toFormatted = formatDateHungarian(toDate);
  const sigDateFormatted = formatDateHungarian(signatureDate);

  // --- Font loading (cached across calls) ---
  const fontCacheRef = useRef(null);

  const loadFonts = async (doc) => {
    if (fontCacheRef.current) {
      doc.addFileToVFS('NotoSerif-Regular.ttf', fontCacheRef.current.regular);
      doc.addFont('NotoSerif-Regular.ttf', 'NotoSerif', 'normal');
      doc.addFileToVFS('NotoSerif-Bold.ttf', fontCacheRef.current.bold);
      doc.addFont('NotoSerif-Bold.ttf', 'NotoSerif', 'bold');
      return;
    }

    const toBase64 = (buf) => {
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    };

    const [regBuf, boldBuf] = await Promise.all([
      fetch('/fonts/NotoSerif-Regular.ttf').then(r => r.arrayBuffer()),
      fetch('/fonts/NotoSerif-Bold.ttf').then(r => r.arrayBuffer()),
    ]);

    const regular = toBase64(regBuf);
    const bold = toBase64(boldBuf);
    fontCacheRef.current = { regular, bold };

    doc.addFileToVFS('NotoSerif-Regular.ttf', regular);
    doc.addFont('NotoSerif-Regular.ttf', 'NotoSerif', 'normal');
    doc.addFileToVFS('NotoSerif-Bold.ttf', bold);
    doc.addFont('NotoSerif-Bold.ttf', 'NotoSerif', 'bold');
  };

  const isFormComplete = childName && fromDate && toDate && selectedSignature !== null && (selectedSignature !== 'custom' || customSignatureName.trim()) && (selectedSignature !== 'drawn' || drawnSignature);

  // Validation: find the first empty field and scroll to it
  const scrollToFirstError = () => {
    if (!childName && childNameRef.current) {
      childNameRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      childNameRef.current.focus();
      return;
    }
    if (!fromDate && fromDateRef.current) {
      fromDateRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fromDateRef.current.focus();
      return;
    }
    if (!toDate && toDateRef.current) {
      toDateRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toDateRef.current.focus();
      return;
    }
    if (selectedSignature === null && signatureSectionRef.current) {
      signatureSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handlePrint = async () => {
    // Validation gate
    if (!isFormComplete) {
      setHasAttemptedSubmit(true);
      setShakeButton(true);
      setTimeout(() => setShakeButton(false), 600);
      scrollToFirstError();
      return;
    }

    setIsGenerating(true);
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      await loadFonts(doc);

      const pw = 210;
      const mx = 25;
      const cw = pw - mx * 2;
      const cx = pw / 2;

      doc.setFont('NotoSerif', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(120, 120, 120);
      doc.text('OVIKRÉTA', cx, 30, { align: 'center' });

      doc.setFontSize(15);
      doc.setTextColor(0, 0, 0);
      doc.text('SZÜLŐI IGAZOLÁS', cx, 44, { align: 'center' });
      const titleW = doc.getTextWidth('SZÜLŐI IGAZOLÁS');
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.line(cx - titleW / 2, 45.5, cx + titleW / 2, 45.5);

      doc.setFont('NotoSerif', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      const kgName = kindergartenName || '.......................................................';
      doc.text(kgName, cx, 58, { align: 'center', maxWidth: cw });
      const kgW = Math.min(doc.getTextWidth(kgName), cw);
      doc.setLineDashPattern([0.8, 1.2], 0);
      doc.setDrawColor(100, 100, 100);
      doc.line(cx - kgW / 2, 60, cx + kgW / 2, 60);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('óvoda neve', cx, 64, { align: 'center' });

      doc.setLineDashPattern([], 0);
      doc.setFont('NotoSerif', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);

      let y = 78;
      const lineH = 6;

      const drawField = (text, xPos, yPos, minW) => {
        const w = Math.max(doc.getTextWidth(text), minW || 10);
        doc.text(text, xPos, yPos);
        doc.setLineDashPattern([0.8, 1.2], 0);
        doc.setDrawColor(100, 100, 100);
        doc.line(xPos, yPos + 1, xPos + w, yPos + 1);
        doc.setLineDashPattern([], 0);
        return xPos + w;
      };

      const childN = childName || '.................................';
      doc.text('Alulírott szülő (gondviselő, gyám) ezúton igazolom, hogy gyermekem', mx, y);
      y += lineH;
      doc.text(childN, cx, y, { align: 'center' });
      const cnW = doc.getTextWidth(childN);
      doc.setLineDashPattern([0.8, 1.2], 0);
      doc.setDrawColor(100, 100, 100);
      doc.line(cx - cnW / 2, y + 1, cx + cnW / 2, y + 1);
      doc.setLineDashPattern([], 0);

      y += lineH + 1;
      doc.text('az alábbi időszakban hiányzott az óvodából:', mx, y);

      y += lineH + 3;

      const fullYear = (dateStr) => {
        if (!dateStr) return '....';
        return new Date(dateStr).getFullYear().toString();
      };

      let dx = mx;
      dx = drawField(fullYear(fromDate), dx, y, 10) + 1;
      doc.text('. ', dx, y);
      dx += doc.getTextWidth('. ');
      dx = drawField(fromFormatted.month, dx, y, 18) + 2;
      doc.text('hó ', dx, y);
      dx += doc.getTextWidth('hó ');
      dx = drawField(fromFormatted.day, dx, y, 6) + 1;
      doc.text('. napjától –', dx, y);

      y += lineH;
      dx = mx;
      dx = drawField(toFormatted.month, dx, y, 18) + 2;
      doc.text('hó ', dx, y);
      dx += doc.getTextWidth('hó ');
      dx = drawField(toFormatted.day, dx, y, 6) + 1;
      doc.text('. napjáig.', dx, y);

      const footerY = 140;

      doc.setFont('NotoSerif', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);

      let sdx = mx;
      doc.text('Budapest, ', sdx, footerY);
      sdx += doc.getTextWidth('Budapest, ');
      sdx = drawField(fullYear(signatureDate), sdx, footerY, 10) + 1;
      doc.text('. ', sdx, footerY);
      sdx += doc.getTextWidth('. ');
      sdx = drawField(sigDateFormatted.month, sdx, footerY, 18) + 2;
      sdx = drawField(sigDateFormatted.day, sdx, footerY, 6) + 1;
      doc.text('.', sdx, footerY);

      const sigX = pw - mx - 55;
      const sigLineY = footerY + 2;

      doc.setLineDashPattern([0.8, 1.2], 0);
      doc.setDrawColor(100, 100, 100);
      doc.line(sigX, sigLineY, sigX + 55, sigLineY);
      doc.setLineDashPattern([], 0);

      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text('Szülő (gondviselő, gyám) aláírása', sigX + 27.5, sigLineY + 5, { align: 'center' });

      if (selectedSignature !== null) {
        try {
          const sigDataUrl = await renderSignatureToImage(
            selectedSignature, signatures, customSignatureName,
            signatureFonts[selectedFont], drawnSignature
          );
          if (sigDataUrl) {
            const sigImg = await new Promise((res) => {
              const i = new Image();
              i.onload = () => res(i);
              i.onerror = () => res(null);
              i.src = sigDataUrl;
            });
            const maxW = 50, maxH = 14;
            let imgW = maxW, imgH = maxH;
            if (sigImg && sigImg.naturalWidth && sigImg.naturalHeight) {
              const ar = sigImg.naturalWidth / sigImg.naturalHeight;
              if (ar > maxW / maxH) {
                imgW = maxW;
                imgH = maxW / ar;
              } else {
                imgH = maxH;
                imgW = maxH * ar;
              }
            }
            const imgX = sigX + (55 - imgW) / 2;
            doc.addImage(sigDataUrl, 'PNG', imgX, sigLineY - imgH, imgW, imgH);
          }
        } catch (e) {
          console.warn('Failed to embed signature:', e);
        }
      }

      doc.save('szuloi-igazolas.pdf');
      setShowToast(true);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('Hiba történt a PDF generálása közben. Kérlek próbáld újra.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper: error ring class for inputs
  const errorRing = (fieldEmpty) =>
    hasAttemptedSubmit && fieldEmpty
      ? 'border-red-300 dark:border-red-500 ring-2 ring-red-100 dark:ring-red-900/30'
      : 'border-gray-200 dark:border-gray-600';

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-950 p-4 md:p-8 pb-28 md:pb-8 transition-colors duration-300">
      <div className="max-w-5xl mx-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        {/* Header */}
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur px-5 py-2.5 md:px-6 md:py-3 rounded-full shadow-sm">
            <span className="text-xl md:text-2xl">📝</span>
            <h1 className="text-lg md:text-xl font-semibold text-gray-800 dark:text-gray-100">Szülői Igazolás Kitöltő</h1>

            {/* Dark mode toggle */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="ml-2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="Sötét/Világos mód váltás"
            >
              {darkMode ? (
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* ====== Form Panel (always first on mobile) ====== */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 md:p-8 order-1 transition-colors">
            <h2 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-5 md:mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 text-sm font-bold">1</span>
              Adatok kitöltése
            </h2>

            {/* Kindergarten Name */}
            <div className="mb-4 md:mb-5">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5 md:mb-2">Óvoda neve</label>
              <input
                type="text"
                value={kindergartenName}
                onChange={(e) => setKindergartenName(e.target.value)}
                placeholder="pl. Napraforgó Óvoda"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-800 focus:border-amber-400 dark:focus:border-amber-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 border-gray-200 dark:border-gray-600`}
              />
            </div>

            {/* Child Name */}
            <div className="mb-4 md:mb-5">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5 md:mb-2">
                Gyermek neve
                {hasAttemptedSubmit && !childName && <span className="text-red-500 ml-1 text-xs">— kötelező</span>}
              </label>
              <input
                ref={childNameRef}
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="pl. Kis Péter"
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-800 focus:border-amber-400 dark:focus:border-amber-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500 ${errorRing(!childName)}`}
              />
            </div>

            {/* Date Range */}
            <div className="mb-4 md:mb-5">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5 md:mb-2">
                Hiányzás időszaka
                {hasAttemptedSubmit && (!fromDate || !toDate) && <span className="text-red-500 ml-1 text-xs">— kötelező</span>}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">-tól</span>
                  <input
                    ref={fromDateRef}
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-800 focus:border-amber-400 dark:focus:border-amber-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-gray-100 dark:[color-scheme:dark] ${errorRing(!fromDate)}`}
                  />
                </div>
                {/* Visual arrow between dates on mobile */}
                <div className="flex items-center justify-center sm:hidden text-gray-300 dark:text-gray-600 -my-1">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 mb-1 block">-ig</span>
                  <input
                    ref={toDateRef}
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-800 focus:border-amber-400 dark:focus:border-amber-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-gray-100 dark:[color-scheme:dark] ${errorRing(!toDate)}`}
                  />
                </div>
              </div>
            </div>

            {/* Signature Date */}
            <div className="mb-5 md:mb-6">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5 md:mb-2">Aláírás dátuma</label>
              <input
                type="date"
                value={signatureDate}
                onChange={(e) => setSignatureDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-800 focus:border-amber-400 dark:focus:border-amber-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-gray-100 dark:[color-scheme:dark]"
              />
            </div>

            {/* Signature Selection */}
            <div className="mb-6" ref={signatureSectionRef}>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-200 mb-3 md:mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 text-sm font-bold">2</span>
                Aláírás kiválasztása
                {hasAttemptedSubmit && selectedSignature === null && <span className="text-red-500 text-xs font-normal ml-1">— válassz egyet</span>}
              </h3>

              {/* 2-col grid always — C5 fix */}
              <div className="grid grid-cols-2 gap-3">
                {signatures.map((sig, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSignature(idx)}
                    className={`p-3 md:p-4 border-2 rounded-xl transition-all active:scale-95 min-h-[56px] ${selectedSignature === idx
                      ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500 shadow-md'
                      : `${hasAttemptedSubmit && selectedSignature === null ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-700 hover:border-amber-200 dark:hover:border-amber-600`
                      }`}
                  >
                    <div className="h-10 flex items-center justify-center">
                      <img src={sig.src} alt={sig.alt} className="h-full w-full object-contain signature-ink" />
                    </div>
                  </button>
                ))}

                {/* Custom signature option */}
                <button
                  onClick={() => setSelectedSignature('custom')}
                  className={`p-3 md:p-4 border-2 rounded-xl transition-all active:scale-95 min-h-[56px] ${selectedSignature === 'custom'
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500 shadow-md'
                    : `${hasAttemptedSubmit && selectedSignature === null ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-700 hover:border-amber-200 dark:hover:border-amber-600`
                    }`}
                >
                  <div className="h-10 flex flex-col items-center justify-center gap-0.5">
                    <span className="text-xl">✍️</span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Géppel</span>
                  </div>
                </button>

                {/* Drawn (hand) signature option */}
                <button
                  onClick={() => setSelectedSignature('drawn')}
                  className={`p-3 md:p-4 border-2 rounded-xl transition-all active:scale-95 min-h-[56px] ${selectedSignature === 'drawn'
                    ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500 shadow-md'
                    : `${hasAttemptedSubmit && selectedSignature === null ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-600'} bg-white dark:bg-gray-700 hover:border-amber-200 dark:hover:border-amber-600`
                    }`}
                >
                  <div className="h-10 flex flex-col items-center justify-center gap-0.5">
                    {drawnSignature ? (
                      <img src={drawnSignature} alt="Kézzel rajzolt" className="h-full w-full object-contain" />
                    ) : (
                      <>
                        <span className="text-xl">🤳</span>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Kézzel</span>
                      </>
                    )}
                  </div>
                </button>
              </div>

              {/* Custom signature input */}
              {selectedSignature === 'custom' && (
                <div className="mt-4 space-y-4 animate-fade-in">
                  <input
                    type="text"
                    value={customSignatureName}
                    onChange={(e) => setCustomSignatureName(e.target.value)}
                    placeholder="Írd be a neved..."
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-800 focus:border-amber-400 dark:focus:border-amber-500 outline-none transition-all text-lg bg-white dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-500"
                  />
                  {/* Font picker */}
                  {customSignatureName && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Stílus kiválasztása</span>
                      <div className="grid grid-cols-1 gap-2">
                        {signatureFonts.map((font, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedFont(idx)}
                            className={`group relative px-4 py-3 border-2 rounded-xl transition-all text-left active:scale-[0.98] ${selectedFont === idx
                              ? 'border-amber-400 dark:border-amber-500 bg-amber-50/80 dark:bg-amber-900/20 shadow-md'
                              : 'border-gray-100 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/50 hover:border-amber-200 dark:hover:border-amber-600 hover:bg-white dark:hover:bg-gray-700'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span
                                className="signature-ink-text truncate flex-1"
                                style={{ fontFamily: font.family, fontSize: font.size, lineHeight: 1.3 }}
                              >
                                {customSignatureName}
                              </span>
                              <span className={`text-[10px] font-medium uppercase tracking-wider shrink-0 px-2 py-0.5 rounded-full ${selectedFont === idx
                                ? 'bg-amber-200/60 dark:bg-amber-800/60 text-amber-700 dark:text-amber-300'
                                : 'bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40 group-hover:text-amber-600 dark:group-hover:text-amber-400'
                                }`}>
                                {font.label}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Drawn signature area */}
              {selectedSignature === 'drawn' && (
                <div className="mt-4 animate-fade-in">
                  {isMobile ? (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Írja alá ujjával az alábbi mezőben:</p>
                      <SignaturePad
                        onSignatureChange={(dataUrl) => setDrawnSignature(dataUrl)}
                        compact
                      />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {drawnSignature ? (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-700 flex items-center gap-3">
                            <img src={drawnSignature} alt="Aláírás" className="h-10 object-contain" />
                            <span className="text-sm text-green-700 dark:text-green-400 font-medium">Aláírás rögzítve ✓</span>
                          </div>
                          <button
                            onClick={() => setDrawnSignature(null)}
                            className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 border border-gray-200 dark:border-gray-600 hover:border-amber-300 dark:hover:border-amber-500 rounded-xl transition-all"
                          >
                            Újra
                          </button>
                        </div>
                      ) : showDesktopPad ? (
                        <div className="space-y-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Írja alá egérrel az alábbi mezőben:</p>
                          <SignaturePad
                            onSignatureChange={(dataUrl) => setDrawnSignature(dataUrl)}
                            compact
                          />
                          <button
                            onClick={() => setShowDesktopPad(false)}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          >
                            ← Vissza a lehetőségekhez
                          </button>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setShowDesktopPad(true)}
                            className="py-3 px-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-dashed border-amber-300 dark:border-amber-600 rounded-xl text-amber-700 dark:text-amber-400 font-medium text-sm hover:shadow-md active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1.5"
                          >
                            <span className="text-lg">🖊️</span>
                            Aláírás egérrel
                          </button>
                          <button
                            onClick={() => setShowQRModal(true)}
                            className="py-3 px-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border-2 border-dashed border-amber-300 dark:border-amber-600 rounded-xl text-amber-700 dark:text-amber-400 font-medium text-sm hover:shadow-md active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-1.5"
                          >
                            <span className="text-lg">📱</span>
                            Aláírás telefonon
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Desktop-only inline Download Button */}
            <div className="hidden md:block">
              <button
                onClick={handlePrint}
                disabled={isGenerating}
                className={`w-full py-4 rounded-xl font-medium text-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${isFormComplete && !isGenerating
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                  }`}
              >
                {isGenerating ? (
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                {isGenerating ? 'Generálás...' : 'PDF letöltése'}
              </button>
              {hasAttemptedSubmit && !isFormComplete && (
                <p className="text-center text-sm text-red-400 dark:text-red-500 mt-2 animate-fade-in">
                  Kérlek töltsd ki az összes mezőt és válassz aláírást
                </p>
              )}
            </div>
          </div>

          {/* ====== Preview Panel ====== */}
          <div className="order-2 transition-colors">
            {/* Mobile: collapsible accordion */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full md:hidden flex items-center justify-between bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 mb-2 transition-colors"
            >
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span className="font-medium text-sm">Előnézet</span>
              </div>
              <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showPreview ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Preview content: always visible on desktop, toggle on mobile */}
            <div className={`${showPreview ? 'block' : 'hidden'} md:block bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-5 md:p-8 transition-colors`}>
              <h2 className="hidden md:flex text-lg font-medium text-gray-700 dark:text-gray-200 mb-4 items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Előnézet
              </h2>

              {/* Document Preview — always white background (paper) */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 md:p-6 bg-white font-serif text-sm text-black">
                <div className="text-center mb-6">
                  <div className="text-gray-500 font-bold tracking-wide mb-4">OVIKRÉTA</div>
                  <h3 className="text-lg font-bold underline">SZÜLŐI IGAZOLÁS</h3>
                </div>

                <div className="text-center mb-6">
                  <div className="inline-block border-b border-dotted border-gray-400 min-w-[200px] px-4 py-1">
                    {kindergartenName || <span className="text-gray-300">óvoda neve</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">óvoda neve</div>
                </div>

                <div className="leading-relaxed mb-4">
                  <p>
                    Alulírott szülő (gondviselő, gyám) ezúton igazolom, hogy gyermekem{' '}
                    <span className="inline-block border-b border-dotted border-gray-400 min-w-[150px] px-2 text-center">
                      {childName || <span className="text-gray-300">gyermek neve</span>}
                    </span>
                  </p>
                </div>

                <p className="mb-4">az alábbi időszakban hiányzott az óvodából:</p>

                <p className="mb-6">
                  202<span className="inline-block border-b border-dotted border-gray-400 min-w-[20px] px-1 text-center">{formatYear(fromDate)}</span>{' '}
                  <span className="inline-block border-b border-dotted border-gray-400 min-w-[80px] px-2 text-center">{fromFormatted.month}</span> hó{' '}
                  <span className="inline-block border-b border-dotted border-gray-400 min-w-[30px] px-1 text-center">{fromFormatted.day}</span>. napjától –{' '}
                  <span className="inline-block border-b border-dotted border-gray-400 min-w-[80px] px-2 text-center">{toFormatted.month}</span> hó{' '}
                  <span className="inline-block border-b border-dotted border-gray-400 min-w-[30px] px-1 text-center">{toFormatted.day}</span>. napjáig.
                </p>

                <div className="flex justify-between items-end mt-10">
                  <div>
                    <p>
                      Budapest, 202<span className="inline-block border-b border-dotted border-gray-400 min-w-[20px] px-1 text-center">{formatYear(signatureDate)}</span>.{' '}
                      <span className="inline-block border-b border-dotted border-gray-400 min-w-[80px] px-2 text-center">{sigDateFormatted.month}</span>{' '}
                      <span className="inline-block border-b border-dotted border-gray-400 min-w-[30px] px-1 text-center">{sigDateFormatted.day}</span>.
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="signature-line border-b border-dotted border-gray-400 w-48 h-12 flex items-end justify-center pb-1 relative overflow-visible">
                      {selectedSignature !== null && selectedSignature !== 'custom' && selectedSignature !== 'drawn' && (
                        <div className="absolute left-1/2 -translate-x-1/2 w-[66px] h-[60px] signature-svg" style={{ bottom: '-8px' }}>
                          <img src={signatures[selectedSignature].src} alt={signatures[selectedSignature].alt} className="w-full h-full object-contain signature-ink" />
                        </div>
                      )}
                      {selectedSignature === 'custom' && customSignatureName && (
                        <div className="w-44 h-10 flex items-end justify-center">
                          <span className="signature-ink-text" style={{ fontFamily: signatureFonts[selectedFont].family, fontSize: '1.25rem', lineHeight: 1 }}>
                            {customSignatureName}
                          </span>
                        </div>
                      )}
                      {selectedSignature === 'drawn' && drawnSignature && (
                        <div className="w-44 h-10 signature-drawn">
                          <img src={drawnSignature} alt="Kézzel rajzolt aláírás" className="w-full h-full object-contain" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Szülő (gondviselő, gyám) aláírása</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer — hidden on mobile to save space */}
        <div className="hidden md:block text-center mt-8 text-gray-400 dark:text-gray-600 text-sm">
          Készítsd el gyorsan és egyszerűen a szülői igazolást 📄
        </div>
      </div>

      {/* ====== Mobile Sticky CTA ====== */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/90 dark:bg-gray-800/90 backdrop-blur-lg border-t border-gray-200/50 dark:border-gray-700/50 px-4 pt-3 transition-colors"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handlePrint}
          disabled={isGenerating}
          className={`w-full py-3.5 rounded-2xl font-semibold text-base transition-all flex items-center justify-center gap-2 active:scale-[0.97] ${shakeButton ? 'animate-shake' : ''} ${isFormComplete && !isGenerating
            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg'
            : 'bg-gradient-to-r from-amber-500/60 to-orange-500/60 dark:from-amber-600/40 dark:to-orange-600/40 text-white/80'
            }`}
        >
          {isGenerating ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          {isGenerating ? 'Generálás...' : 'PDF letöltése'}
        </button>
      </div>

      {/* Success Toast */}
      <SuccessToast show={showToast} onDone={() => setShowToast(false)} />

      {/* QR Signature Modal */}
      {showQRModal && (
        <QRSignatureModal
          onSignature={(dataUrl) => {
            setDrawnSignature(dataUrl);
            setShowQRModal(false);
          }}
          onClose={() => setShowQRModal(false)}
        />
      )}
    </div>
  );
}
