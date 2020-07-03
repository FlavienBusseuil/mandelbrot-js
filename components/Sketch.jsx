import { Layout } from "antd";
import paper, {
	Color,
	Layer,
	Path,
	Point,
	Size,
	Matrix,
	Rectangle,
} from "paper";
import React, { useEffect, useReducer, useRef, useState } from "react";
import { drawMandelbrot } from "../utils/draw/drawMandelbrot";
import { drawZone } from "../utils/draw/drawZone";
import JobQueue from "../utils/JobQueue";
import { mandelbrotZone } from "../utils/mandelbrot";
import { splitZone } from "../utils/splitZone";
import { wait } from "../utils/wait";
import ControlPanel from "./ControlPanel";
import styles from "./Sketch.module.scss";

const { Sider, Content } = Layout;

const mandelMatrix = new Matrix();
const mandelCenter = new Point(0, 0);

function toMandelView({ x, y }) {
	const { translation, scaling: zoom } = mandelMatrix;
	return { x: x * zoom + translation.x, y: y * zoom + translation.y };
}

function toPaperView({ x, y }) {
	const { translation, scaling: zoom } = mandelMatrix;
	return { x: (x - translation.x) / zoom, y: (y - translation.y) / zoom };
}

function getTranslation({ zone, zoom }) {
	const center = new Point(
		((zone.xmin + zone.xmax) * zoom) / 2.0,
		((zone.ymin + zone.ymax) * zoom) / 2.0
	);

	return paper.view.center.subtract(center);
}

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

const computeAndDrawMandelbrotRec = async ({
	depth = 1,
	targetCellSize,
	isDebugging = false,
	level = 0,
	nbIteration,
	threshold,
	token,
	transform: { zoom, translation },
	zone,
}) => {
	const zoneW = (zone.xmax - zone.xmin) * zoom;
	const zoneH = (zone.ymax - zone.ymin) * zoom;
	const levelCellSize = targetCellSize * Math.pow(2, depth - level);
	const nbCellX = Math.trunc(zoneW / levelCellSize) || 1;
	const nbCellY = Math.trunc(zoneH / levelCellSize) || 1;
	const cellW = zoneW / nbCellX;
	const cellH = zoneH / nbCellY;

	if (token.isCancelled) {
		return { cellW, cellH };
	}

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
		const [realCellSize] = await Promise.all(
			splitZone({ zone }).map((zonePart) =>
				computeAndDrawMandelbrotRec({
					depth,
					targetCellSize,
					isDebugging,
					level: level + 1,
					nbIteration,
					threshold,
					token,
					transform: { zoom, translation },
					zone: zonePart,
				})
			)
		);
		if (token.isCancelled) {
			return realCellSize;
		}
		layer.remove();
		return realCellSize;
	}

	return { cellW, cellH };
};

async function computeAndDrawMandelbrot({
	depth,
	targetCellSize,
	isDebugging,
	nbIteration,
	setIsComputing,
	setRealCellSize,
	threshold,
	zone,
	zoom,
}) {
	console.log(paper.view.center);
	JobQueue.append(async ({ token }) => {
		setIsComputing(true);

		paper.project.clear();

		const translation = getTranslation({ zone, zoom });

		const { cellW, cellH } = await computeAndDrawMandelbrotRec({
			depth,
			targetCellSize,
			isDebugging,
			nbIteration,
			setIsComputing,
			setRealCellSize,
			threshold,
			token,
			transform: { zoom, translation },
			zone,
		});

		if (!token.isCancelled || !JobQueue.hasRunningJob()) {
			setRealCellSize({ cellW, cellH });
			setIsComputing(false);
		}
	});
}

function getViewZone({ zone, zoom }) {
	const { bottomRight, topLeft } = paper.view.bounds;

	const center = new Point(
		(zone.xmin + zone.xmax) / 2.0,
		(zone.ymin + zone.ymax) / 2.0
	);

	return {
		xmin: topLeft.x / zoom + center.x,
		ymin: topLeft.y / zoom + center.y,
		xmax: bottomRight.x / zoom + center.x,
		ymax: bottomRight.y / zoom + center.y,
	};
}

function reduceParams(params, newParams) {
	const { zone, zoom, mustCompute } = newParams;

	if (!mustCompute) {
		return { ...params, ...newParams };
	}

	if (zone) {
		const { xmin, ymin, xmax, ymax } = zone;

		const currentCenter = mandelCenter.clone();
		mandelCenter.set(
			new Rectangle({
				from: new Point(xmin, ymin),
				to: new Point(xmax, ymax),
			}).center
		);
		mandelMatrix.translate(mandelCenter.subtract(currentCenter));
	}

	if (zoom) {
		const scale = zoom / params.zoom;
		mandelMatrix.scale(scale, mandelCenter);
	}

	return { ...params, ...newParams };
}

const Sketch = () => {
	const [
		{
			depth,
			targetCellSize,
			isDebugging,
			nbIteration,
			resolution,
			threshold,
			zone,
			zoom,
			mustCompute,
		},
		dispatchParams,
	] = useReducer(reduceParams, {
		depth: 4,
		targetCellSize: 4,
		isDebugging: false,
		nbIteration: 200,
		resolution: "fullview",
		threshold: 2,
		zone: {
			xmin: -2.25,
			xmax: 1.25,
			ymin: -1.5,
			ymax: 1.5,
		},
		zoom: 250,
		mustCompute: false,
	});

	const [realCellSize, setRealCellSize] = useState({
		cellW: 4,
		cellH: 4,
	});
	const [isComputing, setIsComputing] = useState(false);
	const canvasRef = useRef(null);

	// Initialize Sketch
	useEffect(() => {
		// Init Paperjs with canvas
		paper.setup(document.getElementById("mandel-view"));
		paper.view.center = new Point(0, 0);

		// Initiate computing
		dispatchParams({ mustCompute: true });
	}, []);

	// On resize
	useEffect(() => {
		paper.view.onResize = () => {
			dispatchParams({ mustCompute: true });
		};
	});

	// Change resolution
	useEffect(() => {
		if (resolution === "fullview") {
			const { offsetWidth, offsetHeight } = canvasRef.current;
			paper.view.viewSize = new Size(offsetWidth, offsetHeight);
		} else {
			const [width, height] = resolution
				.split("r")[1]
				.split("x")
				.map(Number);
			paper.view.viewSize = new Size(width, height);
		}

		paper.view.center = new Point(0, 0);

		const newZone = getViewZone({ zone, zoom });
		dispatchParams({ zone: newZone, mustCompute: true });
	}, [resolution]);

	// Handle user zone drawing
	useEffect(() => {
		let firstCorner, userLayer;

		paper.view.onMouseDown = async ({ point, event: { button } }) => {
			if (button !== 0) return;

			userLayer = new Layer({});
			// Add the mouse down position
			firstCorner = point;
			JobQueue.cancelPreviousJobs();
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
			const newZone = {
				xmin: (firstCorner.x - translation.x) / zoom,
				ymin: (firstCorner.y - translation.y) / zoom,
				xmax: (secondCorner.x - translation.x) / zoom,
				ymax: (secondCorner.y - translation.y) / zoom,
			};
			// Add the mouse up position:
			dispatchParams({
				zone: newZone,
			});
			// Start computing
			// computeAndDrawMandelbrot({
			// 	depth,
			// 	isDebugging,
			// 	nbIteration,
			// 	setIsComputing,
			// 	setRealCellSize,
			// 	targetCellSize,
			// 	threshold,
			// 	zone: newZone,
			// 	zoom,
			// });
		};
	}, [zone, zoom]);

	useEffect(() => {
		if (mustCompute) {
			computeAndDrawMandelbrot({
				setIsComputing,
				setRealCellSize,
				depth,
				targetCellSize,
				isDebugging,
				nbIteration,
				resolution,
				threshold,
				zone,
				zoom,
			});
			dispatchParams({ mustCompute: false });
		}
	}, [mustCompute]);

	const handleCancel = (params) => {
		dispatchParams(params);
		JobQueue.cancelPreviousJobs();
	};

	const handleWheel = ({ deltaY }) => {
		const deltaZoom = Math.trunc(
			(Math.max(Math.min(deltaY, 100), -100) * zoom) / 500
		);
		const newZoom = zoom - deltaZoom;

		const newZone = getViewZone({ zone, zoom: newZoom });

		dispatchParams({ zoom: newZoom > 1 ? newZoom : 1, zone: newZone });

		// Start computing
		computeAndDrawMandelbrot({
			depth,
			isDebugging,
			nbIteration,
			setIsComputing,
			setRealCellSize,
			targetCellSize,
			threshold,
			zone: newZone,
			zoom: newZoom,
		});
	};

	// re-compute and draw
	const handleChange = (params) => {
		dispatchParams(params);
	};

	return (
		<Layout hasSider>
			<Sider width={300}>
				<ControlPanel
					{...{
						depth,
						targetCellSize,
						isComputing,
						isDebugging,
						nbIteration,
						onCancel: handleCancel,
						onChange: handleChange,
						realCellSize,
						resolution,
						threshold,
						zone,
						zoom,
					}}
				/>
			</Sider>
			<Content className={styles.content}>
				<canvas
					ref={canvasRef}
					className={`${styles.canvas} ${styles[resolution]}`}
					id="mandel-view"
					resize="true"
					onWheel={handleWheel}
				/>
			</Content>
		</Layout>
	);
};

export default Sketch;
