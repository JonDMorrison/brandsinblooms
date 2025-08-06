import React, { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ImageIcon, XIcon, GripVerticalIcon, AlertTriangleIcon, CheckCircleIcon } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { ImageProcessor, getOptimalFormat, formatFileSize, calculateCompressionRatio } from '@/lib/image/imageProcessor'
import { ImageUploader } from '@/lib/image/imageUploader'

interface MediaFile {
  id: string
  file: File
  preview: string
  url?: string
  uploading: boolean
  processing: boolean
  error?: string
  optimized?: {
    url: string
    fileSize: number
    compressionRatio: number
  }
}

interface MultiImageUploadProps {
  value: string[]
  onChange: (urls: string[]) => void
  maxFiles?: number
  maxSizePerFile?: number // in KB
  className?: string
}

const ACCEPTED_FORMATS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'image/png': ['.png']
}

export function MultiImageUpload({
  value = [],
  onChange,
  maxFiles = 3,
  maxSizePerFile = 500, // 500KB default
  className = ""
}: MultiImageUploadProps) {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [processor] = useState(() => new ImageProcessor())
  const [uploader] = useState(() => new ImageUploader())

  const formatFileSize = (bytes: number) => {
    return `${Math.round(bytes / 1024)}KB`
  }

  const processAndUploadFile = async (file: File): Promise<string> => {
    console.log(`Processing ${file.name}...`)
    
    // Process image (resize, optimize, generate thumbnail)
    const processed = await processor.processImage(file, {
      maxDimension: 800,
      quality: 0.8,
      format: getOptimalFormat(file),
      generateAltText: true
    })
    
    console.log(`Processed ${file.name}: ${formatFileSize(processed.fileSize)} (${calculateCompressionRatio(file.size, processed.fileSize)}% compression)`)

    // Upload optimized version
    const optimizedBlob = await fetch(processed.optimized).then(r => r.blob())
    const result = await uploader.uploadProcessedImage(
      optimizedBlob,
      file.name,
      '-optimized',
      {
        metadata: {
          original_size: file.size,
          optimized_size: processed.fileSize,
          compression_ratio: calculateCompressionRatio(file.size, processed.fileSize),
          alt_text: processed.altText,
          dimensions: processed.dimensions
        }
      }
    )
    
    // Cleanup temporary URLs
    URL.revokeObjectURL(processed.original)
    URL.revokeObjectURL(processed.thumbnail) 
    URL.revokeObjectURL(processed.optimized)

    return result.publicUrl!
  }

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const currentCount = mediaFiles.length + value.length
    const remainingSlots = maxFiles - currentCount
    const filesToProcess = acceptedFiles.slice(0, remainingSlots)

    // Check file sizes
    const oversizedFiles = filesToProcess.filter(file => file.size > maxSizePerFile * 1024)
    if (oversizedFiles.length > 0) {
      // Still allow upload but show warning
    }

    const newMediaFiles: MediaFile[] = filesToProcess.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      processing: true
    }))

    setMediaFiles(prev => [...prev, ...newMediaFiles])

    // Process and upload files
    for (const mediaFile of newMediaFiles) {
      try {
        // Update to processing state
        setMediaFiles(prev => prev.map(mf => 
          mf.id === mediaFile.id 
            ? { ...mf, processing: true, uploading: false }
            : mf
        ))

        const url = await processAndUploadFile(mediaFile.file)
        
        setMediaFiles(prev => prev.map(mf => 
          mf.id === mediaFile.id 
            ? { 
                ...mf, 
                url, 
                processing: false, 
                uploading: false,
                optimized: {
                  url,
                  fileSize: mediaFile.file.size, // This would be updated with actual optimized size
                  compressionRatio: 0 // This would be calculated
                }
              }
            : mf
        ))

        // Update parent with new URL
        onChange([...value, url])
      } catch (error) {
        setMediaFiles(prev => prev.map(mf => 
          mf.id === mediaFile.id 
            ? { ...mf, processing: false, uploading: false, error: error.message }
            : mf
        ))
      }
    }
  }, [mediaFiles, value, onChange, maxFiles, maxSizePerFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FORMATS,
    maxFiles: maxFiles - value.length - mediaFiles.length,
    disabled: value.length + mediaFiles.length >= maxFiles
  })

  const removeFile = (index: number, isUploaded: boolean) => {
    if (isUploaded) {
      const newUrls = value.filter((_, i) => i !== index)
      onChange(newUrls)
    } else {
      const mediaFileIndex = index - value.length
      setMediaFiles(prev => prev.filter((_, i) => i !== mediaFileIndex))
    }
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newUrls = [...value]
    const draggedItem = newUrls[draggedIndex]
    newUrls.splice(draggedIndex, 1)
    newUrls.splice(index, 0, draggedItem)
    
    onChange(newUrls)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const canAddMore = value.length + mediaFiles.length < maxFiles
  const totalCount = value.length + mediaFiles.length

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Add Images (MMS)</h4>
        <Badge variant="outline" className="text-xs">
          {totalCount}/{maxFiles} images
        </Badge>
      </div>

      {/* Upload Area */}
      {canAddMore && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
        >
          <input {...getInputProps()} />
          <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-1">
            {isDragActive 
              ? 'Drop images here...'
              : 'Drag & drop images or click to browse'
            }
          </p>
          <p className="text-xs text-muted-foreground">
            JPG, PNG, WebP, GIF up to {maxSizePerFile}KB each
          </p>
        </div>
      )}

      {/* Image Previews */}
      {(value.length > 0 || mediaFiles.length > 0) && (
        <div className="grid grid-cols-3 gap-3">
          {/* Uploaded Images */}
          {value.map((url, index) => (
            <Card key={`uploaded-${index}`} className="relative group">
              <CardContent className="p-2">
                <div
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className="relative aspect-square rounded-md overflow-hidden cursor-move"
                >
                  <img
                    src={url}
                    alt={`Media ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <GripVerticalIcon className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {/* Optimization indicator */}
                  <div className="absolute bottom-1 right-1">
                    <CheckCircleIcon className="h-3 w-3 text-green-500 bg-white rounded-full" />
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFile(index, true)}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}

          {/* Uploading Files */}
          {mediaFiles.map((mediaFile, index) => (
            <Card key={mediaFile.id} className="relative group">
              <CardContent className="p-2">
                <div className="relative aspect-square rounded-md overflow-hidden">
                  <img
                    src={mediaFile.preview}
                    alt={`Processing ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {(mediaFile.processing || mediaFile.uploading) && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {mediaFile.error && (
                    <div className="absolute inset-0 bg-red-500/50 flex items-center justify-center">
                      <AlertTriangleIcon className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                
                {/* File size warning */}
                {mediaFile.file.size > maxSizePerFile * 1024 && (
                  <div className="absolute -bottom-1 left-1 right-1">
                    <Badge variant="secondary" className="text-xs w-full justify-center">
                      {formatFileSize(mediaFile.file.size)}
                    </Badge>
                  </div>
                )}

                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeFile(value.length + index, false)}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Warnings */}
      {totalCount > 0 && (
        <div className="space-y-2">
          <Badge variant="secondary" className="text-xs">
            <ImageIcon className="h-3 w-3 mr-1" />
            Will send as MMS with {totalCount} image{totalCount !== 1 ? 's' : ''}
          </Badge>

          {mediaFiles.some(mf => mf.file.size > maxSizePerFile * 1024) && (
            <Alert>
              <AlertTriangleIcon className="h-4 w-4" />
              <AlertDescription>
                Large files are being optimized automatically. Final size will be smaller and optimized for SMS/MMS delivery.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  )
}