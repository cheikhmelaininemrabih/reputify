"use client";
// Real KYC: a genuine webcam-captured ID photo + live selfie, compared with a
// real client-side face-recognition model (face-api.js — actual face detection
// + a 128-d descriptor + Euclidean distance, not a mocked score). The model
// files ship in /public/models and load once per session. Everything runs in
// the browser; only the two photos + the computed distance are sent to the
// server, which encrypts the photos at rest and re-derives verified/failed
// from the distance itself rather than trusting a boolean from the client.
import { useEffect, useRef, useState } from "react";
import { api } from "./api";

type Stage = "id" | "selfie" | "comparing" | "done";
const MATCH_THRESHOLD = 0.6;

export function KycCapture({ borrowerId, onDone }: { borrowerId: string; onDone: (status: "verified" | "failed") => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceapiRef = useRef<any>(null);

  const [stage, setStage] = useState<Stage>("id");
  const [modelsReady, setModelsReady] = useState(false);
  const [modelErr, setModelErr] = useState("");
  const [idPhoto, setIdPhoto] = useState<string | null>(null);
  const [streamOn, setStreamOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState<{ matched: boolean; distance: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const faceapi = await import("face-api.js");
      if (cancelled) return;
      faceapiRef.current = faceapi;
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
        faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
        faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
      ]);
      if (!cancelled) setModelsReady(true);
    })().catch((e) => setModelErr("Could not load the face-recognition model: " + (e as Error).message));
    return () => { cancelled = true; stopCamera(); };
  }, []);

  async function openCamera() {
    setErr("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setStreamOn(true);
    } catch {
      setErr(stage === "id" ? "Camera unavailable — upload an ID photo instead below." : "Camera access is required for a live selfie.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamOn(false);
  }

  function captureFrame(): string | null {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.9);
  }

  function onCaptureId() {
    const shot = captureFrame();
    if (!shot) return;
    setIdPhoto(shot);
    stopCamera();
    setStage("selfie");
  }

  function onFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setIdPhoto(reader.result as string); stopCamera(); setStage("selfie"); };
    reader.readAsDataURL(file);
  }

  function onCaptureSelfie() {
    const shot = captureFrame();
    if (!shot) return;
    stopCamera();
    void compare(shot);
  }

  function loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("could not decode image"));
      img.src = dataUrl;
    });
  }

  async function compare(selfieShot: string) {
    setBusy(true); setErr(""); setStage("comparing");
    try {
      const faceapi = faceapiRef.current;
      const [idImg, selfieImg] = await Promise.all([loadImage(idPhoto!), loadImage(selfieShot)]);
      const opts = new faceapi.TinyFaceDetectorOptions();
      const [idDet, selfieDet] = await Promise.all([
        faceapi.detectSingleFace(idImg, opts).withFaceLandmarks().withFaceDescriptor(),
        faceapi.detectSingleFace(selfieImg, opts).withFaceLandmarks().withFaceDescriptor(),
      ]);
      if (!idDet || !selfieDet) {
        setErr("Couldn't find a clear face in one of the photos — better lighting helps. Try again.");
        setIdPhoto(null); setStage("id"); setBusy(false);
        return;
      }
      const distance = faceapi.euclideanDistance(idDet.descriptor, selfieDet.descriptor) as number;
      const r = await api(`/api/rep/borrowers/${borrowerId}/kyc`, {
        idImageBase64: idPhoto!.split(",")[1], selfieImageBase64: selfieShot.split(",")[1], distance,
      });
      setResult({ matched: r.kyc.matched, distance: r.kyc.distance });
      setStage("done");
      onDone(r.kyc.status);
    } catch (e) {
      setErr((e as Error).message);
      setStage("selfie");
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    setIdPhoto(null); setResult(null); setErr(""); setStage("id");
  }

  return (
    <section className="card pad">
      <h3 style={{ marginTop: 0 }}>Verify your identity</h3>
      <p style={{ color: "var(--muted)", marginTop: 4, fontSize: 14 }}>
        A real photo of your ID, then a live selfie — compared right here in your browser with a
        face-recognition model. Nothing is sent anywhere until the comparison is done.
      </p>
      {modelErr && <p style={{ color: "var(--bad)" }}>{modelErr}</p>}
      {!modelsReady && !modelErr && <p style={{ color: "var(--muted)" }}>Loading face-recognition model…</p>}

      {modelsReady && stage !== "done" && (
        <div style={{ marginTop: 14 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>
            {stage === "id" ? "Step 1 — ID document photo" : stage === "selfie" ? "Step 2 — live selfie" : "Comparing…"}
          </p>

          {stage === "id" && !idPhoto && (
            <>
              {!streamOn ? (
                <button className="btn teal" onClick={openCamera}>Open camera</button>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: 380, borderRadius: 12, background: "#000" }} />
                  <button className="btn gold" onClick={onCaptureId}>Capture ID photo</button>
                </div>
              )}
              <p style={{ fontSize: 13, color: "var(--muted)", margin: "10px 0 4px" }}>Or upload a photo of your ID:</p>
              <input type="file" accept="image/*" onChange={onFileUpload} />
            </>
          )}

          {stage === "selfie" && (
            <div style={{ display: "grid", gap: 10 }}>
              {idPhoto && <img src={idPhoto} alt="ID captured" style={{ width: 120, borderRadius: 8, border: "1px solid var(--line-2)" }} />}
              {!streamOn ? (
                <button className="btn teal" onClick={openCamera}>Open camera for selfie</button>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  <video ref={videoRef} playsInline muted style={{ width: "100%", maxWidth: 380, borderRadius: 12, background: "#000" }} />
                  <button className="btn gold" disabled={busy} onClick={onCaptureSelfie}>Capture selfie &amp; compare</button>
                </div>
              )}
            </div>
          )}

          {stage === "comparing" && <p style={{ color: "var(--muted)" }}>Detecting faces and comparing…</p>}

          <canvas ref={canvasRef} style={{ display: "none" }} />
        </div>
      )}

      {stage === "done" && result && (
        <div style={{ marginTop: 14 }}>
          {result.matched ? (
            <p style={{ color: "var(--good)", fontWeight: 600 }}>✓ Verified — face match (distance {result.distance.toFixed(3)}, threshold {MATCH_THRESHOLD})</p>
          ) : (
            <>
              <p style={{ color: "var(--bad)", fontWeight: 600 }}>✗ Could not confirm a match (distance {result.distance.toFixed(3)}, threshold {MATCH_THRESHOLD})</p>
              <button className="btn ghost" onClick={retake}>Try again</button>
            </>
          )}
        </div>
      )}

      {err && <p style={{ color: "var(--bad)", marginTop: 10 }}>{err}</p>}
    </section>
  );
}
