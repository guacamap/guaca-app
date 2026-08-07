'use client';

import { useEffect, useRef, useState } from 'react';
import { canSubmitWithAccuracy } from '../../../capture';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TOLERANCE_M = Number(process.env.NEXT_PUBLIC_GEO_TOLERANCE_M ?? 50);

interface CaptureState {
  cameraOn: boolean;
  stream: MediaStream | null;
  imageBase64: string | null;
  accuracyM: number | null;
  uploading: boolean;
  done: boolean;
  error: string | null;
}

export default function CaptureScreen({ missionId }: { missionId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<CaptureState>({
    cameraOn: false,
    stream: null,
    imageBase64: null,
    accuracyM: null,
    uploading: false,
    done: false,
    error: null,
  });

  useEffect(() => {
    return () => {
      state.stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      setState((s) => ({ ...s, cameraOn: true, stream }));
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setState((s) => ({ ...s, error: 'No pudimos abrir la cámara.' }));
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    // Geolocation captured in the SAME action as the shutter.
    const pos: GeolocationPosition = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      });
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]!;
    setState((s) => ({
      ...s,
      imageBase64,
      accuracyM: pos.coords.accuracy,
    }));
    state.stream?.getTracks().forEach((t) => t.stop());
  }

  async function upload() {
    if (!state.imageBase64) return;
    const gate = canSubmitWithAccuracy(state.accuracyM, TOLERANCE_M);
    if (!gate.ok) {
      setState((s) => ({ ...s, error: gate.reason! }));
      return;
    }
    setState((s) => ({ ...s, uploading: true, error: null }));
    try {
      await fetch(`${API}/api/photos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          placeId: missionId,
          spotterId: missionId,
          imageBase64: state.imageBase64,
          captureAccuracyM: state.accuracyM,
          capturedAt: new Date().toISOString(),
        }),
      });
      setState((s) => ({ ...s, uploading: false, done: true }));
    } catch {
      setState((s) => ({ ...s, uploading: false, error: 'Subida fallida.' }));
    }
  }

  if (state.done) return <main className="p"><h2>¡Gracias! Foto subida.</h2></main>;

  return (
    <main className="p">
      <h2>Captura de la misión</h2>
      {!state.cameraOn && (
        <button onClick={startCamera}>Abrir cámara</button>
      )}
      {state.cameraOn && (
        <>
          <video ref={videoRef} autoPlay playsInline className="video" />
          <p>
            GPS: {state.accuracyM !== null ? `${Math.round(state.accuracyM)}m` : 'midiendo…'}
          </p>
          <button onClick={capture} disabled={!state.imageBase64 && false}>
            Tomar foto
          </button>
          {state.imageBase64 && (
            <>
              <button onClick={upload} disabled={state.uploading}>
                {state.uploading ? 'Subiendo…' : 'Subir foto'}
              </button>
            </>
          )}
        </>
      )}
      {state.error && <p className="err">{state.error}</p>}
      <style jsx>{`
        .p { font-family: system-ui, sans-serif; padding: 16px; max-width: 640px; margin: 0 auto; }
        .video { width: 100%; border-radius: 12px; }
        button { margin: 8px 8px 0 0; padding: 10px 16px; border: 0; border-radius: 8px; background: #1d5cb0; color: #fff; cursor: pointer; }
        .err { color: #b00020; }
      `}</style>
    </main>
  );
}
