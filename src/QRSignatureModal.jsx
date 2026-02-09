import React, { useState, useEffect, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Peer from 'peerjs';

/**
 * Full-screen modal: shows a QR code linking to the mobile signing page.
 * Uses PeerJS (WebRTC) for serverless cross-device communication.
 *
 * Props:
 *  - onSignature(dataUrl) — called when signature is received
 *  - onClose() — called when user cancels
 */
export default function QRSignatureModal({ onSignature, onClose }) {
    const [peerId, setPeerId] = useState(null);
    const [status, setStatus] = useState('connecting'); // connecting | waiting | received
    const [error, setError] = useState(null);
    const peerRef = useRef(null);

    useEffect(() => {
        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', (id) => {
            setPeerId(id);
            setStatus('waiting');
        });

        peer.on('connection', (conn) => {
            setStatus('connected');

            conn.on('data', (data) => {
                if (data && data.type === 'signature' && data.dataUrl) {
                    setStatus('received');
                    onSignature(data.dataUrl);
                    // Small delay so user sees the success state
                    setTimeout(() => {
                        peer.destroy();
                    }, 500);
                }
            });

            conn.on('close', () => {
                // Phone disconnected without sending
            });
        });

        peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            setError('Kapcsolódási hiba. Kérlek próbáld újra.');
        });

        return () => {
            peer.destroy();
        };
    }, [onSignature]);

    const signingUrl = peerId
        ? `${window.location.origin}${window.location.pathname}#/sign/${peerId}`
        : null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-scale-in">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="text-center">
                    {/* Header */}
                    <div className="w-14 h-14 bg-gradient-to-br from-amber-100 to-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">📱</span>
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">Aláírás telefonon</h3>
                    <p className="text-sm text-gray-500 mb-6">
                        Olvassa be a QR kódot a telefonjával
                    </p>

                    {/* QR Code */}
                    {status === 'connecting' && (
                        <div className="py-12">
                            <div className="w-10 h-10 border-3 border-amber-200 border-t-amber-500 rounded-full animate-spin mx-auto" />
                            <p className="text-sm text-gray-400 mt-4">Kapcsolódás...</p>
                        </div>
                    )}

                    {status === 'waiting' && signingUrl && (
                        <>
                            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-inner inline-block mb-4">
                                <QRCodeSVG
                                    value={signingUrl}
                                    size={200}
                                    bgColor="transparent"
                                    fgColor="#1f2937"
                                    level="M"
                                    includeMargin={false}
                                />
                            </div>
                            <div className="flex items-center justify-center gap-2 text-sm text-amber-600">
                                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
                                Várakozás az aláírásra...
                            </div>
                        </>
                    )}

                    {status === 'connected' && (
                        <div className="py-8">
                            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl">🤳</span>
                            </div>
                            <p className="text-sm font-medium text-green-600">Telefon csatlakozva!</p>
                            <p className="text-xs text-gray-400 mt-1">Írja alá a telefonján...</p>
                        </div>
                    )}

                    {status === 'received' && (
                        <div className="py-8">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
                                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <p className="text-sm font-medium text-green-600">Aláírás megérkezett! ✨</p>
                        </div>
                    )}

                    {error && (
                        <div className="py-6">
                            <p className="text-sm text-red-500">{error}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-3 text-sm text-amber-600 hover:text-amber-700 font-medium"
                            >
                                Újrapróbálom
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
