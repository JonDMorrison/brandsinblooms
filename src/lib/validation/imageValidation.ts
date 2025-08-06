// Image validation utilities for MMS
export interface ImageValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  optimizations: string[]
}

export interface ImageValidationOptions {
  maxFileSize?: number // bytes
  maxDimension?: number // pixels
  maxImageCount?: number
  allowedFormats?: string[]
  checkForDuplicates?: boolean
}

const DEFAULT_OPTIONS: Required<ImageValidationOptions> = {
  maxFileSize: 5 * 1024 * 1024, // 5MB (carrier limit is often 600KB-1MB)
  maxDimension: 1920, // pixels
  maxImageCount: 10, // Twilio supports up to 10 media URLs
  allowedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  checkForDuplicates: true
}

// MMS carrier limits (conservative estimates)
export const MMS_LIMITS = {
  TOTAL_SIZE: 600 * 1024, // 600KB total message size
  INDIVIDUAL_IMAGE: 500 * 1024, // 500KB per image
  RECOMMENDED_DIMENSION: 800, // pixels
  MAX_IMAGES_PER_MESSAGE: 10
}

export function validateSingleImage(
  file: File, 
  options: ImageValidationOptions = {}
): ImageValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const result: ImageValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    optimizations: []
  }

  // Check file type
  if (!opts.allowedFormats.includes(file.type)) {
    result.errors.push(`Unsupported format: ${file.type}. Supported: ${opts.allowedFormats.join(', ')}`)
    result.isValid = false
  }

  // Check file size
  if (file.size > opts.maxFileSize) {
    result.errors.push(`File too large: ${formatFileSize(file.size)}. Maximum: ${formatFileSize(opts.maxFileSize)}`)
    result.isValid = false
  }

  // Check MMS carrier limits
  if (file.size > MMS_LIMITS.INDIVIDUAL_IMAGE) {
    result.warnings.push(`Image may be too large for some carriers (${formatFileSize(file.size)} > ${formatFileSize(MMS_LIMITS.INDIVIDUAL_IMAGE)})`)
    result.optimizations.push('Consider compressing image for better delivery')
  }

  // Suggest format optimization
  if (file.type === 'image/png' && file.size > 100 * 1024) {
    result.optimizations.push('PNG images can be compressed better as WebP or JPEG')
  }

  return result
}

export function validateImageBatch(
  files: File[], 
  options: ImageValidationOptions = {}
): ImageValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const result: ImageValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    optimizations: []
  }

  // Check count limit
  if (files.length > opts.maxImageCount) {
    result.errors.push(`Too many images: ${files.length}. Maximum: ${opts.maxImageCount}`)
    result.isValid = false
  }

  // Check total size for MMS
  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  if (totalSize > MMS_LIMITS.TOTAL_SIZE) {
    result.warnings.push(`Total size may exceed MMS limits: ${formatFileSize(totalSize)} > ${formatFileSize(MMS_LIMITS.TOTAL_SIZE)}`)
    result.optimizations.push('Consider reducing image count or quality for MMS compatibility')
  }

  // Check for duplicates
  if (opts.checkForDuplicates) {
    const duplicates = findDuplicateFiles(files)
    if (duplicates.length > 0) {
      result.warnings.push(`Duplicate files detected: ${duplicates.join(', ')}`)
      result.optimizations.push('Remove duplicate images to reduce message size')
    }
  }

  // Validate individual files
  files.forEach((file, index) => {
    const fileResult = validateSingleImage(file, options)
    
    if (!fileResult.isValid) {
      result.isValid = false
      result.errors.push(...fileResult.errors.map(err => `Image ${index + 1}: ${err}`))
    }
    
    result.warnings.push(...fileResult.warnings.map(warn => `Image ${index + 1}: ${warn}`))
    result.optimizations.push(...fileResult.optimizations.map(opt => `Image ${index + 1}: ${opt}`))
  })

  return result
}

export function validateImageDimensions(file: File): Promise<ImageValidationResult> {
  return new Promise((resolve) => {
    const result: ImageValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      optimizations: []
    }

    const img = new Image()
    
    img.onload = () => {
      const { naturalWidth, naturalHeight } = img
      
      // Check maximum dimensions
      if (naturalWidth > DEFAULT_OPTIONS.maxDimension || naturalHeight > DEFAULT_OPTIONS.maxDimension) {
        result.warnings.push(`Large dimensions: ${naturalWidth}x${naturalHeight}. Consider resizing to ${DEFAULT_OPTIONS.maxDimension}px max.`)
        result.optimizations.push('Resize image for faster delivery and better compatibility')
      }

      // Check for very large images
      if (naturalWidth > 2000 || naturalHeight > 2000) {
        result.optimizations.push('Very large image - consider significant resizing for MMS')
      }

      // Check aspect ratio for mobile display
      const aspectRatio = naturalWidth / naturalHeight
      if (aspectRatio > 3 || aspectRatio < 0.33) {
        result.warnings.push('Extreme aspect ratio may not display well on mobile devices')
      }

      URL.revokeObjectURL(img.src)
      resolve(result)
    }

    img.onerror = () => {
      result.errors.push('Unable to read image dimensions')
      result.isValid = false
      URL.revokeObjectURL(img.src)
      resolve(result)
    }

    img.src = URL.createObjectURL(file)
  })
}

function findDuplicateFiles(files: File[]): string[] {
  const seen = new Map<string, number>()
  const duplicates: string[] = []

  files.forEach(file => {
    // Simple duplicate detection based on name and size
    const key = `${file.name}-${file.size}`
    const count = seen.get(key) || 0
    seen.set(key, count + 1)
    
    if (count === 1) {
      duplicates.push(file.name)
    }
  })

  return duplicates
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

// Validation presets for different use cases
export const VALIDATION_PRESETS = {
  MMS_OPTIMIZED: {
    maxFileSize: MMS_LIMITS.INDIVIDUAL_IMAGE,
    maxDimension: MMS_LIMITS.RECOMMENDED_DIMENSION,
    maxImageCount: 3, // Conservative for MMS
    allowedFormats: ['image/jpeg', 'image/webp'], // Best compression
    checkForDuplicates: true
  },
  
  HIGH_QUALITY: {
    maxFileSize: 5 * 1024 * 1024,
    maxDimension: 1920,
    maxImageCount: 10,
    allowedFormats: ['image/jpeg', 'image/png', 'image/webp'],
    checkForDuplicates: true
  },
  
  BULK_UPLOAD: {
    maxFileSize: 2 * 1024 * 1024,
    maxDimension: 1200,
    maxImageCount: 50,
    allowedFormats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    checkForDuplicates: false
  }
} as const