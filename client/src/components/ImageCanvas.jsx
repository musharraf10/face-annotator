import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Canvas, FabricImage } from 'fabric'
import { UploadCloud, Image as ImageIcon } from 'lucide-react'
import {
  createCalloutAnnotation,
  removeCalloutFromCanvas,
  bringCalloutToFront,
  getCalloutSnapshot,
} from './AnnotationTag'

export const ImageCanvas = forwardRef(function ImageCanvas(
  {
    imageDataUrl,
    onUploadImage,
    onAnnotationsChange,
    selectedEmployeeId,
    onSelectEmployee,
    onSaveState,
  },
  ref
) {
  const containerRef = useRef(null)
  const canvasElRef = useRef(null)
  const fabricCanvasRef = useRef(null)
  const bgImageRef = useRef(null)

  const [zoomLevel, setZoomLevel] = useState(1)
  const [placedCount, setPlacedCount] = useState(0)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // Map tracking employeeId -> Callout Composite
  const calloutsMapRef = useRef(new Map())

  const originalDimensionsRef = useRef({ width: 800, height: 600 })

  // Stable refs for callbacks to prevent unnecessary re-renders or canvas re-creations
  const onSelectEmployeeRef = useRef(onSelectEmployee)
  onSelectEmployeeRef.current = onSelectEmployee

  const onSaveStateRef = useRef(onSaveState)
  onSaveStateRef.current = onSaveState

  const onUploadImageRef = useRef(onUploadImage)
  onUploadImageRef.current = onUploadImage

  const currentImageDataUrlRef = useRef(imageDataUrl)
  currentImageDataUrlRef.current = imageDataUrl

  // Helper to extract placed employee IDs
  const syncPlacedEmployees = useCallback(() => {
    const ids = Array.from(calloutsMapRef.current.keys())
    setPlacedCount(ids.length)
    if (onAnnotationsChange) {
      onAnnotationsChange(ids)
    }
  }, [onAnnotationsChange])

  // Capture serializable snapshot of placed annotations
  const getAnnotationSnapshot = useCallback(() => {
    const snapshot = []
    calloutsMapRef.current.forEach((callout) => {
      const snap = getCalloutSnapshot(callout)
      if (snap) snapshot.push(snap)
    })
    return snapshot
  }, [])

  // Restore annotations from snapshot
  const restoreAnnotationSnapshot = useCallback(
    (annotationsList) => {
      const canvas = fabricCanvasRef.current
      if (!canvas || !Array.isArray(annotationsList)) return

      console.log('[FABRIC] Session restored', annotationsList.length, 'annotations')

      // Clear existing callouts from canvas
      calloutsMapRef.current.forEach((callout) => {
        removeCalloutFromCanvas(callout, canvas)
      })
      calloutsMapRef.current.clear()

      // Recreate each callout
      annotationsList.forEach((item) => {
        if (!item || !item.employeeId) return

        const employee = {
          id: item.employeeId,
          name: item.employeeName || item.employeeId,
        }

        let labelOptions
        let anchorOptions

        if (item.label && item.anchor) {
          // Modern callout format
          labelOptions = item.label
          anchorOptions = item.anchor
        } else {
          // Backwards compatibility with legacy snapshot format
          const left = item.left ?? 100
          const top = item.top ?? 100
          const dir = item.pointerDirection || 'down'
          const width = 150
          const height = 48
          labelOptions = { x: left, y: top, width, height }

          let anchorX = left + width / 2
          let anchorY = top + height + 70
          if (dir === 'top-left' || dir === 'top-right' || dir === 'top') {
            anchorY = top - 70
          }
          if (dir === 'bottom-left' || dir === 'top-left' || dir === 'left') {
            anchorX = left - 40
          } else if (dir === 'bottom-right' || dir === 'top-right' || dir === 'right') {
            anchorX = left + width + 40
          }
          anchorOptions = { x: anchorX, y: anchorY }
        }

        const callout = createCalloutAnnotation(
          canvas,
          employee,
          { label: labelOptions, anchor: anchorOptions },
          {
            onModified: () => onSaveStateRef.current?.(),
            onSelect: (empId) => onSelectEmployeeRef.current?.(empId),
          }
        )

        calloutsMapRef.current.set(employee.id, callout)
      })

      // Ensure background image remains at the bottom
      if (bgImageRef.current) {
        canvas.sendObjectToBack(bgImageRef.current)
      }

      canvas.requestRenderAll()
      syncPlacedEmployees()
    },
    [syncPlacedEmployees]
  )

  // Fit canvas to available container area
  const fitCanvasToContainer = useCallback(() => {
    const container = containerRef.current
    const canvas = fabricCanvasRef.current
    const bgImage = bgImageRef.current
    if (!container || !canvas || !bgImage) return

    const containerWidth = container.clientWidth - 32 // padding
    const containerHeight = container.clientHeight - 32
    if (containerWidth <= 0 || containerHeight <= 0) return

    const origW = originalDimensionsRef.current.width || bgImage.width
    const origH = originalDimensionsRef.current.height || bgImage.height

    const scale = Math.min(containerWidth / origW, containerHeight / origH, 1.0)
    const targetW = Math.round(origW * scale)
    const targetH = Math.round(origH * scale)

    canvas.setDimensions({ width: targetW, height: targetH })
    canvas.setZoom(1)
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0])

    bgImage.set({
      scaleX: scale,
      scaleY: scale,
      left: 0,
      top: 0,
    })

    canvas.calcOffset()
    canvas.requestRenderAll()
    setZoomLevel(1)
    console.log('[FABRIC] Canvas resized', { targetW, targetH, scale })
  }, [])

  const fitCanvasToContainerRef = useRef()
  fitCanvasToContainerRef.current = fitCanvasToContainer

  // Load Image into Canvas
  const loadImage = useCallback((url) => {
    const canvas = fabricCanvasRef.current
    if (!canvas || !url) return

    console.log('[FABRIC] Image loading')

    FabricImage.fromURL(url)
      .then((img) => {
        if (!fabricCanvasRef.current) return
        console.log('[FABRIC] Image loaded', { width: img.width, height: img.height })

        // Remove previous background image if any
        if (bgImageRef.current) {
          canvas.remove(bgImageRef.current)
          bgImageRef.current = null
        }

        const container = containerRef.current
        const maxW = Math.max(200, (container?.clientWidth || 800) - 32)
        const maxH = Math.max(200, (container?.clientHeight || 600) - 32)
        const scale = Math.min(maxW / img.width, maxH / img.height, 1.0)
        const targetW = Math.round(img.width * scale)
        const targetH = Math.round(img.height * scale)

        canvas.setDimensions({ width: targetW, height: targetH })
        canvas.setZoom(1)
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0])

        img.set({
          selectable: false,
          evented: false,
          hasControls: false,
          hasBorders: false,
          lockMovementX: true,
          lockMovementY: true,
          originX: 'left',
          originY: 'top',
          left: 0,
          top: 0,
          scaleX: scale,
          scaleY: scale,
        })

        img.isBackgroundImage = true
        bgImageRef.current = img
        originalDimensionsRef.current = { width: img.width, height: img.height }


        // Add as first object and ensure it is behind all annotations
        canvas.insertAt(0, img)
        canvas.sendObjectToBack(img)
        canvas.calcOffset()
        canvas.requestRenderAll()

        console.log('[FABRIC] Image added', { targetW, targetH, scale })
      })
      .catch((err) => {
        console.error('[FABRIC] Error loading image in Fabric.js', err)
      })
  }, [])

  // Expose canvas methods to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      getFabricCanvas: () => fabricCanvasRef.current,
      getOriginalWidth: () => originalDimensionsRef.current.width,
      getOriginalHeight: () => originalDimensionsRef.current.height,
      getSnapshot: getAnnotationSnapshot,
      restoreSnapshot: restoreAnnotationSnapshot,

      addOrSelectEmployee: (employee) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return

        // Check if already placed
        const existing = calloutsMapRef.current.get(employee.id)
        if (existing) {
          bringCalloutToFront(existing, canvas)
          canvas.setActiveObject(existing.labelGroup)
          canvas.requestRenderAll()
          onSelectEmployeeRef.current?.(employee.id)
          return
        }

        // Placement near center of current view
        const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0]
        const nameLen = (employee.name || '').length
        const cardW = Math.max(140, Math.min(260, nameLen * 9 + 36))
        const cardH = 48

        const centerX = (-vpt[4] + canvas.width / 2) / vpt[0] - cardW / 2
        const centerY = (-vpt[5] + canvas.height / 2) / vpt[3] - cardH / 2 - 40

        // Small jitter so consecutive adds don't completely overlap
        const jitterX = (Math.random() - 0.5) * 50
        const jitterY = (Math.random() - 0.5) * 50

        const labelPos = {
          x: Math.max(20, Math.round(centerX + jitterX)),
          y: Math.max(20, Math.round(centerY + jitterY)),
          width: cardW,
          height: cardH,
        }

        const anchorPos = {
          x: labelPos.x + cardW / 2,
          y: labelPos.y + cardH + 70,
        }

        const callout = createCalloutAnnotation(
          canvas,
          employee,
          { label: labelPos, anchor: anchorPos },
          {
            onModified: () => onSaveStateRef.current?.(),
            onSelect: (empId) => onSelectEmployeeRef.current?.(empId),
          }
        )

        calloutsMapRef.current.set(employee.id, callout)

        bringCalloutToFront(callout, canvas)
        canvas.setActiveObject(callout.labelGroup)
        canvas.requestRenderAll()

        syncPlacedEmployees()
        onSelectEmployeeRef.current?.(employee.id)
        onSaveStateRef.current?.()
      },

      deleteSelected: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const active = canvas.getActiveObject()
        if (active && active.isAnnotation && active.employeeId) {
          const callout = calloutsMapRef.current.get(active.employeeId)
          if (callout) {
            removeCalloutFromCanvas(callout, canvas)
            calloutsMapRef.current.delete(active.employeeId)
          }
          canvas.discardActiveObject()
          canvas.requestRenderAll()
          syncPlacedEmployees()
          onSelectEmployeeRef.current?.(null)
          onSaveStateRef.current?.()
        }
      },

      clearAllAnnotations: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        calloutsMapRef.current.forEach((callout) => {
          removeCalloutFromCanvas(callout, canvas)
        })
        calloutsMapRef.current.clear()
        canvas.discardActiveObject()
        canvas.requestRenderAll()
        syncPlacedEmployees()
        onSelectEmployeeRef.current?.(null)
        onSaveStateRef.current?.()
      },

      removeEmployee: (employeeId) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const callout = calloutsMapRef.current.get(employeeId)
        if (callout) {
          removeCalloutFromCanvas(callout, canvas)
          calloutsMapRef.current.delete(employeeId)
        }
        const remaining = canvas.getObjects().filter((o) => o.employeeId === employeeId)
        remaining.forEach((o) => canvas.remove(o))
        canvas.discardActiveObject()
        canvas.requestRenderAll()
        syncPlacedEmployees()
        onSelectEmployeeRef.current?.(null)
        onSaveStateRef.current?.()
      },

      updateEmployeeLabel: (oldId, newEmpData) => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const callout = calloutsMapRef.current.get(oldId)
        if (callout) {
          if (newEmpData.name) {
            callout.employeeName = newEmpData.name
            callout.labelGroup._nameText?.set('text', newEmpData.name.toUpperCase())
          }
          if (newEmpData.id && newEmpData.id !== oldId) {
            callout.employeeId = newEmpData.id
            callout.labelGroup._idText?.set('text', newEmpData.id)
            callout.labelGroup.employeeId = newEmpData.id
            callout.anchorHandle.employeeId = newEmpData.id
            callout.pointerLine.employeeId = newEmpData.id
            calloutsMapRef.current.delete(oldId)
            calloutsMapRef.current.set(newEmpData.id, callout)
          }
          canvas.requestRenderAll()
          syncPlacedEmployees()
        }
      },

      zoomIn: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const newZoom = Math.min(zoomLevel * 1.25, 3.5)
        setZoomLevel(newZoom)
        canvas.setZoom(newZoom)
        canvas.requestRenderAll()
      },

      zoomOut: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        const newZoom = Math.max(zoomLevel / 1.25, 0.4)
        setZoomLevel(newZoom)
        canvas.setZoom(newZoom)
        canvas.requestRenderAll()
      },

      resetZoom: () => {
        const canvas = fabricCanvasRef.current
        if (!canvas) return
        setZoomLevel(1)
        canvas.setZoom(1)
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0])
        canvas.requestRenderAll()
      },

      fitImage: () => {
        if (!containerRef.current || !bgImageRef.current || !fabricCanvasRef.current) return
        fitCanvasToContainer()
      },
    }),
    [
      getAnnotationSnapshot,
      restoreAnnotationSnapshot,
      syncPlacedEmployees,
      zoomLevel,
      fitCanvasToContainer,
    ]
  )

  // Initialize Fabric Canvas ONCE on mount
  useEffect(() => {
    if (!canvasElRef.current) return

    console.log('[FABRIC] Canvas initialized')

    const canvas = new Canvas(canvasElRef.current, {
      width: 800,
      height: 600,
      selection: true,
      preserveObjectStacking: true,
      backgroundColor: '#1e293b',
    })

    fabricCanvasRef.current = canvas

    // Selection listeners
    const handleSelection = (e) => {
      const selected = e.selected?.[0]
      if (selected && selected.isAnnotation && selected.employeeId) {
        const callout = calloutsMapRef.current.get(selected.employeeId)
        if (callout) {
          onSelectEmployeeRef.current?.(selected.employeeId)
          return
        }
      }
      onSelectEmployeeRef.current?.(null)
    }

    const handleDeselection = () => {
      onSelectEmployeeRef.current?.(null)
    }

    const handleObjectModified = () => {
      onSaveStateRef.current?.()
    }

    canvas.on('selection:created', handleSelection)
    canvas.on('selection:updated', handleSelection)
    canvas.on('selection:cleared', handleDeselection)
    canvas.on('object:modified', handleObjectModified)

    // Window resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (bgImageRef.current) {
        fitCanvasToContainerRef.current?.()
      }
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // If image data is already available when canvas initializes
    if (currentImageDataUrlRef.current) {
      loadImage(currentImageDataUrlRef.current)
    }

    return () => {
      console.log('[FABRIC] Canvas disposed')
      resizeObserver.disconnect()
      canvas.dispose()
      fabricCanvasRef.current = null
      bgImageRef.current = null
    }
  }, [loadImage])

  // Load Image into Canvas when imageDataUrl changes
  useEffect(() => {
    if (!imageDataUrl) {
      // Image removed
      const canvas = fabricCanvasRef.current
      if (canvas && bgImageRef.current) {
        canvas.remove(bgImageRef.current)
        bgImageRef.current = null
        canvas.requestRenderAll()
      }
      return
    }

    if (fabricCanvasRef.current) {
      loadImage(imageDataUrl)
    }
  }, [imageDataUrl, loadImage])


  // Sync selection from outside (when employee clicked in sidebar)
  useEffect(() => {
    const canvas = fabricCanvasRef.current
    if (!canvas || !selectedEmployeeId) return

    const callout = calloutsMapRef.current.get(selectedEmployeeId)
    if (callout && canvas.getActiveObject() !== callout.labelGroup) {
      bringCalloutToFront(callout, canvas)
      canvas.setActiveObject(callout.labelGroup)
      canvas.requestRenderAll()
    }
  }, [selectedEmployeeId])

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing inside input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        return
      }

      const canvas = fabricCanvasRef.current
      if (!canvas) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = canvas.getActiveObject()
        if (active && active.isAnnotation && active.employeeId) {
          e.preventDefault()
          const callout = calloutsMapRef.current.get(active.employeeId)
          if (callout) {
            removeCalloutFromCanvas(callout, canvas)
            calloutsMapRef.current.delete(active.employeeId)
          }
          canvas.discardActiveObject()
          canvas.requestRenderAll()
          syncPlacedEmployees()
          if (onSelectEmployee) onSelectEmployee(null)
          if (onSaveState) onSaveState()
        }
      } else if (e.key === 'Escape') {
        canvas.discardActiveObject()
        canvas.requestRenderAll()
        if (onSelectEmployee) onSelectEmployee(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [syncPlacedEmployees, onSelectEmployee, onSaveState])

  // Drag and drop image upload handlers
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)

    const files = e.dataTransfer?.files
    if (files && files[0]) {
      validateAndProcessFile(files[0])
    }
  }

  const handleFileInput = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndProcessFile(file)
    }
  }

  const validateAndProcessFile = (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid image file (JPG, JPEG, PNG, or WEBP).')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result
      if (result && onUploadImage) {
        onUploadImage(result, file.name)
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative flex-1 h-full w-full flex items-center justify-center p-4 overflow-hidden bg-slate-950 transition-colors ${
        isDraggingOver ? 'bg-slate-900 ring-2 ring-blue-500/50' : ''
      }`}
    >
      {/* Floating helper when image uploaded but no annotations placed */}
      {imageDataUrl && placedCount === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-300 text-xs shadow-lg backdrop-blur-sm pointer-events-none animate-in fade-in slide-in-from-top-2 z-20">
          Click an employee on the left to add their label
        </div>
      )}

      {/* Empty State: No image uploaded */}
      {!imageDataUrl && (
        <div className="flex flex-col items-center justify-center max-w-md p-8 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/50 text-center animate-in fade-in">
          <div className="p-3.5 bg-blue-500/10 rounded-2xl text-blue-400 mb-4 ring-1 ring-blue-500/20">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-100 mb-1">
            Upload today's group photo
          </h3>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">
            Drag & drop an image here or choose a file from your computer.
            <br />
            Supports JPG, JPEG, PNG, and WEBP.
          </p>

          <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-lg shadow-blue-900/25 cursor-pointer transition-all">
            <ImageIcon className="w-4 h-4" />
            Upload Image
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp"
              onChange={handleFileInput}
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Canvas container */}
      <div
        className={`relative items-center justify-center ${
          imageDataUrl ? 'flex' : 'hidden'
        }`}
      >
        <canvas ref={canvasElRef} />
      </div>
    </div>
  )
})
