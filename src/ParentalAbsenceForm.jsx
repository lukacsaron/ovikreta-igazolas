import React, { useState, useRef, useEffect, useCallback } from 'react';

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

// Initialise state from session/cookie, falling back to defaults
const saved = loadSession();
const cookieChildName = getCookie('ovikreta_child_name');

export default function ParentalAbsenceForm() {
  const [childName, setChildName] = useState(cookieChildName || saved.childName || '');
  const [kindergartenName, setKindergartenName] = useState(saved.kindergartenName ?? 'Budapest Főváros XIII. Kerületi Önkormányzat Egyesített Óvoda Zöld Ág Tagóvodája');
  const [fromDate, setFromDate] = useState(saved.fromDate || '');
  const [toDate, setToDate] = useState(saved.toDate || '');
  const [selectedSignature, setSelectedSignature] = useState(saved.selectedSignature ?? null);
  const [customSignatureName, setCustomSignatureName] = useState(saved.customSignatureName || '');
  const [selectedFont, setSelectedFont] = useState(saved.selectedFont ?? 0);
  const [signatureDate, setSignatureDate] = useState(saved.signatureDate || new Date().toISOString().split('T')[0]);
  const printRef = useRef();

  // Persist all fields to sessionStorage on every change
  useEffect(() => {
    saveSession({ childName, kindergartenName, fromDate, toDate, selectedSignature, customSignatureName, selectedFont, signatureDate });
  }, [childName, kindergartenName, fromDate, toDate, selectedSignature, customSignatureName, selectedFont, signatureDate]);

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

  const handlePrint = () => {
    const printContent = printRef.current;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Szülői Igazolás</title>
          <link href="https://fonts.googleapis.com/css2?family=Mr+Dafoe&family=Mrs+Saint+Delafield&family=Kristi&family=Homemade+Apple&family=Herr+Von+Muellerhoff&display=swap" rel="stylesheet" />
          <style>
            @page { size: A4; margin: 20mm; }
            body { 
              font-family: 'Times New Roman', serif; 
              padding: 40px;
              max-width: 700px;
              margin: 0 auto;
            }
            .header { text-align: center; margin-bottom: 30px; }
            .logo { font-weight: bold; font-size: 18px; color: #666; margin-bottom: 10px; }
            .title { font-size: 20px; font-weight: bold; text-decoration: underline; margin: 20px 0; }
            .kindergarten-line { 
              border-bottom: 1px dotted #333; 
              min-width: 300px; 
              display: inline-block; 
              text-align: center;
              padding: 5px 20px;
              margin-bottom: 5px;
            }
            .small-label { font-size: 12px; color: #666; }
            .content { line-height: 2; margin: 30px 0; font-size: 14px; }
            .child-name { 
              border-bottom: 1px dotted #333; 
              min-width: 250px; 
              display: inline-block;
              padding: 0 10px;
            }
            .date-section { margin: 20px 0; }
            .footer { margin-top: 60px; display: flex; justify-content: space-between; align-items: flex-end; }
            .footer-left { }
            .footer-right { text-align: center; }
            .signature-line { 
              border-bottom: 1px dotted #333; 
              width: 200px; 
              height: 50px;
              display: flex;
              align-items: flex-end;
              justify-content: center;
              padding-bottom: 5px;
            }
            .signature-label { font-size: 12px; color: #666; margin-top: 5px; }
            .signature-svg { width: 180px; height: 45px; }
            .signature-svg img { width: 100%; height: 100%; object-fit: contain; }
            .signature-ink { filter: brightness(0) saturate(100%) invert(20%) sepia(60%) saturate(2500%) hue-rotate(235deg) brightness(85%); }
            .signature-ink-text { color: #3b2d8b; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const isFormComplete = childName && fromDate && toDate && selectedSignature !== null && (selectedSignature !== 'custom' || customSignatureName.trim());

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-6 py-3 rounded-full shadow-sm">
            <span className="text-2xl">📝</span>
            <h1 className="text-xl font-semibold text-gray-800">Szülői Igazolás Kitöltő</h1>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form Panel */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 order-2 lg:order-1">
            <h2 className="text-lg font-medium text-gray-700 mb-6 flex items-center gap-2">
              <span className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-sm font-bold">1</span>
              Adatok kitöltése
            </h2>

            {/* Kindergarten Name */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-600 mb-2">Óvoda neve</label>
              <input
                type="text"
                value={kindergartenName}
                onChange={(e) => setKindergartenName(e.target.value)}
                placeholder="pl. Napraforgó Óvoda"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none transition-all"
              />
            </div>

            {/* Child Name */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-600 mb-2">Gyermek neve</label>
              <input
                type="text"
                value={childName}
                onChange={(e) => setChildName(e.target.value)}
                placeholder="pl. Kis Péter"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none transition-all"
              />
            </div>

            {/* Date Range */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-600 mb-2">Hiányzás időszaka</label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-xs text-gray-400 mb-1 block">-tól</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-400 mb-1 block">-ig</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Signature Date */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-600 mb-2">Aláírás dátuma</label>
              <input
                type="date"
                value={signatureDate}
                onChange={(e) => setSignatureDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none transition-all"
              />
            </div>

            {/* Signature Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-sm font-bold">2</span>
                Aláírás kiválasztása
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {signatures.map((sig, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedSignature(idx)}
                    className={`p-4 border-2 rounded-xl transition-all hover:shadow-md ${selectedSignature === idx
                      ? 'border-amber-400 bg-amber-50 shadow-md'
                      : 'border-gray-200 bg-white hover:border-amber-200'
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
                  className={`p-4 border-2 rounded-xl transition-all hover:shadow-md ${selectedSignature === 'custom'
                    ? 'border-amber-400 bg-amber-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-amber-200'
                    }`}
                >
                  <div className="h-10 flex items-center justify-center text-gray-400">
                    <span className="text-2xl">✍️</span>
                  </div>
                </button>
              </div>

              {/* Custom signature input */}
              {selectedSignature === 'custom' && (
                <div className="mt-4 space-y-4">
                  <input
                    type="text"
                    value={customSignatureName}
                    onChange={(e) => setCustomSignatureName(e.target.value)}
                    placeholder="Írd be a neved..."
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-200 focus:border-amber-400 outline-none transition-all text-lg"
                  />
                  {/* Font picker */}
                  {customSignatureName && (
                    <div className="space-y-2">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Stílus kiválasztása</span>
                      <div className="grid grid-cols-1 gap-2">
                        {signatureFonts.map((font, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedFont(idx)}
                            className={`group relative px-4 py-3 border-2 rounded-xl transition-all text-left hover:shadow-md ${selectedFont === idx
                                ? 'border-amber-400 bg-amber-50/80 shadow-md'
                                : 'border-gray-100 bg-gray-50/50 hover:border-amber-200 hover:bg-white'
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
                                  ? 'bg-amber-200/60 text-amber-700'
                                  : 'bg-gray-100 text-gray-400 group-hover:bg-amber-100 group-hover:text-amber-600'
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
            </div>

            {/* Download Button */}
            <button
              onClick={handlePrint}
              disabled={!isFormComplete}
              className={`w-full py-4 rounded-xl font-medium text-lg transition-all flex items-center justify-center gap-2 ${isFormComplete
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:scale-[1.02]'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Letöltés PDF-ként
            </button>
            {!isFormComplete && (
              <p className="text-center text-sm text-gray-400 mt-2">
                Kérlek töltsd ki az összes mezőt és válassz aláírást
              </p>
            )}
          </div>

          {/* Preview Panel */}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 order-1 lg:order-2">
            <h2 className="text-lg font-medium text-gray-700 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Előnézet
            </h2>

            {/* Document Preview */}
            <div ref={printRef} className="border border-gray-200 rounded-xl p-6 bg-white font-serif text-sm">
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
                  <div className="signature-line border-b border-dotted border-gray-400 w-48 h-12 flex items-end justify-center pb-1">
                    {selectedSignature !== null && selectedSignature !== 'custom' && (
                      <div className="w-44 h-10 signature-svg">
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
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Szülő (gondviselő, gyám) aláírása</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-400 text-sm">
          Készítsd el gyorsan és egyszerűen a szülői igazolást 📄
        </div>
      </div>
    </div>
  );
}
