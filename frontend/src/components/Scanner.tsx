import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { ScanResult } from '../types';
import apiService from '../services/api';

interface ScannerProps {
  onScanSuccess?: (result: ScanResult) => void;
  onScanError?: (error: string) => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScanSuccess, onScanError }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [useCamera, setUseCamera] = useState(true);
  const [manualCode, setManualCode] = useState('');
  const deviceIdRef = useRef(
    `device-${Math.random().toString(36).substring(2, 11)}`
  );

  // Get user's geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        (err) => {
          console.warn('Geolocation error:', err);
        }
      );
    }
  }, []);

  // Initialize camera scanning
  useEffect(() => {
    if (!useCamera) return;

    let decodingStream: any;
    let cleanup: () => void;

    const initScanner = async (): Promise<void> => {
      try {
        codeReaderRef.current = new BrowserMultiFormatReader();
        const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();

        if (videoInputDevices.length === 0) {
          setError('No camera devices found');
          return;
        }

        // Use back camera if available
        const backCamera =
          videoInputDevices.find((device) =>
            device.label.toLowerCase().includes('back')
          ) || videoInputDevices[0];

        decodingStream = await codeReaderRef.current.decodeFromVideoDevice(
          backCamera.deviceId,
          videoRef.current!,
          (result) => {
            if (result) {
              handleScanResult(result.toString());
            }
          }
        );

        cleanup = () => {
          if (decodingStream) (codeReaderRef.current as any)?.reset();
        };
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize camera');
      }
    };

    initScanner();

    return () => {
      cleanup?.();
    };
  }, [useCamera]);

  const handleScanResult = async (code: string): Promise<void> => {
    // Add to scanned codes list (prevent duplicates in short timeframe)
    if (scannedCodes.includes(code)) {
      return;
    }

    try {
      // Send scan to backend
      const result = await apiService.scan(
        code,
        deviceIdRef.current,
        'In warehouse',
        location?.lat,
        location?.lon
      );

      setScannedCodes([...scannedCodes, code]);
      setLastScan(result as unknown as ScanResult);
      setError(null);

      if (onScanSuccess) {
        onScanSuccess(result as unknown as ScanResult);
      }

      // Play success sound
      playSound('success');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Scan failed';
      setError(errorMsg);
      if (onScanError) onScanError(errorMsg);

      // Play error sound
      playSound('error');
    }
  };

  const handleManualScan = async (): Promise<void> => {
    if (!manualCode.trim()) {
      setError('Please enter a code');
      return;
    }

    await handleScanResult(manualCode);
    setManualCode('');
  };

  const playSound = (type: 'success' | 'error'): void => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (type === 'success') {
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } else {
      oscillator.frequency.value = 400;
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-white rounded-xl shadow-lg border border-brand-amber/20">
      <p className="text-xs uppercase tracking-[0.16em] text-brand-red font-semibold mb-1">
        Toplis Logistics
      </p>
      <h2 className="text-3xl text-brand-ink mb-4">Package Scanner</h2>

      {/* Mode selection */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setUseCamera(true)}
          className={`flex-1 py-2 px-3 rounded-lg font-semibold ${
            useCamera
              ? 'bg-brand-red text-white'
              : 'bg-brand-sand text-brand-charcoal'
          }`}
        >
          📷 Camera
        </button>
        <button
          onClick={() => setUseCamera(false)}
          className={`flex-1 py-2 px-3 rounded-lg font-semibold ${
            !useCamera
              ? 'bg-brand-red text-white'
              : 'bg-brand-sand text-brand-charcoal'
          }`}
        >
          ⌨️ Manual
        </button>
      </div>

      {/* Camera view */}
      {useCamera && (
        <div className="mb-4 overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            className="w-full"
            style={{ maxHeight: '400px', objectFit: 'cover' }}
          />
        </div>
      )}

      {/* Manual input */}
      {!useCamera && (
        <div className="mb-4 space-y-2">
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') handleManualScan();
            }}
            placeholder="Barcode / QR Code"
            className="w-full px-3 py-2 border border-brand-amber/40 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-red/40"
            autoFocus
          />
          <button
            onClick={handleManualScan}
            className="w-full bg-brand-red hover:bg-brand-redDark text-white font-bold py-2 px-4 rounded-lg"
          >
            Scan
          </button>
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {lastScan && (
        <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-700 rounded-lg">
          <p className="font-bold">✓ Scan Successful</p>
          <p className="text-sm">
            Waybill: {lastScan.shipment.waybill_number}
          </p>
          <p className="text-sm">
            Piece {lastScan.package.piece_number}/{lastScan.shipment.total_pieces}
          </p>
          {lastScan.allPiecesScanned && (
            <p className="text-sm font-bold text-green-800">
              ✓ All pieces scanned!
            </p>
          )}
        </div>
      )}

      {/* Scanned items list */}
      {scannedCodes.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold mb-2 text-brand-charcoal">
            Scanned Items ({scannedCodes.length})
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {scannedCodes.map((code, idx) => (
              <div key={idx} className="text-sm p-2 bg-brand-sand rounded-lg border border-brand-amber/25">
                {code}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setScannedCodes([]);
              setLastScan(null);
            }}
            className="mt-2 w-full bg-brand-charcoal hover:bg-brand-ink text-white font-bold py-2 px-4 rounded-lg"
          >
            Clear
          </button>
        </div>
      )}

      {/* Location info */}
      {location && (
        <div className="mt-4 text-sm text-brand-charcoal/80">
          📍 Location: {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
        </div>
      )}

      <div className="mt-4 text-sm text-brand-charcoal/80">
        Device ID: {deviceIdRef.current}
      </div>
    </div>
  );
};

export default Scanner;
