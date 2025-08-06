import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ImageUploader } from '../imageUploader'

// Mock Supabase
const mockSupabase = {
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(),
      remove: vi.fn(),
      getPublicUrl: vi.fn(() => ({
        data: { publicUrl: 'https://mock-url.com/image.jpg' }
      }))
    }))
  }
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}))

describe('ImageUploader', () => {
  let uploader: ImageUploader
  let mockStorageFrom: any

  beforeEach(() => {
    vi.clearAllMocks()
    uploader = new ImageUploader('test-bucket')
    mockStorageFrom = mockSupabase.storage.from()
  })

  describe('uploadProcessedImage', () => {
    const mockBlob = new Blob(['test'], { type: 'image/webp' })
    const originalFileName = 'test-image.jpg'

    beforeEach(() => {
      mockStorageFrom.upload.mockResolvedValue({
        data: { path: 'processed/test-image-123-abc.webp' },
        error: null
      })
    })

    it('should upload image successfully with default options', async () => {
      const result = await uploader.uploadProcessedImage(mockBlob, originalFileName)

      expect(mockSupabase.storage.from).toHaveBeenCalledWith('test-bucket')
      expect(mockStorageFrom.upload).toHaveBeenCalledWith(
        expect.stringContaining('processed/test-image'),
        mockBlob,
        {
          contentType: 'image/webp',
          metadata: undefined
        }
      )

      expect(result).toEqual({
        url: 'processed/test-image-123-abc.webp',
        path: 'processed/test-image-123-abc.webp',
        publicUrl: 'https://mock-url.com/image.jpg',
        metadata: undefined
      })
    })

    it('should upload with custom options', async () => {
      const options = {
        folder: 'custom',
        generatePublicUrl: false,
        metadata: { alt: 'test image' }
      }

      const result = await uploader.uploadProcessedImage(mockBlob, originalFileName, '-thumb', options)

      expect(mockStorageFrom.upload).toHaveBeenCalledWith(
        expect.stringContaining('custom/test-image-thumb'),
        mockBlob,
        {
          contentType: 'image/webp',
          metadata: { alt: 'test image' }
        }
      )

      expect(result.publicUrl).toBeUndefined()
      expect(result.metadata).toEqual({ alt: 'test image' })
    })

    it('should handle upload errors', async () => {
      mockStorageFrom.upload.mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' }
      })

      await expect(uploader.uploadProcessedImage(mockBlob, originalFileName))
        .rejects.toThrow('Failed to upload image: Upload failed')
    })

    it('should clean filename properly', async () => {
      const result = await uploader.uploadProcessedImage(mockBlob, 'test image@#$.jpg')

      expect(mockStorageFrom.upload).toHaveBeenCalledWith(
        expect.stringContaining('processed/test-image--'),
        mockBlob,
        expect.any(Object)
      )
    })
  })

  describe('uploadBatch', () => {
    const mockBlobs = [
      { blob: new Blob(['1'], { type: 'image/webp' }), name: 'image1.jpg' },
      { blob: new Blob(['2'], { type: 'image/webp' }), name: 'image2.jpg', suffix: '-thumb' }
    ]

    beforeEach(() => {
      mockStorageFrom.upload.mockResolvedValue({
        data: { path: 'processed/test.webp' },
        error: null
      })
    })

    it('should upload multiple images successfully', async () => {
      const results = await uploader.uploadBatch(mockBlobs)

      expect(results).toHaveLength(2)
      expect(mockStorageFrom.upload).toHaveBeenCalledTimes(2)
    })

    it('should handle partial failures', async () => {
      mockStorageFrom.upload
        .mockResolvedValueOnce({
          data: { path: 'processed/image1.webp' },
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Upload failed' }
        })

      const results = await uploader.uploadBatch(mockBlobs)

      expect(results).toHaveLength(1)
      expect(results[0].path).toBe('processed/image1.webp')
    })
  })

  describe('deleteImage', () => {
    it('should delete image successfully', async () => {
      mockStorageFrom.remove.mockResolvedValue({ error: null })

      await uploader.deleteImage('test/image.jpg')

      expect(mockStorageFrom.remove).toHaveBeenCalledWith(['test/image.jpg'])
    })

    it('should handle delete errors', async () => {
      mockStorageFrom.remove.mockResolvedValue({
        error: { message: 'Delete failed' }
      })

      await expect(uploader.deleteImage('test/image.jpg'))
        .rejects.toThrow('Failed to delete image: Delete failed')
    })
  })

  describe('deleteBatch', () => {
    it('should delete multiple images', async () => {
      mockStorageFrom.remove.mockResolvedValue({ error: null })

      const paths = ['image1.jpg', 'image2.jpg']
      await uploader.deleteBatch(paths)

      expect(mockStorageFrom.remove).toHaveBeenCalledWith(paths)
    })
  })

  describe('getExtensionFromBlob', () => {
    it('should return correct extensions', async () => {
      const webpBlob = new Blob(['test'], { type: 'image/webp' })
      const result = await uploader.uploadProcessedImage(webpBlob, 'test.jpg')
      
      expect(mockStorageFrom.upload).toHaveBeenCalledWith(
        expect.stringContaining('.webp'),
        expect.any(Blob),
        expect.any(Object)
      )
    })
  })
})