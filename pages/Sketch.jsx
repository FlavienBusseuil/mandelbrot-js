import paper, { Color, Layer, Path, Point } from "paper";
import React, { useEffect, useRef, useState } from "react";
import { mandelbrot } from "../utils/mandelbrot";
import { wait } from "../utils/wait";
import styles from "./Sketch.module.css";
import { easeOutQuint } from "../utils/easing";

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
  nbStepX,
  nbStepY,
  zone: { xmin, xmax, ymin, ymax },
  nbIteration,
  threshold,
}) => {
  const points = [];
  const stepX = (xmax - xmin) / nbStepX;
  const stepY = (ymax - ymin) / nbStepY;
  for (let i = 0; i < nbStepX; i++) {
    for (let j = 0; j < nbStepY; j++) {
      const x = xmin + i * stepX;
      const y = ymin + j * stepY;
      points.push([x, y, mandelbrot([x, y], nbIteration, threshold)]);
    }
  }
  return points;
};

const drawMandelbrot = async ({
  points,
  zoom,
  cellW,
  cellH,
  isDebugging = false,
  nbIteration,
}) => {
  points.forEach(([x, y, i], index) => {
    const path = new Path.Rectangle(
      new Point(x, y),
      new Point(x + cellW, y + cellH)
    );
    const cellColor = new Color(
      0,
      0,
      i < nbIteration ? easeOutQuint(i / nbIteration) : 0
    );
    path.fillColor = cellColor;
    if (isDebugging) {
      path.strokeWidth = 1 / zoom;
      path.strokeColor = new Color(1, 0, 0);
    } else {
      path.strokeWidth = 1 / zoom;
      path.strokeColor = cellColor;
    }
  });
  await wait(0);
};

const computeAndDrawMandelbrot = async ({
  zoom,
  zone,
  finalCellSize,
  depth = 1,
  level = 0,
  setIsComputing,
  setRealCellSize,
  isDebugging = false,
  nbIteration,
  threshold,
}) => {
  const zoneW = (zone.xmax - zone.xmin) * zoom;
  const zoneH = (zone.ymax - zone.ymin) * zoom;
  const levelCellSize = finalCellSize * Math.pow(2, depth - level);
  const nbCellX = Math.trunc(zoneW / levelCellSize);
  const nbCellY = Math.trunc(zoneH / levelCellSize);
  const cellW = zoneW / nbCellX;
  const cellH = zoneH / nbCellY;

  const layer = new Layer();
  const points = await computeMandelbrot({
    nbStepX: nbCellX,
    nbStepY: nbCellY,
    zone,
    nbIteration,
    threshold,
  });
  await drawMandelbrot({
    points,
    zoom,
    cellW: cellW / zoom,
    cellH: cellH / zoom,
    isDebugging,
    nbIteration,
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
        await wait(100 * i);
        await computeAndDrawMandelbrot({
          zoom,
          zone: zonePart,
          depth,
          finalCellSize,
          level: level + 1,
          isDebugging,
          nbIteration,
          threshold,
        });
      })
    );
    layer.removeChildren();
  }

  if (level === 0) {
    setIsComputing(false);
    setRealCellSize({ cellW, cellH });
  }
};

const Sketch = () => {
  const [depth, setDepth] = useState(0);
  const [zoom, setZoom] = useState(250);
  const [finalCellSize, setFinalCellSize] = useState(4);
  const [realCellSize, setRealCellSize] = useState({
    cellW: finalCellSize,
    cellH: finalCellSize,
  });
  const [zone, setZone] = useState({
    xmin: -2.25,
    xmax: 1.25,
    ymin: -1.5,
    ymax: 1.5,
  });
  const [isDebugging, setIsDebugging] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [nbIteration, setNbIteration] = useState(200);
  const [threshold, setThreshold] = useState(2);

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
      finalCellSize,
      zone,
      depth,
      setIsComputing,
      setRealCellSize,
      isDebugging,
      nbIteration,
      threshold,
    });
  }, [finalCellSize, zone, zoom, depth, isDebugging, nbIteration, threshold]);

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
      <canvas className={styles.canvas} id="mandel-view" resize="true"></canvas>
      <div className={styles.controlPanel}>
        <div className={styles.controles}>
          <div>
            <button onClick={() => setNbIteration(nbIteration - 1)}>-</button>
            <input
              type="text"
              value={nbIteration}
              onChange={({ target: { value } }) => setNbIteration(value)}
            />
            <button onClick={() => setNbIteration(nbIteration + 1)}>+</button>{" "}
            Iteration
          </div>
          <div>
            <button onClick={() => setThreshold(threshold - 1)}>-</button>
            <input
              type="text"
              value={threshold}
              onChange={({ target: { value } }) => setThreshold(value)}
            />
            <button onClick={() => setThreshold(threshold + 1)}>+</button>{" "}
            Threshold
          </div>
          <div>
            <button onClick={() => setDepth(depth - 1)}>-</button>
            <input
              type="text"
              value={depth}
              onChange={({ target: { value } }) => setDepth(value)}
            />
            <button onClick={() => setDepth(depth + 1)}>+</button> Depth
          </div>
          <div>
            <button onClick={() => setFinalCellSize(finalCellSize - 1)}>
              -
            </button>
            <input
              type="text"
              value={finalCellSize}
              onChange={({ target: { value } }) => setFinalCellSize(value)}
            />
            <button onClick={() => setFinalCellSize(finalCellSize + 1)}>
              +
            </button>{" "}
            Approx. cell. size in px (real w: {realCellSize.cellW}, h:{" "}
            {realCellSize.cellH})
          </div>
          <form onSubmit={handleSetZoom}>
            <input ref={zoomRef} type="text" defaultValue={zoom} />
            <button>go</button> Zoom
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
