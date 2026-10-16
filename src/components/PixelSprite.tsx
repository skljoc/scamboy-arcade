import { memo } from "react";

const toHex = (c: number) => "#" + c.toString(16).padStart(6, "0");

interface Props {
  rows: string[];
  palette: Record<string, number>;
  /** size of one pixel in user units */
  px?: number;
  x?: number;
  y?: number;
  flipX?: boolean;
}

/**
 * Renders ASCII pixel-art rows as crisp SVG rects (horizontal runs merged).
 * Must be placed inside an <svg>.
 */
function PixelSpriteImpl({ rows, palette, px = 1, x = 0, y = 0, flipX = false }: Props) {
  const rects: React.ReactElement[] = [];
  const w = rows[0]?.length ?? 0;
  rows.forEach((row, ry) => {
    const r = flipX ? row.split("").reverse().join("") : row;
    let start = 0;
    while (start < w) {
      const ch = r[start];
      let end = start + 1;
      while (end < w && r[end] === ch) end++;
      const col = palette[ch];
      if (col !== undefined) {
        rects.push(
          <rect
            key={`${ry}-${start}`}
            x={x + start * px}
            y={y + ry * px}
            width={(end - start) * px}
            height={px}
            fill={toHex(col)}
          />,
        );
      }
      start = end;
    }
  });
  return <g shapeRendering="crispEdges">{rects}</g>;
}

export const PixelSprite = memo(PixelSpriteImpl);
