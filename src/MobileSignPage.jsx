import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import SignaturePad from './SignaturePad';

/**
 * Full-screen mobile signing page.
 * Opened via QR code URL: #/sign/{peerId}
 * Connects to desktop via PeerJS and sends the drawn signature back.
 */
export default function MobileSignPage({ targetPeerId }) {
    const [status, setStatus] = useState('connecting'); // connecting | ready | sending | sent | error
    const [signatureDataUrl, setSignatureDataUrl] = useState(null);
    const connRef = useRef(null);

    useEffect(() => {
        const peer = new Peer();

        peer.on('open', () => {
            const conn = peer.connect(targetPeerId, { reliable: true });
            connRef.current = conn;

            conn.on('open', () => {
                setStatus('ready');
            });

            conn.on('error', (err) => {
                console.error('Connection error:', err);
                setStatus('error');
            });

            conn.on('close', () => {
                // Desktop closed
            });
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            setStatus('error');
        });

        return () => {
            peer.destroy();
        };
    }, [targetPeerId]);

    const sendSignature = () => {
        if (!signatureDataUrl || !connRef.current) return;
        setStatus('sending');
        connRef.current.send({ type: 'signature', dataUrl: signatureDataUrl });
        setTimeout(() => setStatus('sent'), 300);
    };

    return (
        <div className="min-h-[100dvh] bg-gradient-to-b from-amber-50 via-orange-50 to-yellow-50 flex flex-col overflow-y-auto" style={{ touchAction: 'pan-y' }}>
            {/* Header */}
            <div className="flex-shrink-0 px-6 pt-8 pb-4 text-center">
                <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-5 py-2.5 rounded-full shadow-sm mb-3">
                    <span className="text-lg">✍️</span>
                    <span className="text-base font-semibold text-gray-800">OviKréta Aláírás</span>
                </div>

                {status === 'connecting' && (
                    <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mt-2">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                        Csatlakozás...
                    </div>
                )}

                {status === 'ready' && (
                    <p className="text-sm text-gray-500 mt-2">
                        Írja alá ujjával az alábbi mezőben
                    </p>
                )}
            </div>

            {/* Signature area */}
            {(status === 'ready' || status === 'sending') && (
                <div className="flex-1 flex flex-col px-4 pb-4 min-h-0">
                    <div className="flex-1 min-h-0">
                        <SignaturePad
                            onSignatureChange={setSignatureDataUrl}
                            className="h-full"
                        />
                    </div>

                    {/* Submit button */}
                    <div className="flex-shrink-0 mt-4 px-2">
                        <button
                            onClick={sendSignature}
                            disabled={!signatureDataUrl || status === 'sending'}
                            className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all flex items-center justify-center gap-2 ${signatureDataUrl && status !== 'sending'
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg active:scale-[0.98]'
                                : 'bg-gray-100 text-gray-400'
                                }`}
                        >
                            {status === 'sending' ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Küldés...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    Kész, aláírtam!
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* Success */}
            {status === 'sent' && (
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4 animate-bounce">
                        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Aláírás elküldve! 🎉</h2>
                    <p className="text-sm text-gray-500 text-center">
                        Az aláírás megjelent a számítógépén.<br />
                        Ezt az ablakot bezárhatja.
                    </p>
                </div>
            )}

            {/* Error */}
            {status === 'error' && (
                <div className="flex-1 flex flex-col items-center justify-center px-6">
                    <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                        <span className="text-3xl">😕</span>
                    </div>
                    <h2 className="text-lg font-bold text-gray-800 mb-2">Kapcsolódási hiba</h2>
                    <p className="text-sm text-gray-500 text-center mb-4">
                        Nem sikerült csatlakozni. Kérjük, olvassa be újra a QR kódot.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2.5 bg-amber-100 text-amber-700 rounded-xl font-medium text-sm hover:bg-amber-200 transition-all"
                    >
                        Újrapróbálom
                    </button>
                </div>
            )}

            {/* iOS overscroll prevention — allow vertical scroll */}
            <style>{`
        html, body { overflow-x: hidden; width: 100%; }
        @media (orientation: landscape) and (max-height: 500px) {
          html, body { overflow-y: auto !important; height: auto !important; }
        }
      `}</style>
        </div>
    );
}
