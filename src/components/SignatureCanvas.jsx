import { useEffect, useRef } from "react";

export function SignatureCanvas({
  imageURL,
  overlay = false,
  overlayData,
  className = "",
  fallback = null,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!imageURL) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.src = imageURL;
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      ctx.drawImage(img, 0, 0);

      if (!overlay || !overlayData) return;

      const W = canvas.width;
      const H = canvas.height;

      overlayData.hotspots?.forEach(({ x, y, intensity, radius }) => {
        const cx = x * W;
        const cy = y * H;
        const r = radius * Math.min(W, H);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(160, 40, 14, ${intensity * 0.55})`);
        g.addColorStop(0.5, `rgba(180, 80, 30, ${intensity * 0.25})`);
        g.addColorStop(1, "rgba(180, 80, 30, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      });

      if (overlayData.baselineY != null) {
        ctx.save();
        ctx.setLineDash([Math.round(W * 0.018), Math.round(W * 0.012)]);
        ctx.strokeStyle = "rgba(80,80,80,0.65)";
        ctx.lineWidth = Math.max(1, H * 0.012);
        ctx.beginPath();
        ctx.moveTo(W * 0.03, overlayData.baselineY * H);
        ctx.lineTo(W * 0.97, overlayData.baselineY * H);
        ctx.stroke();
        ctx.restore();
      }

      overlayData.penLifts?.forEach(({ x, y }) => {
        const cx = x * W;
        const cy = y * H;
        const r = Math.min(W, H) * 0.035;
        ctx.save();
        ctx.setLineDash([Math.round(r * 0.5), Math.round(r * 0.4)]);
        ctx.strokeStyle = "rgba(90, 60, 30, 0.75)";
        ctx.lineWidth = Math.max(1.5, H * 0.01);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      });

      overlayData.markers?.forEach(({ x, y, number }) => {
        const cx = x * W;
        const cy = y * H;
        const r = Math.min(W, H) * 0.048;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = "#6b2e20";
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(r * 1.1)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(number), cx, cy);
        ctx.restore();
      });
    };
  }, [imageURL, overlay, overlayData]);

  if (!imageURL) return fallback;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "auto", display: "block" }}
    />
  );
}
