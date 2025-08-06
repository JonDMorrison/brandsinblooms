import { describe, it, expect, beforeEach } from 'vitest'
import { 
  validateSingleImage, 
  validateImageBatch, 
  validateImageDimensions,
  VALIDATION_PRESETS,
  MMS_LIMITS 
} from '../imageValidation'

describe('imageValidation', () => {
  describe('validateSingleImage', () => {
    it('should validate a good image', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 100 * 1024 }) // 100KB

      const result = validateSingleImage(file)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject unsupported format', () => {
      const file = new File(['test'], 'test.bmp', { type: 'image/bmp' })

      const result = validateSingleImage(file)

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Unsupported format')
    })

    it('should reject oversized files', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 10 * 1024 * 1024 }) // 10MB

      const result = validateSingleImage(file)

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('File too large')
    })

    it('should warn about MMS size limits', () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 600 * 1024 }) // 600KB

      const result = validateSingleImage(file)

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('may be too large for some carriers')
    })

    it('should suggest PNG optimization', () => {
      const file = new File(['test'], 'test.png', { type: 'image/png' })
      Object.defineProperty(file, 'size', { value: 200 * 1024 }) // 200KB

      const result = validateSingleImage(file)

      expect(result.optimizations.length).toBeGreaterThan(0)
      expect(result.optimizations[0]).toContain('PNG images can be compressed better')
    })
  })

  describe('validateImageBatch', () => {
    it('should validate multiple good images', () => {
      const files = [
        new File(['test1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['test2'], 'test2.png', { type: 'image/png' })
      ]

      files.forEach(file => {
        Object.defineProperty(file, 'size', { value: 100 * 1024 })
      })

      const result = validateImageBatch(files)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject too many images', () => {
      const files = Array.from({ length: 15 }, (_, i) => 
        new File(['test'], `test${i}.jpg`, { type: 'image/jpeg' })
      )

      const result = validateImageBatch(files)

      expect(result.isValid).toBe(false)
      expect(result.errors[0]).toContain('Too many images')
    })

    it('should warn about total MMS size', () => {
      const files = Array.from({ length: 3 }, (_, i) => 
        new File(['test'], `test${i}.jpg`, { type: 'image/jpeg' })
      )

      files.forEach(file => {
        Object.defineProperty(file, 'size', { value: 300 * 1024 }) // 300KB each = 900KB total
      })

      const result = validateImageBatch(files)

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('Total size may exceed MMS limits')
    })

    it('should detect duplicate files', () => {
      const files = [
        new File(['test'], 'duplicate.jpg', { type: 'image/jpeg' }),
        new File(['test'], 'duplicate.jpg', { type: 'image/jpeg' })
      ]

      files.forEach(file => {
        Object.defineProperty(file, 'size', { value: 100 * 1024 })
      })

      const result = validateImageBatch(files)

      expect(result.warnings.some(w => w.includes('Duplicate files detected'))).toBe(true)
    })
  })

  describe('validateImageDimensions', () => {
    beforeEach(() => {
      // Mock Image constructor
      global.Image = class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 1200
        naturalHeight = 800
        
        set src(value: string) {
          setTimeout(() => this.onload?.(), 0)
        }
      } as any

      // Mock URL methods
      global.URL.createObjectURL = () => 'blob:mock-url'
      global.URL.revokeObjectURL = () => {}
    })

    it('should validate normal dimensions', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await validateImageDimensions(file)

      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })

    it('should warn about large dimensions', async () => {
      global.Image = class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 3000
        naturalHeight = 2000
        
        set src(value: string) {
          setTimeout(() => this.onload?.(), 0)
        }
      } as any

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await validateImageDimensions(file)

      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('Large dimensions')
    })

    it('should warn about extreme aspect ratios', async () => {
      global.Image = class {
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        naturalWidth = 2000
        naturalHeight = 500 // 4:1 aspect ratio
        
        set src(value: string) {
          setTimeout(() => this.onload?.(), 0)
        }
      } as any

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await validateImageDimensions(file)

      expect(result.warnings.some(w => w.includes('Extreme aspect ratio'))).toBe(true)
    })
  })

  describe('Validation Presets', () => {
    it('should have MMS_OPTIMIZED preset', () => {
      expect(VALIDATION_PRESETS.MMS_OPTIMIZED).toBeDefined()
      expect(VALIDATION_PRESETS.MMS_OPTIMIZED.maxFileSize).toBe(MMS_LIMITS.INDIVIDUAL_IMAGE)
      expect(VALIDATION_PRESETS.MMS_OPTIMIZED.maxImageCount).toBe(3)
    })

    it('should have HIGH_QUALITY preset', () => {
      expect(VALIDATION_PRESETS.HIGH_QUALITY).toBeDefined()
      expect(VALIDATION_PRESETS.HIGH_QUALITY.maxFileSize).toBe(5 * 1024 * 1024)
    })

    it('should have BULK_UPLOAD preset', () => {
      expect(VALIDATION_PRESETS.BULK_UPLOAD).toBeDefined()
      expect(VALIDATION_PRESETS.BULK_UPLOAD.maxImageCount).toBe(50)
    })
  })

  describe('MMS_LIMITS constants', () => {
    it('should have appropriate limits', () => {
      expect(MMS_LIMITS.TOTAL_SIZE).toBe(600 * 1024)
      expect(MMS_LIMITS.INDIVIDUAL_IMAGE).toBe(500 * 1024)
      expect(MMS_LIMITS.RECOMMENDED_DIMENSION).toBe(800)
      expect(MMS_LIMITS.MAX_IMAGES_PER_MESSAGE).toBe(10)
    })
  })
})