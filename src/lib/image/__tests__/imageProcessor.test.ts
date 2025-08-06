import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImageProcessor, getOptimalFormat, calculateCompressionRatio, formatFileSize } from '../imageProcessor'

// Mock canvas and context
const mockCanvas = {
  width: 0,
  height: 0,
  getContext: vi.fn(() => mockContext),
  toBlob: vi.fn()
}

const mockContext = {
  clearRect: vi.fn(),
  drawImage: vi.fn()
}

// Mock DOM APIs
Object.defineProperty(global, 'document', {
  value: {
    createElement: vi.fn(() => mockCanvas)
  }
})

Object.defineProperty(global, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn()
  }
})

describe('ImageProcessor', () => {
  let processor: ImageProcessor

  beforeEach(() => {
    vi.clearAllMocks()
    processor = new ImageProcessor()
  })

  describe('constructor', () => {
    it('should create canvas and context', () => {
      expect(document.createElement).toHaveBeenCalledWith('canvas')
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d')
    })

    it('should throw error if 2D context not available', () => {
      mockCanvas.getContext.mockReturnValueOnce(null)
      expect(() => new ImageProcessor()).toThrow('Canvas 2D context not available')
    })
  })

  describe('processImage', () => {
    const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
    
    beforeEach(() => {
      // Mock image loading
      global.Image = class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 1200
        naturalHeight = 800
        
        set src(value: string) {
          setTimeout(() => this.onload?.(), 0)
        }
      } as any

      // Mock canvas toBlob
      mockCanvas.toBlob.mockImplementation((callback) => {
        const blob = new Blob(['mock'], { type: 'image/webp' })
        Object.defineProperty(blob, 'size', { value: 50000 })
        callback(blob)
      })
    })

    it('should process image with default options', async () => {
      const result = await processor.processImage(mockFile)

      expect(result).toEqual({
        original: 'blob:mock-url',
        thumbnail: 'blob:mock-url',
        optimized: 'blob:mock-url',
        dimensions: { width: 1200, height: 800 },
        fileSize: 50000,
        format: 'webp',
        altText: 'large webp image for SMS/MMS'
      })
    })

    it('should process image with custom options', async () => {
      const options = {
        maxDimension: 600,
        thumbnailSize: 100,
        quality: 0.9,
        format: 'jpeg' as const,
        generateAltText: false
      }

      const result = await processor.processImage(mockFile, options)

      expect(result.format).toBe('jpeg')
      expect(result.altText).toBeUndefined()
    })

    it('should handle image loading errors', async () => {
      global.Image = class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        
        set src(value: string) {
          setTimeout(() => this.onerror?.(), 0)
        }
      } as any

      await expect(processor.processImage(mockFile)).rejects.toThrow('Failed to load image')
    })
  })

  describe('batchProcess', () => {
    it('should process multiple files', async () => {
      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.png', { type: 'image/png' })
      ]

      // Mock successful processing
      vi.spyOn(processor, 'processImage').mockResolvedValue({
        original: 'blob:mock-url',
        thumbnail: 'blob:mock-url',
        optimized: 'blob:mock-url',
        dimensions: { width: 800, height: 600 },
        fileSize: 40000,
        format: 'webp',
        altText: 'test image'
      })

      const results = await processor.batchProcess(files)

      expect(results).toHaveLength(2)
      expect(processor.processImage).toHaveBeenCalledTimes(2)
    })
  })
})

describe('Utility Functions', () => {
  describe('getOptimalFormat', () => {
    it('should return png for small PNG files', () => {
      const file = new File(['small'], 'test.png', { type: 'image/png' })
      Object.defineProperty(file, 'size', { value: 50 * 1024 }) // 50KB
      expect(getOptimalFormat(file)).toBe('png')
    })

    it('should return png for GIF files', () => {
      const file = new File(['gif'], 'test.gif', { type: 'image/gif' })
      expect(getOptimalFormat(file)).toBe('png')
    })

    it('should return webp for large files', () => {
      const file = new File(['large'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 500 * 1024 }) // 500KB
      expect(getOptimalFormat(file)).toBe('webp')
    })
  })

  describe('calculateCompressionRatio', () => {
    it('should calculate compression ratio correctly', () => {
      expect(calculateCompressionRatio(1000, 500)).toBe(50)
      expect(calculateCompressionRatio(1000, 800)).toBe(20)
      expect(calculateCompressionRatio(1000, 1000)).toBe(0)
    })
  })

  describe('formatFileSize', () => {
    it('should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500B')
      expect(formatFileSize(1536)).toBe('1.5KB')
      expect(formatFileSize(2097152)).toBe('2.0MB')
    })
  })
})