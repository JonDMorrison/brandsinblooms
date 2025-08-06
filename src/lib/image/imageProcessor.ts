// Image processing utilities for SMS/MMS optimization
interface ProcessedImage {
  original: string
  thumbnail: string
  optimized: string
  dimensions: { width: number; height: number }
  fileSize: number
  format: string
  altText?: string
}

interface ProcessingOptions {
  maxDimension?: number
  thumbnailSize?: number
  quality?: number
  format?: 'webp' | 'jpeg' | 'png'
  generateAltText?: boolean
}

const DEFAULT_OPTIONS: ProcessingOptions = {
  maxDimension: 800,
  thumbnailSize: 150,
  quality: 0.8,
  format: 'webp',
  generateAltText: true
}

export class ImageProcessor {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.canvas = document.createElement('canvas')
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context not available')
    this.ctx = ctx
  }

  async processImage(file: File, options: ProcessingOptions = {}): Promise<ProcessedImage> {
    const opts = { ...DEFAULT_OPTIONS, ...options }
    
    console.log(`Processing image: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`)

    // Load image
    const img = await this.loadImage(file)
    const originalDimensions = { width: img.naturalWidth, height: img.naturalHeight }

    // Generate optimized version (800px max)
    const optimizedBlob = await this.resizeImage(img, opts.maxDimension!, opts.quality!, opts.format!)
    const optimizedUrl = URL.createObjectURL(optimizedBlob)

    // Generate thumbnail (150px)
    const thumbnailBlob = await this.resizeImage(img, opts.thumbnailSize!, opts.quality!, opts.format!)
    const thumbnailUrl = URL.createObjectURL(thumbnailBlob)

    // Generate alt text if requested
    let altText: string | undefined
    if (opts.generateAltText) {
      altText = await this.generateAltText(optimizedBlob)
    }

    return {
      original: URL.createObjectURL(file),
      thumbnail: thumbnailUrl,
      optimized: optimizedUrl,
      dimensions: originalDimensions,
      fileSize: optimizedBlob.size,
      format: opts.format!,
      altText
    }
  }

  private async loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  private async resizeImage(
    img: HTMLImageElement, 
    maxDimension: number, 
    quality: number,
    format: string
  ): Promise<Blob> {
    const { width: originalWidth, height: originalHeight } = img
    
    // Calculate new dimensions maintaining aspect ratio
    let newWidth = originalWidth
    let newHeight = originalHeight
    
    if (originalWidth > maxDimension || originalHeight > maxDimension) {
      const ratio = Math.min(maxDimension / originalWidth, maxDimension / originalHeight)
      newWidth = Math.round(originalWidth * ratio)
      newHeight = Math.round(originalHeight * ratio)
    }

    // Set canvas size
    this.canvas.width = newWidth
    this.canvas.height = newHeight

    // Clear canvas and draw resized image
    this.ctx.clearRect(0, 0, newWidth, newHeight)
    this.ctx.drawImage(img, 0, 0, newWidth, newHeight)

    // Convert to blob
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to create blob'))
        },
        `image/${format}`,
        quality
      )
    })
  }

  private async generateAltText(imageBlob: Blob): Promise<string> {
    // Simple alt text generation - in production you'd use AI vision API
    const fileName = imageBlob.type.split('/')[1] || 'image'
    const size = imageBlob.size < 1024 * 1024 ? 'small' : 'large'
    
    return `${size} ${fileName} image for SMS/MMS`
  }

  async batchProcess(files: File[], options: ProcessingOptions = {}): Promise<ProcessedImage[]> {
    const results = await Promise.all(
      files.map(file => this.processImage(file, options))
    )
    
    console.log(`Batch processed ${files.length} images`)
    return results
  }

  // Clean up object URLs to prevent memory leaks
  static cleanup(processedImages: ProcessedImage[]) {
    processedImages.forEach(img => {
      URL.revokeObjectURL(img.original)
      URL.revokeObjectURL(img.thumbnail)
      URL.revokeObjectURL(img.optimized)
    })
  }
}

// Utility functions
export function getOptimalFormat(file: File): 'webp' | 'jpeg' | 'png' {
  // WebP for best compression, fallback to JPEG for photos, PNG for graphics
  if (file.type.includes('png') && file.size < 100 * 1024) return 'png' // Small PNGs
  if (file.type.includes('gif')) return 'png' // Preserve transparency
  return 'webp' // Best compression for most cases
}

export function calculateCompressionRatio(originalSize: number, compressedSize: number): number {
  return Math.round(((originalSize - compressedSize) / originalSize) * 100)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}