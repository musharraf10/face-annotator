import {
  Group,
  Rect,
  FabricText,
  Line,
  Circle,
  Shadow,
  Control,
  controlsUtils,
} from 'fabric'

export const MIN_LABEL_WIDTH = 110
export const MIN_LABEL_HEIGHT = 40

/**
 * Calculates the exact center of the relevant box edge based on anchor position
 * @param {{ left: number, top: number, width: number, height: number }} box
 * @param {{ x: number, y: number }} anchor
 * @returns {{ x: number, y: number, edge: 'bottom' | 'top' | 'right' | 'left' }}
 */
export function getCalloutConnectionPoint(box, anchor) {
  const boxLeft = box.left
  const boxTop = box.top
  const boxWidth = box.width
  const boxHeight = box.height

  const centerX = boxLeft + boxWidth / 2
  const centerY = boxTop + boxHeight / 2

  const dx = anchor.x - centerX
  const dy = anchor.y - centerY

  const halfW = Math.max(1, boxWidth / 2)
  const halfH = Math.max(1, boxHeight / 2)

  // Compare normalized offsets
  const normX = dx / halfW
  const normY = dy / halfH

  if (Math.abs(normY) >= Math.abs(normX)) {
    // Primarily vertical
    if (dy >= 0) {
      // Below: connection is at the center of the bottom edge
      return { x: centerX, y: boxTop + boxHeight, edge: 'bottom' }
    } else {
      // Above: connection is at the center of the top edge
      return { x: centerX, y: boxTop, edge: 'top' }
    }
  } else {
    // Primarily horizontal
    if (dx >= 0) {
      // Right: connection is at the center of the right edge
      return { x: boxLeft + boxWidth, y: centerY, edge: 'right' }
    } else {
      // Left: connection is at the center of the left edge
      return { x: boxLeft, y: centerY, edge: 'left' }
    }
  }
}

/**
 * Synchronizes inner children (Rect, Name, ID) when the label group is resized
 * @param {Group} labelGroup
 */
export function syncLabelChildren(labelGroup) {
  const w = Math.max(MIN_LABEL_WIDTH, Math.round(labelGroup.width))
  const h = Math.max(MIN_LABEL_HEIGHT, Math.round(labelGroup.height))

  labelGroup.width = w
  labelGroup.height = h

  const rect = labelGroup._cardRect
  const nameText = labelGroup._nameText
  const idText = labelGroup._idText

  if (rect) {
    rect.set({ width: w, height: h })
  }

  // Name centered horizontally, placed in top half
  if (nameText) {
    nameText.set({
      left: 0,
      top: -Math.round(h * 0.18),
    })
  }

  // ID centered horizontally, placed in bottom half
  if (idText) {
    idText.set({
      left: 0,
      top: Math.round(h * 0.22),
    })
  }
}

/**
 * Creates custom resize controls for the label box so that text stays crisp and centered
 * @param {() => void} onResize
 * @returns {Record<string, Control>}
 */
function createLabelControls(onResize) {
  const handleWidthChange = controlsUtils.wrapWithFixedAnchor((eventData, transform, x, y) => {
    const changed = controlsUtils.changeObjectWidth(eventData, transform, x, y)
    if (changed) {
      if (transform.target.width < MIN_LABEL_WIDTH) {
        transform.target.width = MIN_LABEL_WIDTH
      }
      syncLabelChildren(transform.target)
      onResize?.()
    }
    return changed
  })

  const handleHeightChange = controlsUtils.wrapWithFixedAnchor((eventData, transform, x, y) => {
    const changed = controlsUtils.changeObjectHeight(eventData, transform, x, y)
    if (changed) {
      if (transform.target.height < MIN_LABEL_HEIGHT) {
        transform.target.height = MIN_LABEL_HEIGHT
      }
      syncLabelChildren(transform.target)
      onResize?.()
    }
    return changed
  })

  const handleCornerChange = controlsUtils.wrapWithFixedAnchor((eventData, transform, x, y) => {
    const wChanged = controlsUtils.changeObjectWidth(eventData, transform, x, y)
    const hChanged = controlsUtils.changeObjectHeight(eventData, transform, x, y)
    if (wChanged || hChanged) {
      if (transform.target.width < MIN_LABEL_WIDTH) {
        transform.target.width = MIN_LABEL_WIDTH
      }
      if (transform.target.height < MIN_LABEL_HEIGHT) {
        transform.target.height = MIN_LABEL_HEIGHT
      }
      syncLabelChildren(transform.target)
      onResize?.()
    }
    return wChanged || hChanged
  })

  return {
    mr: new Control({
      x: 0.5,
      y: 0,
      actionHandler: handleWidthChange,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionName: 'resizing',
    }),
    ml: new Control({
      x: -0.5,
      y: 0,
      actionHandler: handleWidthChange,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionName: 'resizing',
    }),
    mt: new Control({
      x: 0,
      y: -0.5,
      actionHandler: handleHeightChange,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionName: 'resizing',
    }),
    mb: new Control({
      x: 0,
      y: 0.5,
      actionHandler: handleHeightChange,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionName: 'resizing',
    }),
    tl: new Control({
      x: -0.5,
      y: -0.5,
      actionHandler: handleCornerChange,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionName: 'resizing',
    }),
    tr: new Control({
      x: 0.5,
      y: -0.5,
      actionHandler: handleCornerChange,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionName: 'resizing',
    }),
    bl: new Control({
      x: -0.5,
      y: 0.5,
      actionHandler: handleCornerChange,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionName: 'resizing',
    }),
    br: new Control({
      x: 0.5,
      y: 0.5,
      actionHandler: handleCornerChange,
      cursorStyleHandler: controlsUtils.scaleSkewCursorStyleHandler,
      actionName: 'resizing',
    }),
  }
}

/**
 * Updates the pointer line coordinates for a callout based on current label and anchor positions
 * @param {object} callout
 */
export function updateCalloutPointer(callout) {
  if (!callout || !callout.labelGroup || !callout.pointerLine || !callout.anchorHandle) {
    return
  }

  const { labelGroup, pointerLine, anchorHandle } = callout
  const anchorPos = { x: anchorHandle.left, y: anchorHandle.top }
  const conn = getCalloutConnectionPoint(labelGroup, anchorPos)

  pointerLine.set({
    x1: conn.x,
    y1: conn.y,
    x2: anchorPos.x,
    y2: anchorPos.y,
  })
  pointerLine.setCoords()
  callout.currentEdge = conn.edge
}

/**
 * Creates a coordinated Callout Annotation consisting of:
 * 1. Label Box Group (White Rect + Centered Name + Centered ID)
 * 2. Pointer Line (originating at center of relevant edge)
 * 3. Anchor Handle Circle (independently draggable face dot)
 *
 * @param {import('fabric').Canvas} canvas
 * @param {{ id: string, name: string }} employee
 * @param {object} options
 * @param {{ onModified?: () => void, onSelect?: (empId: string) => void }} callbacks
 * @returns {object} Callout object
 */
export function createCalloutAnnotation(canvas, employee, options = {}, callbacks = {}) {
  const { onModified, onSelect } = callbacks

  // Compute default label size and position
  const nameLen = (employee.name || '').length
  const defaultWidth = Math.max(140, Math.min(260, nameLen * 9 + 36))
  const defaultHeight = 48

  const labelX = options.label?.x ?? options.left ?? 100
  const labelY = options.label?.y ?? options.top ?? 100
  const width = options.label?.width ?? defaultWidth
  const height = options.label?.height ?? defaultHeight

  // Compute default anchor position (70px below bottom center by default)
  const defaultAnchorX = labelX + width / 2
  const defaultAnchorY = labelY + height + 70

  const anchorX = options.anchor?.x ?? defaultAnchorX
  const anchorY = options.anchor?.y ?? defaultAnchorY

  // 1. White Background Rect
  const rect = new Rect({
    width,
    height,
    rx: 6,
    ry: 6,
    fill: '#ffffff',
    stroke: '#2563eb',
    strokeWidth: 1.5,
    originX: 'center',
    originY: 'center',
    shadow: new Shadow({
      color: 'rgba(0, 0, 0, 0.18)',
      blur: 7,
      offsetX: 0,
      offsetY: 2,
    }),
  })

  // 2. Employee Name (bold, centered, dark)
  const nameText = new FabricText((employee.name || '').toUpperCase(), {
    fontSize: 13,
    fontWeight: '700',
    fill: '#0f172a',
    fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    originX: 'center',
    originY: 'center',
    top: -Math.round(height * 0.18),
    left: 0,
    textAlign: 'center',
  })

  // 3. Employee ID (monospace, centered, subtle)
  const idText = new FabricText(employee.id || '', {
    fontSize: 10.5,
    fontWeight: '600',
    fill: '#475569',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    originX: 'center',
    originY: 'center',
    top: Math.round(height * 0.22),
    left: 0,
    textAlign: 'center',
  })

  // Group white card + text into one resizable unit
  const labelGroup = new Group([rect, nameText, idText], {
    left: labelX,
    top: labelY,
    width,
    height,
    originX: 'left',
    originY: 'top',
    hasRotatingPoint: false,
    lockRotation: true,
    transparentCorners: false,
    cornerColor: '#2563eb',
    cornerStrokeColor: '#ffffff',
    cornerSize: 8,
    borderColor: '#3b82f6',
    borderScaleFactor: 1.5,
    subTargetCheck: false,
  })

  // Retain internal references for dynamic resizing
  labelGroup._cardRect = rect
  labelGroup._nameText = nameText
  labelGroup._idText = idText
  labelGroup._prevLeft = labelX
  labelGroup._prevTop = labelY

  // 4. Anchor Handle (draggable circular endpoint on the employee's face)
  const anchorHandle = new Circle({
    left: anchorX,
    top: anchorY,
    radius: 6,
    fill: '#2563eb',
    stroke: '#ffffff',
    strokeWidth: 1.5,
    originX: 'center',
    originY: 'center',
    hasControls: false,
    hasBorders: false,
    hoverCursor: 'crosshair',
    moveCursor: 'grabbing',
    shadow: new Shadow({
      color: 'rgba(0, 0, 0, 0.25)',
      blur: 4,
      offsetX: 0,
      offsetY: 1,
    }),
  })

  // 5. Dynamic Pointer Line
  const conn = getCalloutConnectionPoint(labelGroup, { x: anchorX, y: anchorY })
  const pointerLine = new Line([conn.x, conn.y, anchorX, anchorY], {
    stroke: '#2563eb',
    strokeWidth: 2,
    strokeLineCap: 'round',
    selectable: false,
    evented: false,
  })

  // Callout composite descriptor
  const callout = {
    employeeId: employee.id,
    employeeName: employee.name,
    labelGroup,
    pointerLine,
    anchorHandle,
    currentEdge: conn.edge,
  }

  // Tag Fabric objects with metadata
  labelGroup.isAnnotation = true
  labelGroup.isLabelGroup = true
  labelGroup.employeeId = employee.id
  labelGroup.employeeName = employee.name
  labelGroup.callout = callout

  anchorHandle.isAnnotation = true
  anchorHandle.isAnchorHandle = true
  anchorHandle.employeeId = employee.id
  anchorHandle.employeeName = employee.name
  anchorHandle.callout = callout

  pointerLine.isAnnotation = true
  pointerLine.isPointerLine = true
  pointerLine.employeeId = employee.id
  pointerLine.callout = callout

  // Attach custom resize controls to the label group
  labelGroup.controls = createLabelControls(() => {
    updateCalloutPointer(callout)
    canvas.requestRenderAll()
  })

  // Event: Dragging the Label Box moves the entire callout cohesively
  labelGroup.on('mousedown', () => {
    labelGroup._prevLeft = labelGroup.left
    labelGroup._prevTop = labelGroup.top
    onSelect?.(employee.id)
  })

  labelGroup.on('moving', () => {
    const prevL = labelGroup._prevLeft ?? labelGroup.left
    const prevT = labelGroup._prevTop ?? labelGroup.top
    const dx = labelGroup.left - prevL
    const dy = labelGroup.top - prevT

    labelGroup._prevLeft = labelGroup.left
    labelGroup._prevTop = labelGroup.top

    // Apply exact translation delta to anchor handle
    anchorHandle.set({
      left: anchorHandle.left + dx,
      top: anchorHandle.top + dy,
    })
    anchorHandle.setCoords()

    updateCalloutPointer(callout)
    canvas.requestRenderAll()
  })

  labelGroup.on('modified', () => {
    labelGroup._prevLeft = labelGroup.left
    labelGroup._prevTop = labelGroup.top
    onModified?.()
  })

  // Event: Dragging the Anchor Handle changes pointer length and angle independently
  anchorHandle.on('mousedown', () => {
    onSelect?.(employee.id)
  })

  anchorHandle.on('moving', () => {
    updateCalloutPointer(callout)
    canvas.requestRenderAll()
  })

  anchorHandle.on('modified', () => {
    onModified?.()
  })

  // Add all 3 objects to canvas in correct visual stacking order:
  // pointerLine (back) -> anchorHandle (middle) -> labelGroup (front)
  canvas.add(pointerLine)
  canvas.add(anchorHandle)
  canvas.add(labelGroup)

  return callout
}

/**
 * Removes all parts of a callout from canvas
 * @param {object} callout
 * @param {import('fabric').Canvas} canvas
 */
export function removeCalloutFromCanvas(callout, canvas) {
  if (!callout || !canvas) return
  if (callout.pointerLine) canvas.remove(callout.pointerLine)
  if (callout.anchorHandle) canvas.remove(callout.anchorHandle)
  if (callout.labelGroup) canvas.remove(callout.labelGroup)
  canvas.requestRenderAll()
}

/**
 * Brings a callout's objects to the front of the canvas
 * @param {object} callout
 * @param {import('fabric').Canvas} canvas
 */
export function bringCalloutToFront(callout, canvas) {
  if (!callout || !canvas) return
  if (callout.pointerLine) canvas.bringObjectToFront(callout.pointerLine)
  if (callout.anchorHandle) canvas.bringObjectToFront(callout.anchorHandle)
  if (callout.labelGroup) canvas.bringObjectToFront(callout.labelGroup)
  canvas.requestRenderAll()
}

/**
 * Serializes a callout to persistent state snapshot
 * @param {object} callout
 */
export function getCalloutSnapshot(callout) {
  if (!callout || !callout.labelGroup || !callout.anchorHandle) return null
  return {
    employeeId: callout.employeeId,
    employeeName: callout.employeeName,
    label: {
      x: Math.round(callout.labelGroup.left),
      y: Math.round(callout.labelGroup.top),
      width: Math.round(callout.labelGroup.width),
      height: Math.round(callout.labelGroup.height),
    },
    anchor: {
      x: Math.round(callout.anchorHandle.left),
      y: Math.round(callout.anchorHandle.top),
    },
  }
}


