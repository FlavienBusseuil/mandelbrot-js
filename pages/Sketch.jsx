import CancellationToken from "cancellationtoken";
import paper, { Color, Layer, Path, Point, Group } from "paper";
import React, { useEffect, useRef, useState } from "react";
import { easeOutQuint } from "../utils/easing";
import { mandelbrotZone } from "../utils/mandelbrot";
import { splitZone } from "../utils/splitZone";
import { wait } from "../utils/wait";
import styles from "./Sketch.module.scss";

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
	const nbCellX = Math.trunc(zoneW / levelCellSize) || 1;
	const nbCellY = Math.trunc(zoneH / levelCellSize) || 1;
	const cellW = zoneW / nbCellX;
	const cellH = zoneH / nbCellY;

	const points = await mandelbrotZone({
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
		await Promise.all(
			splitZone({ zone }).map((zonePart) =>
				computeAndDrawMandelbrot({
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
				})
			)
		);
		if (token.isCancelled) {
			return;
		}
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
	const [depth, setDepth] = useState(4);
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
	const [{ cancel, token }, setCancellationToken] = useState({});

	const xminRef = useRef(null);
	const xmaxRef = useRef(null);
	const yminRef = useRef(null);
	const ymaxRef = useRef(null);
	const zoomRef = useRef(null);

	// Init
	useEffect(() => {
		// Init Paperjs with canvas
		paper.setup(document.getElementById("mandel-view"));
		// Init cancellation token
		setCancellationToken(CancellationToken.create());
		// Start computing
		setIsComputing(true);
	}, []);

	// Handle user zone drawing
	useEffect(() => {
		let firstCorner, userLayer;

		paper.view.onMouseDown = async ({ point, event: { button } }) => {
			if (button !== 0) return;

			userLayer = new Layer({});
			// Add the mouse down position
			firstCorner = point;
			cancel();
			setIsComputing(false);
		};
		paper.view.onMouseDrag = ({ point }) => {
			if (!firstCorner) return;

			userLayer.removeChildren();
			new Path.Rectangle({
				from: firstCorner,
				to: point,
				strokeColor: new Color(1, 0, 0),
				strokeWidth: 1,
			});
		};
		paper.view.onMouseUp = ({ point: secondCorner, event: { button } }) => {
			if (button !== 0 || !firstCorner) return;

			userLayer.remove();

			if (secondCorner.equals(firstCorner)) {
				return;
			}

			const translation = getTranslation({ zone, zoom });
			// Add the mouse up position:
			setZone({
				xmin: (firstCorner.x - translation.x) / zoom,
				ymin: (firstCorner.y - translation.y) / zoom,
				xmax: (secondCorner.x - translation.x) / zoom,
				ymax: (secondCorner.y - translation.y) / zoom,
			});
			setCancellationToken(CancellationToken.create());
			setIsComputing(true);
		};
	}, [zone, zoom, cancel]);

	// re-compute and draw
	useEffect(() => {
		if (!isComputing) {
			return;
		}

		paper.project.clear();

		const translation = getTranslation({ zone, zoom });

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

	const handleSubmit = (event) => {
		event.preventDefault();
		setIsComputing(true);
	};

	const handleSetZone = (event) => {
		event.preventDefault();
		setZone({
			xmin: Number(xminRef.current.value),
			xmax: Number(xmaxRef.current.value),
			ymin: Number(yminRef.current.value),
			ymax: Number(ymaxRef.current.value),
		});
	};

	const handleStop = () => {
		cancel();
		setIsComputing(false);
		setCancellationToken(CancellationToken.create());
	};

	const handleWheel = ({ deltaY }) => {
		cancel();
		setCancellationToken(CancellationToken.create());
		setIsComputing(false);
		const newZoom = zoom - Math.trunc(deltaY * ((zoom || 1) / 100));
		setZoom(newZoom > 1 ? newZoom : 1);
		(async () => {
			await wait(100);
			setIsComputing(true);
		})();
	};

	return (
		<>
			<canvas
				className={styles.canvas}
				id="mandel-view"
				resize="true"
				onWheel={handleWheel}
			></canvas>
			<div className={styles.controlPanel}>
				<form onSubmit={handleSubmit} className={styles.controles}>
					<div>
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
								onClick={() =>
									setFinalCellSize(finalCellSize - 1)
								}
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
								onClick={() =>
									setFinalCellSize(finalCellSize + 1)
								}
							>
								+
							</button>{" "}
							Approx. cell. size in px (real w:{" ~"}
							{Number(realCellSize.cellW.toFixed(3))}, h:{" ~"}
							{Number(realCellSize.cellH.toFixed(3))})
						</div>
					</div>
					<div>
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
						{isComputing ? (
							<button type="button" onClick={handleStop}>
								stop
							</button>
						) : (
							<input type="submit" value="go" />
						)}
					</div>
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
