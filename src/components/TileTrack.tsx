import { useMemo, useState } from 'react';
import type { TilePosition } from '../types';

interface TileTrackProps {
  tiles: TilePosition[];
  proteinLength: number;
  onTileClick?: (tile: TilePosition) => void;
  height?: number;
}

export default function TileTrack({
  tiles,
  proteinLength,
  onTileClick,
  height = 60,
}: TileTrackProps) {
  const [hoveredTile, setHoveredTile] = useState<TilePosition | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Calculate tile rows (stack overlapping tiles)
  const tileRows = useMemo(() => {
    const rows: TilePosition[][] = [];
    const sortedTiles = [...tiles].sort((a, b) => a.start - b.start);

    for (const tile of sortedTiles) {
      let placed = false;
      for (const row of rows) {
        const lastTile = row[row.length - 1];
        if (lastTile.end < tile.start) {
          row.push(tile);
          placed = true;
          break;
        }
      }
      if (!placed) {
        rows.push([tile]);
      }
    }

    return rows;
  }, [tiles]);

  const rowHeight = Math.min(16, Math.floor((height - 20) / Math.max(tileRows.length, 1)));
  const trackHeight = tileRows.length * rowHeight + 20;

  const handleMouseMove = (e: React.MouseEvent, tile: TilePosition) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left + 10,
      y: e.clientY - rect.top - 10,
    });
    setHoveredTile(tile);
  };

  return (
    <div className="relative" style={{ height: trackHeight }}>
      {/* Axis */}
      <svg className="w-full" style={{ height: trackHeight }}>
        {/* Background */}
        <rect
          x="0"
          y="0"
          width="100%"
          height={trackHeight - 20}
          className="fill-gray-100 dark:fill-gray-800"
          rx="4"
        />

        {/* Tile rectangles */}
        {tileRows.map((row, rowIndex) =>
          row.map(tile => {
            const x = (tile.start / proteinLength) * 100;
            const width = ((tile.end - tile.start) / proteinLength) * 100;
            const y = rowIndex * rowHeight + 2;

            return (
              <rect
                key={tile.id}
                x={`${x}%`}
                y={y}
                width={`${Math.max(width, 0.3)}%`}
                height={rowHeight - 2}
                rx="2"
                className={`cursor-pointer transition-opacity ${
                  tile.isShared
                    ? 'fill-amber-500 hover:fill-amber-400'
                    : 'fill-emerald-500 hover:fill-emerald-400'
                } ${hoveredTile && hoveredTile.id !== tile.id ? 'opacity-50' : 'opacity-100'}`}
                onClick={() => onTileClick?.(tile)}
                onMouseMove={e => handleMouseMove(e, tile)}
                onMouseLeave={() => setHoveredTile(null)}
              />
            );
          })
        )}

        {/* Axis line */}
        <line
          x1="0"
          y1={trackHeight - 15}
          x2="100%"
          y2={trackHeight - 15}
          className="stroke-gray-300 dark:stroke-gray-600"
          strokeWidth="1"
        />

        {/* Axis ticks */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <g key={pct}>
            <line
              x1={`${pct * 100}%`}
              y1={trackHeight - 18}
              x2={`${pct * 100}%`}
              y2={trackHeight - 12}
              className="stroke-gray-400 dark:stroke-gray-500"
              strokeWidth="1"
            />
            <text
              x={`${pct * 100}%`}
              y={trackHeight - 2}
              textAnchor="middle"
              className="fill-gray-500 dark:fill-gray-400 text-[10px]"
            >
              {Math.round(pct * proteinLength)}
            </text>
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {hoveredTile && (
        <div
          className="absolute pointer-events-none bg-gray-900 dark:bg-gray-700 text-white px-2 py-1 rounded text-xs shadow-lg z-10 max-w-xs"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translateY(-100%)',
          }}
        >
          <div className="font-medium">{hoveredTile.id}</div>
          <div className="text-gray-300">
            Position: {hoveredTile.start} - {hoveredTile.end}
          </div>
          <div className={hoveredTile.isShared ? 'text-amber-300' : 'text-emerald-300'}>
            {hoveredTile.isShared ? 'Shared tile' : 'Unique tile'}
          </div>
        </div>
      )}
    </div>
  );
}
