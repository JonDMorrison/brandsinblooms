import { supabase } from '@/integrations/supabase/client'

interface UploadOptions {
  bucket?: string
  folder?: string
  generatePublicUrl?: boolean
  metadata?: Record<string, any>
}

interface UploadResult {
  url: string
  path: string
  publicUrl?: string
  metadata?: Record<string, any>
}

export class ImageUploader {
  private bucket: string

  constructor(bucket: string = 'media-mms') {
    this.bucket = bucket
  }

  async uploadProcessedImage(
    blob: Blob, 
    originalFileName: string,
    suffix: string = '',
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const opts = { 
      generatePublicUrl: true, 
      folder: 'processed',
      ...options 
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substr(2, 9)
    const extension = this.getExtensionFromBlob(blob)
    const cleanName = originalFileName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9-_]/g, '-')
    
    const fileName = `${cleanName}${suffix}-${timestamp}-${randomId}.${extension}`
    const filePath = opts.folder ? `${opts.folder}/${fileName}` : fileName

    console.log(`Uploading processed image: ${filePath}`)

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .upload(filePath, blob, {
        contentType: blob.type,
        metadata: opts.metadata
      })

    if (error) {
      console.error('Upload error:', error)
      throw new Error(`Failed to upload image: ${error.message}`)
    }

    let publicUrl: string | undefined
    if (opts.generatePublicUrl) {
      const { data: urlData } = supabase.storage
        .from(this.bucket)
        .getPublicUrl(data.path)
      publicUrl = urlData.publicUrl
    }

    return {
      url: data.path,
      path: data.path,
      publicUrl,
      metadata: opts.metadata
    }
  }

  async uploadBatch(
    blobs: { blob: Blob; name: string; suffix?: string }[],
    options: UploadOptions = {}
  ): Promise<UploadResult[]> {
    const uploadPromises = blobs.map(({ blob, name, suffix = '' }) =>
      this.uploadProcessedImage(blob, name, suffix, options)
    )

    const results = await Promise.allSettled(uploadPromises)
    
    const successful: UploadResult[] = []
    const failed: string[] = []

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value)
      } else {
        failed.push(`${blobs[index].name}: ${result.reason.message}`)
        console.error(`Failed to upload ${blobs[index].name}:`, result.reason)
      }
    })

    if (failed.length > 0) {
      console.warn(`${failed.length} uploads failed:`, failed)
    }

    console.log(`Batch upload completed: ${successful.length} successful, ${failed.length} failed`)
    return successful
  }

  private getExtensionFromBlob(blob: Blob): string {
    const mimeType = blob.type
    switch (mimeType) {
      case 'image/webp': return 'webp'
      case 'image/jpeg': return 'jpg'
      case 'image/png': return 'png'
      case 'image/gif': return 'gif'
      default: return 'jpg'
    }
  }

  async deleteImage(path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(this.bucket)
      .remove([path])

    if (error) {
      console.error('Delete error:', error)
      throw new Error(`Failed to delete image: ${error.message}`)
    }
  }

  async deleteBatch(paths: string[]): Promise<void> {
    const { error } = await supabase.storage
      .from(this.bucket)
      .remove(paths)

    if (error) {
      console.error('Batch delete error:', error)
      throw new Error(`Failed to delete images: ${error.message}`)
    }
  }
}