import { useEffect, useRef, useState } from 'react';
import type { Card, Content } from '../lib/api';
import { Notice } from '../components/ui';
const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not load one of the creative images'));
    i.src = url;
  });
function lines(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const result: string[] = [];
  let row = '';
  for (const word of text.split(/\s+/)) {
    const next = row ? row + ' ' + word : word;
    if (ctx.measureText(next).width > width && row) {
      result.push(row);
      row = word;
    } else row = next;
  }
  if (row) result.push(row);
  return result;
}
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  line: number,
  max: number,
) {
  const rows = lines(ctx, text, width);
  if (rows.length > max)
    throw new Error(
      'This text is too long for the layout. Shorten it or reduce the headline size.',
    );
  for (const row of rows) {
    if (ctx.measureText(row).width > width)
      throw new Error('A word is too wide for this layout. Shorten it.');
    ctx.fillText(row, x, y);
    y += line;
  }
  return y;
}
export async function paint(
  canvas: HTMLCanvasElement,
  card: Card,
  format: Content['format'],
  base: string,
) {
  const width = 1080,
    height = format === 'story' ? 1920 : format === 'portrait' ? 1350 : 1080;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = card.backgroundColor;
  ctx.fillRect(0, 0, width, height);
  if (card.backgroundAssetId) {
    const img = await loadImage('/api' + base + '/assets/' + card.backgroundAssetId);
    const scale = Math.max(width / img.width, height / img.height);
    ctx.drawImage(
      img,
      (width - img.width * scale) / 2,
      (height - img.height * scale) / 2,
      img.width * scale,
      img.height * scale,
    );
    ctx.fillStyle = 'rgba(0,0,0,.38)';
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.fillStyle = '#ffffff0f';
    ctx.beginPath();
    ctx.arc(width - 80, 100, 380, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width, height - 50, 500, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(width - 30, height - 100, 540, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (card.logoAssetId) {
    const logo = await loadImage('/api' + base + '/assets/' + card.logoAssetId);
    const scale = Math.min(240 / logo.width, 120 / logo.height);
    ctx.drawImage(logo, 80, 80, logo.width * scale, logo.height * scale);
  } else {
    ctx.fillStyle = card.textColor;
    ctx.font = 'bold 22px Arial';
    ctx.fillText('A LITTLE SOMETHING FOR YOU', 80, 130);
  }
  const top = (height * card.textY) / 100;
  ctx.font = `bold ${card.fontSize}px Arial`;
  const titleLines = lines(ctx, card.title, 920).length;
  ctx.font = '30px Arial';
  const subtitleLines = lines(ctx, card.subtitle, 870).length;
  const bottom =
    top + titleLines * card.fontSize * 1.15 + 35 + subtitleLines * 44 + (card.price ? 100 : 0);
  if (bottom > height - 210)
    throw new Error(
      'The text overlaps the button area. Move it up, reduce the headline size, or shorten the copy.',
    );
  ctx.fillStyle = card.textColor;
  ctx.font = `bold ${card.fontSize}px Arial`;
  let y = (height * card.textY) / 100;
  y = wrap(ctx, card.title, 80, y, 920, card.fontSize * 1.15, 4);
  ctx.font = '30px Arial';
  y = wrap(ctx, card.subtitle, 80, y + 35, 870, 44, 4);
  if (card.price) {
    ctx.font = 'bold 65px Arial';
    ctx.fillText(card.price, 80, Math.min(y + 90, height - 240));
  }
  ctx.fillStyle = card.textColor;
  ctx.beginPath();
  ctx.roundRect(80, height - 170, 570, 85, 18);
  ctx.fill();
  ctx.fillStyle = card.backgroundColor;
  ctx.font = 'bold 27px Arial';
  ctx.fillText(card.cta + '  →', 110, height - 116, 500);
}
export function CreativeCanvas({
  card,
  format,
  base,
  onCanvas,
}: {
  card: Card;
  format: Content['format'];
  base: string;
  onCanvas?: (canvas: HTMLCanvasElement | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const buffer = document.createElement('canvas');
    onCanvas?.(null);
    paint(buffer, card, format, base)
      .then(() => {
        if (active && ref.current) {
          ref.current.width = buffer.width;
          ref.current.height = buffer.height;
          ref.current.getContext('2d')!.drawImage(buffer, 0, 0);
          onCanvas?.(ref.current);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [card, format, base]);
  return (
    <>
      {error && <Notice error>{error}</Notice>}
      <canvas ref={ref} className="creative-canvas" aria-label="Creative preview" />
    </>
  );
}
