import { ImageResponse } from 'next/og'
 
export const runtime = 'edge'
 
export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'
 
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #FF3D9A 0%, #19B8D8 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '40px',
        }}
      >
        <svg
          width="120"
          height="120"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="16"
            cy="16"
            r="14"
            stroke="white"
            strokeWidth="2"
            fill="none"
          />
          <ellipse
            cx="16"
            cy="16"
            rx="5"
            ry="14"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
          />
          <ellipse
            cx="16"
            cy="16"
            rx="9"
            ry="14"
            stroke="white"
            strokeWidth="1"
            fill="none"
            opacity="0.7"
          />
          <ellipse
            cx="16"
            cy="16"
            rx="14"
            ry="5"
            stroke="white"
            strokeWidth="1.5"
            fill="none"
          />
          <ellipse
            cx="16"
            cy="16"
            rx="14"
            ry="9"
            stroke="white"
            strokeWidth="1"
            fill="none"
            opacity="0.7"
          />
          <line
            x1="2"
            y1="16"
            x2="30"
            y2="16"
            stroke="white"
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
