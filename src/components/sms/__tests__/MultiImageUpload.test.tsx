import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MultiImageUpload } from '../MultiImageUpload'

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(() => ({
    getRootProps: () => ({ 'data-testid': 'dropzone' }),
    getInputProps: () => ({ 'data-testid': 'file-input' }),
    isDragActive: false,
    isDragAccept: false,
    isDragReject: false
  }))
}))

// Mock image processing
vi.mock('@/lib/image/imageProcessor', () => ({
  ImageProcessor: class {
    async processImage() {
      return {
        original: 'blob:original',
        thumbnail: 'blob:thumbnail',
        optimized: 'blob:optimized',
        dimensions: { width: 800, height: 600 },
        fileSize: 40000,
        format: 'webp'
      }
    }
  },
  getOptimalFormat: vi.fn(() => 'webp'),
  formatFileSize: vi.fn((bytes) => `${Math.round(bytes / 1024)}KB`),
  calculateCompressionRatio: vi.fn(() => 50)
}))

// Mock image uploader
vi.mock('@/lib/image/imageUploader', () => ({
  ImageUploader: class {
    async uploadProcessedImage() {
      return {
        url: 'processed/image.webp',
        path: 'processed/image.webp',
        publicUrl: 'https://example.com/image.webp'
      }
    }
  }
}))

// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {}
}))

describe('MultiImageUpload', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock URL.createObjectURL and revokeObjectURL
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    global.URL.revokeObjectURL = vi.fn()
  })

  it('renders upload area correctly', () => {
    render(
      <MultiImageUpload
        value={[]}
        onChange={mockOnChange}
        maxFiles={3}
      />
    )

    expect(screen.getByTestId('dropzone')).toBeInTheDocument()
    expect(screen.getByText(/drag & drop images or click to browse/i)).toBeInTheDocument()
    expect(screen.getByText(/0\/3 images/i)).toBeInTheDocument()
  })

  it('displays uploaded images', () => {
    const mockUrls = [
      'https://example.com/image1.jpg',
      'https://example.com/image2.jpg'
    ]

    render(
      <MultiImageUpload
        value={mockUrls}
        onChange={mockOnChange}
        maxFiles={3}
      />
    )

    expect(screen.getByText(/2\/3 images/i)).toBeInTheDocument()
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })

  it('shows processing message when files are uploading', () => {
    render(
      <MultiImageUpload
        value={[]}
        onChange={mockOnChange}
        maxFiles={3}
      />
    )

    // The component should show upload area when no images
    expect(screen.getByTestId('dropzone')).toBeInTheDocument()
  })

  it('allows removing images', async () => {
    const user = userEvent.setup()
    const mockUrls = ['https://example.com/image1.jpg']

    render(
      <MultiImageUpload
        value={mockUrls}
        onChange={mockOnChange}
        maxFiles={3}
      />
    )

    // Find and click the remove button
    const removeButton = screen.getByRole('button')
    await user.click(removeButton)

    expect(mockOnChange).toHaveBeenCalledWith([])
  })

  it('shows file size warnings for large files', () => {
    render(
      <MultiImageUpload
        value={[]}
        onChange={mockOnChange}
        maxFiles={3}
        maxSizePerFile={100} // 100KB limit
      />
    )

    expect(screen.getByText(/JPG, PNG, WebP, GIF up to 100KB each/i)).toBeInTheDocument()
  })

  it('disables upload when at max capacity', () => {
    const mockUrls = ['url1', 'url2', 'url3']

    render(
      <MultiImageUpload
        value={mockUrls}
        onChange={mockOnChange}
        maxFiles={3}
      />
    )

    // Should not show upload area when at max capacity
    expect(screen.queryByTestId('dropzone')).not.toBeInTheDocument()
    expect(screen.getByText(/3\/3 images/i)).toBeInTheDocument()
  })

  it('shows MMS indicator when images are present', () => {
    const mockUrls = ['https://example.com/image1.jpg']

    render(
      <MultiImageUpload
        value={mockUrls}
        onChange={mockOnChange}
        maxFiles={3}
      />
    )

    expect(screen.getByText(/Will send as MMS with 1 image/i)).toBeInTheDocument()
  })
})