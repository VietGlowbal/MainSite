'use client'

import { useEffect } from 'react'

export function AnimatedFavicon() {
  useEffect(() => {
    let frame = 0
    const frames = 8
    
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 32
    const ctx = canvas.getContext('2d')
    
    if (!ctx) return

    const animate = () => {
      // Clear canvas
      ctx.clearRect(0, 0, 32, 32)
      
      // Calculate rotation
      const rotation = (frame / frames) * Math.PI * 2
      
      // Save context
      ctx.save()
      ctx.translate(16, 16)
      ctx.rotate(rotation)
      ctx.translate(-16, -16)
      
      // Draw globe
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      
      // Outer circle
      ctx.beginPath()
      ctx.arc(16, 16, 14, 0, Math.PI * 2)
      ctx.stroke()
      
      // Vertical ellipse (longitude)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(16, 16, 5, 14, 0, 0, Math.PI * 2)
      ctx.stroke()
      
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(16, 16, 9, 14, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      
      // Restore context
      ctx.restore()
      
      // Horizontal ellipses (latitude) - don't rotate these
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(16, 16, 14, 5, 0, 0, Math.PI * 2)
      ctx.stroke()
      
      ctx.globalAlpha = 0.6
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(16, 16, 14, 9, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      
      // Center line
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(2, 16)
      ctx.lineTo(30, 16)
      ctx.stroke()
      
      // Update favicon
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link')
      link.type = 'image/x-icon'
      link.rel = 'shortcut icon'
      link.href = canvas.toDataURL('image/x-icon')
      
      if (!document.querySelector("link[rel*='icon']")) {
        document.getElementsByTagName('head')[0].appendChild(link)
      }
      
      // Next frame
      frame = (frame + 1) % frames
    }
    
    // Animate at 8 FPS for smooth rotation
    const interval = setInterval(animate, 125)
    
    return () => clearInterval(interval)
  }, [])
  
  return null
}
