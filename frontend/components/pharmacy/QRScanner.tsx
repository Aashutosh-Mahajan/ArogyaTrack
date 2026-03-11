'use client';

import { useEffect, useRef, useCallback } from 'react';

interface QRScannerProps {
    onScan: (data: string) => void;
    onError?: (error: string) => void;
    isActive: boolean;
}

export function QRScanner({ onScan, onError, isActive }: QRScannerProps) {
    const scannerRef = useRef<any>(null);
    const mountedRef = useRef(true);
    const scannedRef = useRef(false);

    const stopScanner = useCallback(async () => {
        if (scannerRef.current) {
            try {
                const state = scannerRef.current.getState();
                // 2 = SCANNING, 3 = PAUSED
                if (state === 2 || state === 3) {
                    await scannerRef.current.stop();
                }
            } catch {
                // ignore
            }
            scannerRef.current = null;
        }
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        scannedRef.current = false;

        if (!isActive) return;

        const scannerId = 'qr-reader-container';

        const startScanner = async () => {
            // Dynamic import to avoid SSR issues
            const { Html5Qrcode } = await import('html5-qrcode');

            // Make sure the container div exists and is empty
            const container = document.getElementById(scannerId);
            if (!container || !mountedRef.current) return;

            // Clear any leftover content
            container.innerHTML = '';

            try {
                const scanner = new Html5Qrcode(scannerId, /* verbose */ false);
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                    },
                    (decodedText: string) => {
                        if (scannedRef.current) return;
                        scannedRef.current = true;
                        onScan(decodedText);
                        scanner.stop().catch(() => {});
                    },
                    () => {
                        // QR not found in frame — normal, ignore
                    }
                );
            } catch (err: any) {
                console.error('QR Scanner Error:', err);
                if (mountedRef.current) {
                    onError?.(
                        typeof err === 'string'
                            ? err
                            : err?.message || 'Failed to start camera. Please allow camera access.'
                    );
                }
            }
        };

        // Small delay to ensure DOM is ready
        const timer = setTimeout(startScanner, 100);

        return () => {
            mountedRef.current = false;
            clearTimeout(timer);
            stopScanner();
        };
    }, [isActive, onScan, onError, stopScanner]);

    if (!isActive) return null;

    return (
        <div className="w-full max-w-sm mx-auto">
            <div
                id="qr-reader-container"
                className="rounded-xl overflow-hidden"
                style={{ minHeight: 300 }}
            />
        </div>
    );
}
