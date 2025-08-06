import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url)
    const code = url.searchParams.get('code')
    const size = parseInt(url.searchParams.get('size') || '200')
    const format = url.searchParams.get('format') || 'svg'

    if (!code) {
      return new Response('Missing code parameter', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Validate size limits
    const validSize = Math.min(Math.max(size, 50), 1000)

    // Generate QR code SVG
    const qrSvg = generateQRCodeSVG(code, validSize)
    
    const contentType = format === 'png' ? 'image/png' : 'image/svg+xml'
    
    return new Response(qrSvg, {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600' // 1 hour cache
      }
    })

  } catch (error) {
    console.error('QR generation error:', error)
    return new Response('QR code generation failed', { 
      status: 500, 
      headers: corsHeaders 
    })
  }
})

function generateQRCodeSVG(text: string, size: number = 200): string {
  // Simple QR code implementation using a basic algorithm
  // In production, you'd use a proper QR library
  
  const modules = generateQRMatrix(text)
  const moduleCount = modules.length
  const moduleSize = size / moduleCount
  
  let svgPath = ''
  
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (modules[row][col]) {
        const x = col * moduleSize
        const y = row * moduleSize
        svgPath += `M${x},${y}h${moduleSize}v${moduleSize}h-${moduleSize}z`
      }
    }
  }
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="white"/>
  <path d="${svgPath}" fill="black"/>
</svg>`
}

function generateQRMatrix(text: string): boolean[][] {
  // Simplified QR matrix generation
  // This is a basic implementation - use a proper QR library in production
  
  const size = 21 // QR version 1 is 21x21
  const matrix: boolean[][] = Array(size).fill(null).map(() => Array(size).fill(false))
  
  // Add finder patterns (corners)
  addFinderPattern(matrix, 0, 0)
  addFinderPattern(matrix, size - 7, 0)
  addFinderPattern(matrix, 0, size - 7)
  
  // Add timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0
    matrix[i][6] = i % 2 === 0
  }
  
  // Add data (simplified - just create a pattern based on text)
  const hash = simpleHash(text)
  for (let i = 9; i < size - 9; i++) {
    for (let j = 9; j < size - 9; j++) {
      if (!isReserved(i, j, size)) {
        matrix[i][j] = ((hash + i + j) % 3) === 0
      }
    }
  }
  
  return matrix
}

function addFinderPattern(matrix: boolean[][], startRow: number, startCol: number) {
  const pattern = [
    [true, true, true, true, true, true, true],
    [true, false, false, false, false, false, true],
    [true, false, true, true, true, false, true],
    [true, false, true, true, true, false, true],
    [true, false, true, true, true, false, true],
    [true, false, false, false, false, false, true],
    [true, true, true, true, true, true, true]
  ]
  
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      if (startRow + i < matrix.length && startCol + j < matrix[0].length) {
        matrix[startRow + i][startCol + j] = pattern[i][j]
      }
    }
  }
}

function isReserved(row: number, col: number, size: number): boolean {
  // Check if position is reserved for finder patterns or timing
  if ((row < 9 && col < 9) || 
      (row < 9 && col >= size - 8) || 
      (row >= size - 8 && col < 9) ||
      row === 6 || col === 6) {
    return true
  }
  return false
}

function simpleHash(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}