// Draws a result image onto a canvas with a baked-in diagonal "Concept Mock" watermark,
// plus an optional footer strip for Skin AI info (Shade Match, Skin Strengths, disclaimer)
// so that data travels with the exported PNG, not just the on-screen UI.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image for watermarking"));
    img.src = src;
  });
}

export interface FooterLine {
  text: string;
  muted?: boolean;
}

export interface AgeStripOptions {
  items: { age: number; dataUrl: string }[];
  caption: string;
  note: string;
}

/** Draws `img` scaled + center-cropped to cover the target box, like CSS `object-fit: cover`. */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const drawWidth = img.naturalWidth * scale;
  const drawHeight = img.naturalHeight * scale;
  const dx = x + (w - drawWidth) / 2;
  const dy = y + (h - drawHeight) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
  ctx.restore();
}

export async function drawWatermarkedImage(
  canvas: HTMLCanvasElement,
  imageSrc: string,
  options?: { footerLines?: FooterLine[]; ageStrip?: AgeStripOptions }
): Promise<void> {
  const img = await loadImage(imageSrc);
  const imgWidth = img.naturalWidth;
  const imgHeight = img.naturalHeight;
  const footerLines = options?.footerLines ?? [];
  const ageStrip = options?.ageStrip;

  const lineHeight = Math.max(18, Math.round(imgWidth / 32));
  const footerPaddingY = lineHeight * 0.7;
  const footerHeight =
    footerLines.length > 0 ? footerLines.length * lineHeight + footerPaddingY * 2 : 0;

  const ageStripImages = ageStrip ? await Promise.all(ageStrip.items.map((i) => loadImage(i.dataUrl))) : [];
  const stripGap = imgWidth * 0.02;
  const stripThumbWidth = ageStrip ? (imgWidth - stripGap * 4) / 3 : 0;
  const stripThumbHeight = stripThumbWidth * 1.15;
  const stripLabelHeight = Math.max(16, Math.round(imgWidth / 40));
  const stripCaptionLineHeight = Math.max(16, Math.round(imgWidth / 38));
  const stripNoteLineHeight = Math.max(13, Math.round(imgWidth / 52));
  const stripTopPad = stripGap;
  const stripBottomPad = stripGap * 1.4;
  const ageStripHeight = ageStrip
    ? stripTopPad + stripThumbHeight + stripGap * 0.6 + stripCaptionLineHeight + stripNoteLineHeight + stripBottomPad
    : 0;

  const contentHeight = imgHeight + ageStripHeight;

  canvas.width = imgWidth;
  canvas.height = contentHeight + footerHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, imgWidth, imgHeight);

  if (ageStrip) {
    let x = stripGap;
    const y = imgHeight + stripTopPad;
    ageStrip.items.forEach((item, i) => {
      drawCover(ctx, ageStripImages[i], x, y, stripThumbWidth, stripThumbHeight);

      const labelText = `Age ${item.age}`;
      ctx.font = `700 ${Math.round(stripLabelHeight * 0.72)}px Arial, sans-serif`;
      const labelPadX = stripLabelHeight * 0.4;
      const labelWidth = ctx.measureText(labelText).width + labelPadX * 2;
      ctx.globalAlpha = 0.78;
      ctx.fillStyle = "#111111";
      ctx.fillRect(x, y + stripThumbHeight - stripLabelHeight, labelWidth, stripLabelHeight);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, x + labelPadX, y + stripThumbHeight - stripLabelHeight / 2);

      x += stripThumbWidth + stripGap;
    });

    const textX = stripGap;
    let textY = imgHeight + stripTopPad + stripThumbHeight + stripGap * 0.6;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#111111";
    ctx.font = `600 ${Math.round(stripCaptionLineHeight * 0.62)}px Arial, sans-serif`;
    ctx.fillText(ageStrip.caption, textX, textY);
    textY += stripCaptionLineHeight;
    ctx.fillStyle = "#6b6b6b";
    ctx.font = `400 ${Math.round(stripNoteLineHeight * 0.68)}px Arial, sans-serif`;
    ctx.fillText(ageStrip.note, textX, textY);
  }

  const label = "CONCEPT MOCK";
  const fontSize = Math.max(24, Math.round(imgWidth / 11));
  ctx.save();
  ctx.translate(imgWidth / 2, contentHeight / 2);
  ctx.rotate((-28 * Math.PI) / 180);
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const spacedLabel = label.split("").join(" ");
  const stripeHeight = fontSize * 1.9;
  const diag = Math.sqrt(imgWidth ** 2 + contentHeight ** 2);
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

  const badgeText = "CONCEPT MOCK: NOT FOR POSTING";
  const badgeFontSize = Math.max(14, Math.round(imgWidth / 48));
  ctx.font = `700 ${badgeFontSize}px Arial, sans-serif`;
  const paddingX = badgeFontSize * 0.8;
  const paddingY = badgeFontSize * 0.55;
  const textWidth = ctx.measureText(badgeText).width;
  const badgeWidth = textWidth + paddingX * 2;
  const badgeHeight = badgeFontSize + paddingY * 2;
  const margin = Math.max(12, imgWidth * 0.02);

  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#e07f3a";
  ctx.fillRect(margin, imgHeight - margin - badgeHeight, badgeWidth, badgeHeight);

  ctx.globalAlpha = 1;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(badgeText, margin + paddingX, imgHeight - margin - badgeHeight / 2 + badgeFontSize * 0.05);

  if (footerLines.length > 0) {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const x = Math.max(12, imgWidth * 0.02);
    let y = contentHeight + footerPaddingY;
    for (const line of footerLines) {
      ctx.fillStyle = line.muted ? "#6b6b6b" : "#111111";
      ctx.font = `${line.muted ? 400 : 600} ${lineHeight * 0.58}px Arial, sans-serif`;
      ctx.fillText(line.text, x, y);
      y += lineHeight;
    }
  }
}

export function canvasToPngDownload(canvas: HTMLCanvasElement, fileName: string) {
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
}
