// Draws a result image onto a canvas with a baked-in diagonal "Concept Mock" watermark.
// Used by both Creator and Brand flows so every exported PNG carries the safeguard.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for watermarking"));
    img.src = src;
  });
}

export async function drawWatermarkedImage(
  canvas: HTMLCanvasElement,
  imageSrc: string
): Promise<void> {
  const img = await loadImage(imageSrc);
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const label = "CONCEPT MOCK";
  const fontSize = Math.max(24, Math.round(canvas.width / 11));
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-28 * Math.PI) / 180);
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const spacedLabel = label.split("").join(" ");
  const stripeHeight = fontSize * 1.9;
  const diag = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
  for (let y = -diag; y < diag; y += stripeHeight) {
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(spacedLabel, 0, y);
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = Math.max(1, fontSize / 24);
    ctx.strokeStyle = "#111111";
    ctx.strokeText(spacedLabel, 0, y);
  }
  ctx.restore();

  const badgeText = "CONCEPT MOCK — NOT FOR POSTING";
  const badgeFontSize = Math.max(14, Math.round(canvas.width / 48));
  ctx.font = `700 ${badgeFontSize}px Arial, sans-serif`;
  const paddingX = badgeFontSize * 0.8;
  const paddingY = badgeFontSize * 0.55;
  const textWidth = ctx.measureText(badgeText).width;
  const badgeWidth = textWidth + paddingX * 2;
  const badgeHeight = badgeFontSize + paddingY * 2;
  const margin = Math.max(12, canvas.width * 0.02);

  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#c1121f";
  ctx.fillRect(margin, canvas.height - margin - badgeHeight, badgeWidth, badgeHeight);

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    badgeText,
    margin + paddingX,
    canvas.height - margin - badgeHeight / 2 + badgeFontSize * 0.05
  );
}

export function canvasToPngDownload(canvas: HTMLCanvasElement, fileName: string) {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
}
