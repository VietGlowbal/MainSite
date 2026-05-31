import { ImageResponse } from 'next/og'
 
// Route segment config
export const runtime = 'edge'
 
// Image metadata
export const size = {
  width: 32,
  height: 32,
}
export const contentType = 'image/png'
 
// Image generation
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 24,
          background: 'transparent',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Globe circle */}
          <circle
            cx="16"
            cy="16"
            r="14"
            stroke="#3b82f6"
            strokeWidth="2"
            fill="none"
          />
          {/* Vertical lines (longitude) */}
          <ellipse
            cx="16"
            cy="16"
            rx="5"
            ry="14"
            stroke="#3b82f6"
            strokeWidth="1.5"
            fill="none"
          />
          <ellipse
            cx="16"
            cy="16"
            rx="9"
            ry="14"
            stroke="#3b82f6"
            strokeWidth="1"
            fill="none"
            opacity="0.6"
          />
          {/* Horizontal lines (latitude) */}
          <ellipse
            cx="16"
            cy="16"
            rx="14"
            ry="5"
            stroke="#3b82f6"
            strokeWidth="1.5"
            fill="none"
          />
          <ellipse
            cx="16"
            cy="16"
            rx="14"
            ry="9"
            stroke="#3b82f6"
            strokeWidth="1"
            fill="none"
            opacity="0.6"
          />
          {/* Center line */}
          <line
            x1="2"
            y1="16"
            x2="30"
            y2="16"
            stroke="#3b82f6"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
