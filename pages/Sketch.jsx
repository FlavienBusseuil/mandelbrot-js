import paper, { Color, Layer, Path, Point } from "paper";
import React, { useEffect, useRef, useState } from "react";
import { mandelbrot } from "../utils/mandelbrot";
import { wait } from "../utils/wait";
import styles from "./Sketch.module.css";

const splitZone = ({ zone, zone: { xmin, xmax, ymin, ymax }, nbSplit = 1 }) => {
  if (nbSplit === 0) {
    return [zone];
  }

  const newZones = [];
  const xPartSize = Math.abs(xmax - xmin) / 2;
  const yPartSize = Math.abs(ymax - ymin) / 2;
  for (let i = 0; i < 4; i++) {
    newZones.push({
      xmin: xmin + (i % 2) * xPartSize,
      xmax: xmin + ((i % 2) + 1) * xPartSize,
      ymin: ymin + Math.trunc(i / 2) * yPartSize,
      ymax: ymin + Math.trunc(i / 2 + 1) * yPartSize,
    });
  }

  return newZones.reduce(
    (prevZones, currZone) => [
      ...prevZones,
      ...splitZone({ zone: currZone, nbSplit: nbSplit - 1 }),
    ],
    []
  );
};

const computeMandelbrot = async ({
  zoom,
  resolutionX,
  resolutionY,
  zone: { xmin, xmax, ymin, ymax },
}) => {
  const points = [];
  const nbStepsX = ((xmax - xmin) * zoom) / resolutionX;
  const nbStepsY = ((ymax - ymin) * zoom) / resolutionY;
  const stepX = (xmax - xmin) / nbStepsX;
  const stepY = (ymax - ymin) / nbStepsY;
  for (let i = 0; i < nbStepsX; i++) {
    for (let j = 0; j < nbStepsY; j++) {
      const x = xmin + i * stepX;
      const y = ymin + j * stepY;
      points.push([x, y, mandelbrot([x, y], 20, 2)]);
    }
  }
  return points;
};

const drawMandelbrot = async ({
  points,
  zoom,
  pixelW,
  pixelH,
  isDebugging = false,
}) => {
  const xOffset = pixelW + 1 / zoom;
  const yOffset = pixelH + 1 / zoom;
  points.forEach(([x, y, i], index) => {
    const path = new Path.Rectangle(
      new Point(x, y),
      new Point(x + xOffset, y + yOffset)
    );
    path.fillColor = new Color(i > 20 ? i / 20 : 0, 0, i < 20 ? i / 20 : 0);
    if (isDebugging) {
      path.strokeWidth = 1 / zoom;
      path.strokeColor = new Color(1, 0, 0);
    }
  });
  await wait(0);
};

const computeAndDrawMandelbrot = async ({
  zoom,
  zone,
  finalPixelSize,
  depth = 1,
  level = 0,
  setIsComputing,
  isDebugging = false,
}) => {
  const resolutionX = finalPixelSize * Math.pow(4, depth - level);
  const resolutionY = finalPixelSize * Math.pow(4, depth - level);
  const layer = new Layer();
  const points = await computeMandelbrot({
    zoom,
    resolutionX,
    resolutionY,
    zone,
  });
  await drawMandelbrot({
    points,
    zoom,
    pixelW: resolutionX / zoom,
    pixelH: resolutionY / zoom,
    isDebugging,
  });

  if (isDebugging) {
    const path = new Path.Rectangle(
      new Point(zone.xmin, zone.ymin),
      new Point(zone.xmax, zone.ymax)
    );
    path.strokeWidth = 1 / zoom;
    path.strokeColor = new Color(0, 1, 0);
  }

  if (level < depth) {
    const zones = splitZone({ zone });
    await Promise.all(
      zones.map(async (zonePart, i) => {
        await wait(250 * i);
        await computeAndDrawMandelbrot({
          zoom,
          zone: zonePart,
          depth,
          finalPixelSize,
          level: level + 1,
          isDebugging,
        });
      })
    );
    layer.removeChildren();
  }

  if (level === 0) {
    setIsComputing(false);
  }
};

const Sketch = () => {
  const [depth, setDepth] = useState(0); // 1
  const [zoom, setZoom] = useState(250);
  const [finalPixelSize, setFinalPixelSize] = useState(10);
  const [zone, setZone] = useState({
    xmin: -2.25,
    xmax: 1.25,
    ymin: -1.5,
    ymax: 1.5,
  });
  const [isDebugging, setIsDebugging] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const xminRef = useRef(null);
  const xmaxRef = useRef(null);
  const yminRef = useRef(null);
  const ymaxRef = useRef(null);
  const zoomRef = useRef(null);

  // init
  useEffect(() => {
    paper.setup(document.getElementById("mandel-view"));
  }, []);

  // draw user zone
  useEffect(() => {
    let firstCorner;

    paper.view.onMouseDown = ({ point }) => {
      const userLayer = new Layer();
      firstCorner = point;
    };
    paper.view.onMouseDrag = ({ point }) => {
      paper.project.activeLayer.removeChildren();
      const path = new Path.Rectangle(firstCorner, point);
      path.strokeColor = new Color(1, 0, 0);
      path.strokeWidth = 1 / zoom;
    };
    paper.view.onMouseUp = ({ point }) => {
      // Add the mouse up position:
      setZone({
        xmin: firstCorner.x,
        xmax: point.x,
        ymin: firstCorner.y,
        ymax: point.y,
      });
    };
  }, [zoom]);

  // re-compute and draw
  useEffect(() => {
    const center = new Point(
      (zone.xmin + zone.xmax) / 2.0,
      (zone.ymin + zone.ymax) / 2.0
    );
    const { view } = paper;
    view.setCenter(center);
    view.zoom = zoom;

    paper.project.clear();
    setIsComputing(true);
    computeAndDrawMandelbrot({
      zoom,
      finalPixelSize,
      zone,
      depth,
      setIsComputing,
      isDebugging,
    });
  }, [finalPixelSize, zone, zoom, depth, isDebugging]);

  const handleSetZone = (event) => {
    event.preventDefault();
    setZone({
      xmin: Number(xminRef.current.value),
      xmax: Number(xmaxRef.current.value),
      ymin: Number(yminRef.current.value),
      ymax: Number(ymaxRef.current.value),
    });
  };

  const handleSetZoom = (event) => {
    event.preventDefault();
    setZoom(Number(zoomRef.current.value));
  };

  return (
    <>
      <canvas
        style={{ width: "100%", height: "100%", border: "1px solid black" }}
        id="mandel-view"
        resize="true"
      ></canvas>
      <div className={styles.controlPanel}>
        <div className={styles.controles}>
          <div>
            Nb Splits: <button onClick={() => setDepth(depth - 1)}>-</button>
            <input
              type="text"
              value={depth}
              onChange={({ target: { value } }) => setDepth(value)}
            />
            <button onClick={() => setDepth(depth + 1)}>+</button>
          </div>
          <div>
            Pixel size:{" "}
            <button onClick={() => setFinalPixelSize(finalPixelSize - 1)}>
              -
            </button>
            <input
              type="text"
              value={finalPixelSize}
              onChange={({ target: { value } }) => setFinalPixelSize(value)}
            />
            <button onClick={() => setFinalPixelSize(finalPixelSize + 1)}>
              +
            </button>
          </div>
          <form onSubmit={handleSetZoom}>
            Zoom: <input ref={zoomRef} type="text" defaultValue={zoom} />
            <button>go</button>
          </form>
          <button onClick={() => {}} disabled={isComputing}>
            stop
          </button>
          <label>
            <input
              type="checkbox"
              checked={isDebugging}
              onChange={() => setIsDebugging(!isDebugging)}
            />{" "}
            Debug Points
          </label>
        </div>
        <div className={styles.positions}>
          <label>
            xmin: <input ref={xminRef} type="text" value={zone.xmin} readOnly />
          </label>
          <label>
            xmax: <input ref={xmaxRef} type="text" value={zone.xmax} readOnly />
          </label>
          <label>
            ymin: <input ref={yminRef} type="text" value={zone.ymin} readOnly />
          </label>
          <label>
            ymax: <input ref={ymaxRef} type="text" value={zone.ymax} readOnly />
          </label>
        </div>
      </div>
    </>
  );
};

export default Sketch;
