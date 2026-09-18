/**
 * Utilities for rendering high-resolution annotated PNGs and previews
 */

/**
 * Generate a preview data URL without selection handles
 * @param {import('fabric').Canvas} canvas
 * @returns {string | null}
 */
export function generatePreviewDataUrl(canvas) {
  if (!canvas) return null;

  // Temporarily deselect any active object
  const activeObj = canvas.getActiveObject();
  if (activeObj) {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  try {
    const dataUrl = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier: 1,
    });

    // Restore selection if it existed
    if (activeObj) {
      canvas.setActiveObject(activeObj);
      canvas.requestRenderAll();
    }

    return dataUrl;
  } catch (err) {
    console.error("Failed to generate preview data URL", err);
    if (activeObj) {
      canvas.setActiveObject(activeObj);
      canvas.requestRenderAll();
    }
    return null;
  }
}

/**
 * Export high-resolution PNG image
 * @param {import('fabric').Canvas} canvas
 * @param {string} dateString - e.g. "2026-09-18"
 * @param {number} [originalWidth] - original image width to compute multiplier
 * @returns {boolean}
 */
export function exportCanvasAsPNG(canvas, dateString, originalWidth) {
  if (!canvas) return false;

  // Temporarily deselect any active object so no handles are exported
  const activeObj = canvas.getActiveObject();
  if (activeObj) {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  try {
    let multiplier = 1;
    if (originalWidth && canvas.width && originalWidth > canvas.width) {
      // Scale up to original photo resolution for maximum sharpness
      multiplier = originalWidth / canvas.width;
      // Cap at 4x to prevent browser canvas memory exhaustion on ultra-huge images
      multiplier = Math.min(multiplier, 4);
    }

    const dataUrl = canvas.toDataURL({
      format: "png",
      quality: 1,
      multiplier,
    });

    // Restore active selection
    if (activeObj) {
      canvas.setActiveObject(activeObj);
      canvas.requestRenderAll();
    }

    // Trigger download
    const filenameDate = dateString || new Date().toISOString().split("T")[0];
    const filename = `professional-presence-chalapathi-${filenameDate}.png`;

    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    return true;
  } catch (err) {
    console.error("Failed to export canvas PNG", err);
    if (activeObj) {
      canvas.setActiveObject(activeObj);
      canvas.requestRenderAll();
    }
    return false;
  }
}
