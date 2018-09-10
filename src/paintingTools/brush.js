import external from '../externalModules.js';
import { getToolState } from '../stateManagement/toolState.js';
import brushTool from './brushTool.js';
import getCircle from './getCircle.js';
import { drawBrushPixels, drawBrushOnCanvas } from './drawBrush.js';
import { getEndOfCircle, connectEndsOfBrush, isCircleInPolygon, fillColor } from './fill.js';

/* Safari and Edge polyfill for createImageBitmap
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/createImageBitmap
 */
if (!('createImageBitmap' in window)) {
  window.createImageBitmap = async function createImageBitmap (blob) {
    console.log('polyfilling!');
    return new Promise((resolve,reject) => {
      let img = document.createElement('img');
      img.addEventListener('load', function() {
        resolve(this);
      });
      img.src = URL.createObjectURL(blob);
    });
  }
}

// This module is for creating segmentation overlays
const TOOL_STATE_TOOL_TYPE = 'brush';
const toolType = 'brush';
const configuration = {
  draw: 1,
  radius: 3,
  hoverColor: 'green',
  dragColor: 'yellow'
};

let lastImageCoords;
let dragging = false;

function paint (eventData) {
  const configuration = brush.getConfiguration();
  const element = eventData.element;
  const { rows, columns } = eventData.image;
  const { x, y } = eventData.currentPoints.image;
  const toolData = getToolState(element, TOOL_STATE_TOOL_TYPE);
  const pixelData = toolData.data[0].pixelData;
  const brushPixelValue = configuration.draw;
  const radius = configuration.radius;

  if (x < 0 || x > columns ||
    y < 0 || y > rows) {
    return;
  }

  const pointerArray = getCircle(radius, rows, columns, x, y);

  drawBrushPixels(pointerArray, pixelData, brushPixelValue, columns);

  external.cornerstone.updateImage(eventData.element);
}

function onMouseUp (e) {
  const eventData = e.detail;

  lastImageCoords = eventData.currentPoints.image;
  dragging = false;
}

function onMouseDown (e) {
  const eventData = e.detail;

  paint(eventData);
  dragging = true;
  lastImageCoords = eventData.currentPoints.image;
}

function onMouseMove (e) {
  const eventData = e.detail;

  lastImageCoords = eventData.currentPoints.image;
  external.cornerstone.updateImage(eventData.element);
}

function onDrag (e) {
  const eventData = e.detail;

  paint(eventData);
  dragging = true;
  lastImageCoords = eventData.currentPoints.image;
}

function onImageRendered (e) {
  const eventData = e.detail;

  if (!lastImageCoords) {
    return;
  }

  const { rows, columns } = eventData.image;
  const { x, y } = lastImageCoords;

  if (x < 0 || x > columns ||
    y < 0 || y > rows) {
    return;
  }

  // Draw the hover overlay on top of the pixel data
  const configuration = brush.getConfiguration();
  const radius = configuration.radius;
  const context = eventData.canvasContext;
  const color = dragging ? configuration.dragColor : configuration.hoverColor;
  const element = eventData.element;

  context.setTransform(1, 0, 0, 1, 0, 0);

  const { cornerstone } = external;
  const mouseCoordsCanvas = cornerstone.pixelToCanvas(element, lastImageCoords);
  const canvasTopLeft = cornerstone.pixelToCanvas(element, { x: 0, y: 0 });
  const radiusCanvas = cornerstone.pixelToCanvas(element, { x: radius, y: 0 });
  const circleRadius = Math.abs(radiusCanvas.x - canvasTopLeft.x);
  context.beginPath();
  context.strokeStyle = color;
  context.ellipse(mouseCoordsCanvas.x, mouseCoordsCanvas.y, circleRadius, circleRadius, 0, 0, 2 * Math.PI);
  context.stroke();
}

// This method is for fill region of segmentation overlays
function fill (eventData) {
  const configuration = brush.getConfiguration();
  const radius = configuration.radius;
  const element = eventData.element;
  const { rows, columns } = eventData.image;
  let { x, y } = eventData.currentPoints.image;
  const toolData = getToolState(element, TOOL_STATE_TOOL_TYPE);
  const pixelData = toolData.data[0].pixelData;
  const brushPixelValue = configuration.draw;

  if (x < 0 || x > columns ||
    y < 0 || y > rows) {
    return;
  }

  x = Math.round(x);
  y = Math.round(y);

  // This thisCircle = [(x, y - radius), (x + radius, y), (x, y + radius), (x - radius, y)]
  const thisCircle = getEndOfCircle(x, y, columns, rows, pixelData, brushPixelValue);

  if (Math.abs(thisCircle[0] - thisCircle[2]) > radius * 2 && Math.abs(thisCircle[1] - thisCircle[3]) > radius * 2) {
    // If the position you clicked is aleady in same color, this method is not necessary.
    return;
  }

  if (connectEndsOfBrush(x, y, columns, rows, thisCircle, pixelData, brushPixelValue)) {
    if (isCircleInPolygon(x, y, columns, rows, thisCircle, pixelData, brushPixelValue)) {
      fillColor(x, thisCircle[0] - 1, columns, rows, pixelData, brushPixelValue);
    }
  }

  external.cornerstone.updateImage(element);
}

function onMouseDoubleClick (e) {
  const eventData = e.detail;

  fill(eventData);
}

const brush = brushTool({
  onMouseMove,
  onMouseDown,
  onMouseUp,
  onDrag,
  toolType,
  onImageRendered,
  onMouseDoubleClick
});

brush.setConfiguration(configuration);

export { brush };
