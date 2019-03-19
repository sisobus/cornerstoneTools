import external from '../externalModules.js';
import mouseButtonTool from './mouseButtonTool.js';
import touchTool from './touchTool.js';
import triggerMeasurementCompletedEvent from '../util/triggerMeasurementCompletedEvent.js';
import drawLinkedTextBox from '../util/drawLinkedTextBox.js';
import toolStyle from '../stateManagement/toolStyle.js';
import toolColors from '../stateManagement/toolColors.js';
import drawHandles from '../manipulators/drawHandles.js';
import { getToolState } from '../stateManagement/toolState.js';
import lineSegDistance from '../util/lineSegDistance.js';
import { getNewContext, draw, setShadow, drawLine } from '../util/drawing.js';
import getColRowPixelSpacing from '../util/getColRowPixelSpacing.js';

const toolType = 'length';

// /////// BEGIN ACTIVE TOOL ///////
function createNewMeasurement (mouseEventData) {
  // Create the measurement data for this tool with the end handle activated
  const measurementData = {
    visible: true,
    active: true,
    color: undefined,
    handles: {
      start: {
        x: mouseEventData.currentPoints.image.x,
        y: mouseEventData.currentPoints.image.y,
        highlight: true,
        active: false
      },
      end: {
        x: mouseEventData.currentPoints.image.x,
        y: mouseEventData.currentPoints.image.y,
        highlight: true,
        active: true
      },
      textBox: {
        active: false,
        hasMoved: false,
        movesIndependently: false,
        drawnIndependently: true,
        allowedOutsideImage: true,
        hasBoundingBox: true
      }
    }
  };

  return measurementData;
}
// /////// END ACTIVE TOOL ///////

function pointNearTool (element, data, coords) {
  if (data.visible === false) {
    return false;
  }

  return lineSegDistance(element, data.handles.start, data.handles.end, coords) < 25;
}

function onHandleDoneMove (element, data) {
  const image = external.cornerstone.getImage(element);
  const { rowPixelSpacing, colPixelSpacing } = getColRowPixelSpacing(image);

  calculateLength(data, rowPixelSpacing, colPixelSpacing);

  triggerMeasurementCompletedEvent(element, data, toolType);
}

// /////// BEGIN IMAGE RENDERING ///////
function onImageRendered (e) {
  const eventData = e.detail;

  // If we have no toolData for this element, return immediately as there is nothing to do
  const toolData = getToolState(e.currentTarget, toolType);

  if (!toolData) {
    return;
  }

  // We have tool data for this element - iterate over each one and draw it
  const context = getNewContext(eventData.canvasContext.canvas);
  const { element } = eventData;

  const lineWidth = toolStyle.getToolWidth();
  const config = length.getConfiguration();
  const { rowPixelSpacing, colPixelSpacing } = getColRowPixelSpacing(eventData.image);

  for (let i = 0; i < toolData.data.length; i++) {
    const data = toolData.data[i];

    if (data.visible === false) {
      continue;
    }

    draw(context, (context) => {
      // Configurable shadow
      setShadow(context, config);

      const color = toolColors.getColorIfActive(data);

      // Draw the measurement line
      drawLine(context, element, data.handles.start, data.handles.end, { color });

      // Draw the handles
      const handleOptions = {
        drawHandlesIfActive: (config && config.drawHandlesOnHover)
      };

      drawHandles(context, eventData, data.handles, color, handleOptions);

      calculateLength(data, rowPixelSpacing, colPixelSpacing);

      if (!data.handles.textBox.hasMoved) {
        const coords = {
          x: Math.max(data.handles.start.x, data.handles.end.x)
        };

        // Depending on which handle has the largest x-value,
        // Set the y-value for the text box
        if (coords.x === data.handles.start.x) {
          coords.y = data.handles.start.y;
        } else {
          coords.y = data.handles.end.y;
        }

        data.handles.textBox.x = coords.x;
        data.handles.textBox.y = coords.y;
      }

      // Move the textbox slightly to the right and upwards
      // So that it sits beside the length tool handle
      const xOffset = 10;

      const text = textBoxText(data, rowPixelSpacing, colPixelSpacing);

      drawLinkedTextBox(context, element, data.handles.textBox, text,
        data.handles, textBoxAnchorPoints, color, lineWidth, xOffset, true);
    });
  }

  function textBoxText (data, rowPixelSpacing, colPixelSpacing) {
    // Set the length text suffix depending on whether or not pixelSpacing is available
    let suffix = ' mm';

    if (!rowPixelSpacing || !colPixelSpacing) {
      suffix = ' pixels';
    }

    data.unit = suffix.trim();

    return `${data.length.toFixed(2)}${suffix}`;
  }

  function textBoxAnchorPoints (handles) {
    const midpoint = {
      x: (handles.start.x + handles.end.x) / 2,
      y: (handles.start.y + handles.end.y) / 2
    };

    return [handles.start, midpoint, handles.end];
  }
}

function calculateLength (data, rowPixelSpacing, colPixelSpacing) {
  // Set rowPixelSpacing and columnPixelSpacing to 1 if they are undefined (or zero)
  const dx = (data.handles.end.x - data.handles.start.x) * (colPixelSpacing || 1);
  const dy = (data.handles.end.y - data.handles.start.y) * (rowPixelSpacing || 1);

  // Calculate the length, and create the text variable with the millimeters or pixels suffix
  const length = Math.sqrt(dx * dx + dy * dy);

  // Store the length inside the tool for outside access
  data.length = length;
}
// /////// END IMAGE RENDERING ///////

// Module exports
const length = mouseButtonTool({
  createNewMeasurement,
  onImageRendered,
  pointNearTool,
  toolType,
  onHandleDoneMove
});

const lengthTouch = touchTool({
  createNewMeasurement,
  onImageRendered,
  pointNearTool,
  toolType,
  onHandleDoneMove
});

export {
  length,
  lengthTouch
};
