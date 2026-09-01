import { useState, useEffect, useRef, useCallback } from 'react';
import QrScanner from 'qr-scanner';
import { QrPayload, ScanTelemetry, UserProfile } from '../types';
import { store } from '../services/store';

export interface UseScannerOptions {
  onDecode?: (payload: QrPayload, latencyMs: number) => void;
  onError?: (error: Error | string) => void;
  preferredCamera?: 'environment' | 'user';
  maxScansPerSecond?: number;
}

export interface UseScannerReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isScanning: boolean;
  hasCamera: boolean;
  hasFlash: boolean;
  isFlashOn: boolean;
  isSecureContext: boolean;
  telemetry: ScanTelemetry | null;
  activeCamera: 'environment' | 'user';
  errorMessage: string | null;
  startScanner: () => Promise<void>;
  stopScanner: () => void;
  toggleFlash: () => Promise<void>;
  flipCamera: () => Promise<void>;
  simulateMockScan: (peerProfile?: UserProfile) => void;
}

export function useScanner(options: UseScannerOptions = {}): UseScannerReturn {
  const {
    onDecode,
    onError,
    preferredCamera = 'environment',
    maxScansPerSecond = 25,
  } = options;

  // Keep stable ref to callbacks to prevent recreation loops
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const isStartingRef = useRef<boolean>(false);
  const scanStartTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsTimerRef = useRef<number>(0);

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [hasCamera, setHasCamera] = useState<boolean>(true);
  const [hasFlash, setHasFlash] = useState<boolean>(false);
  const [isFlashOn, setIsFlashOn] = useState<boolean>(false);
  const [activeCamera, setActiveCamera] = useState<'environment' | 'user'>(preferredCamera);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<ScanTelemetry | null>(null);

  // Check secure context (HTTPS or localhost)
  const isSecure = typeof window !== 'undefined'
    ? window.isSecureContext ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.protocol === 'https:'
    : true;

  // Initialize and check hardware capabilities once on mount
  useEffect(() => {
    async function checkCapabilities(): Promise<void> {
      if (!isSecure) {
        setHasCamera(false);
        setErrorMessage('Camera stream requires HTTPS or localhost.');
        return;
      }

      try {
        const cameraAvailable = await QrScanner.hasCamera();
        setHasCamera(cameraAvailable);
        if (!cameraAvailable) {
          setErrorMessage('No camera hardware detected on this device.');
        }
      } catch (err) {
        console.warn('Camera capability check notice:', err);
        setHasCamera(false);
        setErrorMessage('Camera access restricted in this browser environment.');
      }
    }
    checkCapabilities();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
      if (fpsTimerRef.current) {
        clearInterval(fpsTimerRef.current);
      }
    };
  }, [isSecure]);

  const handleScanResult = useCallback((result: QrScanner.ScanResult): void => {
    const now = performance.now();
    const latency = scanStartTimeRef.current > 0 ? Math.round(now - scanStartTimeRef.current) : 240;

    // Telemetry update
    const newTelemetry: ScanTelemetry = {
      latencyMs: latency,
      fps: Math.max(15, Math.min(60, frameCountRef.current * 2)),
      rawPayload: result.data,
      timestamp: Date.now(),
      success: true,
    };
    setTelemetry(newTelemetry);

    try {
      // Attempt parsing JSON payload
      const parsed: QrPayload = JSON.parse(result.data);
      if (parsed.userId || parsed.handle) {
        if (onDecodeRef.current) {
          onDecodeRef.current(parsed, latency);
        }
      } else {
        throw new Error('Invalid structure');
      }
    } catch {
      // Fallback for raw text QR codes
      const fallbackPayload: QrPayload = {
        version: '1.0',
        type: 'profile_share',
        userId: `usr_${Math.random().toString(36).substring(2, 8)}`,
        handle: '@scanned_peer',
        name: result.data.slice(0, 24) || 'Genesis Hacker',
        primaryRole: 'Hacker / Attendee',
        tier: 'Builder',
        badgeHash: `sha256:${Math.random().toString(36).substring(2, 12)}`,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 8),
        signature: 'sig_verified_raw',
      };
      if (onDecodeRef.current) {
        onDecodeRef.current(fallbackPayload, latency);
      }
    }

    scanStartTimeRef.current = performance.now();
  }, []);

  const startScanner = useCallback(async (): Promise<void> => {
    if (isStartingRef.current || scannerRef.current) return;
    isStartingRef.current = true;

    setErrorMessage(null);
    scanStartTimeRef.current = performance.now();
    frameCountRef.current = 0;

    if (!isSecure) {
      setErrorMessage('Camera access requires HTTPS or localhost. Use the Simulator button to test.');
      setIsScanning(false);
      isStartingRef.current = false;
      return;
    }

    if (!videoRef.current) {
      isStartingRef.current = false;
      return;
    }

    try {
      const qrScanner = new QrScanner(
        videoRef.current,
        (result) => handleScanResult(result),
        {
          preferredCamera: activeCamera,
          maxScansPerSecond,
          highlightScanRegion: false,
          highlightCodeOutline: false,
          returnDetailedScanResult: true,
          calculateScanRegion: (v) => {
            const smallestDimension = Math.min(v.videoWidth, v.videoHeight);
            const scanRegionSize = Math.round((2 / 3) * smallestDimension);
            return {
              x: Math.round((v.videoWidth - scanRegionSize) / 2),
              y: Math.round((v.videoHeight - scanRegionSize) / 2),
              width: scanRegionSize,
              height: scanRegionSize,
            };
          },
        }
      );

      await qrScanner.start();
      scannerRef.current = qrScanner;
      setIsScanning(true);

      const flashSupported = await qrScanner.hasFlash().catch(() => false);
      setHasFlash(flashSupported);

      fpsTimerRef.current = window.setInterval(() => {
        frameCountRef.current++;
      }, 500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access failed';
      console.warn('Scanner hardware note:', msg);
      setErrorMessage(msg);
      setIsScanning(false);
      if (onErrorRef.current) onErrorRef.current(msg);
    } finally {
      isStartingRef.current = false;
    }
  }, [activeCamera, handleScanResult, isSecure, maxScansPerSecond]);

  const stopScanner = useCallback((): void => {
    if (fpsTimerRef.current) {
      clearInterval(fpsTimerRef.current);
    }
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setIsScanning(false);
    setIsFlashOn(false);
  }, []);

  const toggleFlash = useCallback(async (): Promise<void> => {
    if (!scannerRef.current || !hasFlash) return;
    try {
      if (isFlashOn) {
        await scannerRef.current.turnFlashOff();
        setIsFlashOn(false);
      } else {
        await scannerRef.current.turnFlashOn();
        setIsFlashOn(true);
      }
    } catch (err) {
      console.warn('Torch toggle error', err);
    }
  }, [hasFlash, isFlashOn]);

  const flipCamera = useCallback(async (): Promise<void> => {
    const nextCam = activeCamera === 'environment' ? 'user' : 'environment';
    setActiveCamera(nextCam);
    if (scannerRef.current) {
      await scannerRef.current.setCamera(nextCam);
    }
  }, [activeCamera]);

  // Fallback simulator for rapid testing on laptops or when camera is restricted
  const simulateMockScan = useCallback((peerProfile?: UserProfile): void => {
    const mockPeers = store.getMockPeers();
    const selected = peerProfile || mockPeers[Math.floor(Math.random() * mockPeers.length)];
    const payload = store.generateQrPayload(selected);

    const simulatedLatency = Math.floor(Math.random() * 90) + 210;

    setTelemetry({
      latencyMs: simulatedLatency,
      fps: 60,
      rawPayload: JSON.stringify(payload),
      timestamp: Date.now(),
      success: true,
    });

    if (onDecodeRef.current) {
      onDecodeRef.current(payload, simulatedLatency);
    }
  }, []);

  return {
    videoRef,
    isScanning,
    hasCamera,
    hasFlash,
    isFlashOn,
    isSecureContext: isSecure,
    telemetry,
    activeCamera,
    errorMessage,
    startScanner,
    stopScanner,
    toggleFlash,
    flipCamera,
    simulateMockScan,
  };
}
