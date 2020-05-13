import CancellationToken from "cancellationtoken";
import paper, { Color, Layer, Path, Point, Group } from "paper";
import React, { useEffect, useRef, useState } from "react";
import { easeOutQuint } from "../utils/easing";
import { mandelbrot } from "../utils/mandelbrot";
import { splitZone } from "../utils/splitZone";
import { wait } from "../utils/wait";
import styles from "./Sketch.module.css";

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
	await wait(10);
	return points;
};

function drawZone({ zone, transform: { zoom, translation } }) {
	new Path.Rectangle({
		from: new Point(
			zone.xmin * zoom + translation.x,
			zone.ymin * zoom + translation.y
		),
		to: new Point(
			zone.xmax * zoom + translation.x,
			zone.ymax * zoom + translation.y
		),
		strokeColor: new Color(0, 1, 0),
	});
}

const drawMandelbrot = async ({
	points,
	cellW,
	cellH,
	isDebugging = false,
	nbIteration,
	layer,
	transform: { zoom, translation },
}) => {
	points.forEach(([x, y, i], index) => {
		const xToViewSpace = x * zoom + translation.x,
			yToViewSpace = y * zoom + translation.y;
		const cellColor = new Color(
			0,
			0,
			i < nbIteration ? easeOutQuint(i / nbIteration) : 0
		);
		new Path.Rectangle({
			from: new Point(xToViewSpace, yToViewSpace),
			to: new Point(xToViewSpace + cellW, yToViewSpace + cellH),
			fillColor: cellColor,
			strokeColor: isDebugging ? new Color(1, 0, 0) : cellColor,
		});
	});
};

const renderMandelbrot = async ({
	cellH,
	cellW,
	isDebugging = false,
	layer,
	nbIteration,
	points,
	zone,
	transform: { zoom, translation },
}) => {
	await drawMandelbrot({
		points,
		zoom,
		cellW,
		cellH,
		isDebugging,
		nbIteration,
		layer,
		transform: { zoom, translation },
		translation,
	});

	if (isDebugging) {
		drawZone({ zone, transform: { zoom, translation } });
	}

	const raster = layer.rasterize(300);
	layer.removeChildren();
	layer.addChild(raster);

	await wait(10);
};

const computeAndDrawMandelbrot = async ({
	transform: { zoom, translation },
	zone,
	finalCellSize,
	depth = 1,
	level = 0,
	setIsComputing,
	setRealCellSize,
	isDebugging = false,
	nbIteration,
	threshold,
	token,
}) => {
	if (token.isCancelled) {
		return;
	}

	const zoneW = (zone.xmax - zone.xmin) * zoom;
	const zoneH = (zone.ymax - zone.ymin) * zoom;
	const levelCellSize = finalCellSize * Math.pow(2, depth - level);
	const nbCellX = Math.trunc(zoneW / levelCellSize);
	const nbCellY = Math.trunc(zoneH / levelCellSize);
	const cellW = zoneW / nbCellX;
	const cellH = zoneH / nbCellY;

	const points = await computeMandelbrot({
		nbStepX: nbCellX,
		nbStepY: nbCellY,
		zone,
		nbIteration,
		threshold,
	});

	const layer = new Layer();
	await renderMandelbrot({
		zone,
		points,
		transform: { zoom, translation },
		cellW,
		cellH,
		isDebugging,
		nbIteration,
		layer,
	});

	if (level < depth) {
		const zones = splitZone({ zone });
		await Promise.all(
			zones.map(async (zonePart) => {
				await computeAndDrawMandelbrot({
					transform: { zoom, translation },
					zone: zonePart,
					depth,
					finalCellSize,
					level: level + 1,
					isDebugging,
					nbIteration,
					threshold,
					token,
					setRealCellSize,
				});
			})
		);
		layer.remove();
	}

	if (level === 0) {
		setIsComputing(false);
	}
	if (level === depth) {
		setRealCellSize({ cellW, cellH });
	}
};

function getTranslation({ zone, zoom }) {
	const center = new Point(
		((zone.xmin + zone.xmax) * zoom) / 2.0,
		((zone.ymin + zone.ymax) * zoom) / 2.0
	);

	return paper.view.center.subtract(center);
}

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
	const [isComputing, setIsComputing] = useState(true);
	const [nbIteration, setNbIteration] = useState(200);
	const [threshold, setThreshold] = useState(2);
	const [{ cancel }, setCancellationToken] = useState({});

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
		let firstCorner, userLayer;
		const translation = getTranslation({ zone, zoom });

		paper.view.onMouseDown = ({ point }) => {
			userLayer = new Layer({});
			// Add the mouse down position
			firstCorner = point;
		};
		paper.view.onMouseDrag = ({ point }) => {
			paper.project.activeLayer.removeChildren();
			new Path.Rectangle({
				from: firstCorner,
				to: point,
				strokeColor: new Color(1, 0, 0),
				strokeWidth: 1,
			});
		};
		paper.view.onMouseUp = ({ point: secondCorner }) => {
			userLayer.remove();
			// Add the mouse up position:
			setZone({
				xmin: (firstCorner.x - translation.x) / zoom,
				ymin: (firstCorner.y - translation.y) / zoom,
				xmax: (secondCorner.x - translation.x) / zoom,
				ymax: (secondCorner.y - translation.y) / zoom,
			});
			setIsComputing(true);
			setCancellationToken(CancellationToken.create());
		};
	}, [zone, zoom]);

	// re-compute and draw
	useEffect(() => {
		if (!isComputing) {
			return;
		}

		setIsComputing(true);
		paper.project.clear();

		const translation = getTranslation({ zone, zoom });

		const { token, ...rest } = CancellationToken.create();
		setCancellationToken({ token, ...rest });

		computeAndDrawMandelbrot({
			transform: { zoom, translation },
			finalCellSize,
			zone,
			depth,
			setIsComputing,
			setRealCellSize,
			isDebugging,
			nbIteration,
			threshold,
			token,
		});
	}, [isComputing]);

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
		setIsComputing(true);
	};

	return (
		<>
			<canvas
				className={styles.canvas}
				id="mandel-view"
				resize="true"
			></canvas>
			<div className={styles.controlPanel}>
				<form onSubmit={handleSetZoom} className={styles.controles}>
					<div>
						<button
							type="button"
							onClick={() => setNbIteration(nbIteration - 1)}
						>
							-
						</button>
						<input
							type="text"
							value={nbIteration}
							onChange={({ target: { value } }) =>
								setNbIteration(Number(value))
							}
						/>
						<button
							type="button"
							onClick={() => setNbIteration(nbIteration + 1)}
						>
							+
						</button>{" "}
						Iteration
					</div>
					<div>
						<button
							type="button"
							onClick={() => setThreshold(threshold - 1)}
						>
							-
						</button>
						<input
							type="text"
							value={threshold}
							onChange={({ target: { value } }) =>
								setThreshold(Number(value))
							}
						/>
						<button
							type="button"
							onClick={() => setThreshold(threshold + 1)}
						>
							+
						</button>{" "}
						Threshold
					</div>
					<div>
						<button
							type="button"
							onClick={() => setDepth(depth - 1)}
						>
							-
						</button>
						<input
							type="text"
							value={depth}
							onChange={({ target: { value } }) =>
								setDepth(Number(value))
							}
						/>
						<button
							type="button"
							onClick={() => setDepth(depth + 1)}
						>
							+
						</button>{" "}
						Depth
					</div>
					<div>
						<button
							type="button"
							onClick={() => setFinalCellSize(finalCellSize - 1)}
						>
							-
						</button>
						<input
							type="text"
							value={finalCellSize}
							onChange={({ target: { value } }) =>
								setFinalCellSize(Number(value))
							}
						/>
						<button
							type="button"
							onClick={() => setFinalCellSize(finalCellSize + 1)}
						>
							+
						</button>{" "}
						Approx. cell. size in px (real w: {realCellSize.cellW},
						h: {realCellSize.cellH})
					</div>
					<div>
						<input
							ref={zoomRef}
							type="text"
							value={zoom}
							onChange={({ target: { value } }) =>
								setZoom(Number(value))
							}
						/>{" "}
						Zoom
					</div>
					<label>
						<input
							type="checkbox"
							checked={isDebugging}
							onChange={() => setIsDebugging(!isDebugging)}
						/>{" "}
						Debug Points
					</label>
					<input type="submit" value="go" disabled={isComputing} />
					<button
						type="button"
						onClick={() => {
							cancel();
							setIsComputing(false);
						}}
					>
						stop
					</button>
				</form>
				<div className={styles.positions}>
					<label>
						xmin:{" "}
						<input
							ref={xminRef}
							type="text"
							value={zone.xmin}
							readOnly
						/>
					</label>
					<label>
						xmax:{" "}
						<input
							ref={xmaxRef}
							type="text"
							value={zone.xmax}
							readOnly
						/>
					</label>
					<label>
						ymin:{" "}
						<input
							ref={yminRef}
							type="text"
							value={zone.ymin}
							readOnly
						/>
					</label>
					<label>
						ymax:{" "}
						<input
							ref={ymaxRef}
							type="text"
							value={zone.ymax}
							readOnly
						/>
					</label>
				</div>
			</div>
		</>
	);
};

export default Sketch;
