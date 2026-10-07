import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas'

// PDF.js loads canvas with a dynamic require that serverless file tracing misses.
// A static dependency keeps the native bindings in the deployed function.
export async function loadServerPdfJs() {
  globalThis.DOMMatrix ||= DOMMatrix
  globalThis.ImageData ||= ImageData
  globalThis.Path2D ||= Path2D
  return import('pdfjs-dist/legacy/build/pdf.mjs')
}
