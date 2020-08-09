import { Layout } from "antd";
import paper, { Layer, Point, Size, Matrix, Rectangle } from "paper";
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
const initialCoord = {
	zoom: 1,
	zone: { xmin: 0, ymin: 0, xmax: 0, ymax: 0 },
};

function toMandelView({ x, y }) {
	return mandelMatrix.inverseTransform(new Point(x, y));
}

function toPaperView({ x, y }) {
	return mandelMatrix.transform(new Point(x, y));
}

function getTranslation() {
	return mandelMatrix.translation;
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
	JobQueue.append(async ({ token }) => {
		setIsComputing(true);

		paper.project.clear();

		const translation = getTranslation();

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

function getMandelViewZone() {
	const { bottomRight, topLeft } = paper.view.bounds;

	const { x: xmin, y: ymin } = toMandelView(topLeft);
	const { x: xmax, y: ymax } = toMandelView(bottomRight);

	return { xmin, ymin, xmax, ymax };
}

function updateMandelMatrix(
	{ zoom: newZoom, zone: newZone },
	{ zoom: oldZoom, zone: oldZone } = initialCoord
) {
	if (newZone) {
		const { xmin, ymin, xmax, ymax } = newZone;
		if (
			xmax !== oldZone.xmax ||
			ymax !== oldZone.ymax ||
			xmin !== oldZone.xmin ||
			ymin !== oldZone.ymin
		) {
			const currentCenter = mandelCenter.clone();
			mandelCenter.set(
				new Rectangle({
					from: new Point(xmin, ymin),
					to: new Point(xmax, ymax),
				}).center
			);
			mandelMatrix.translate(mandelCenter.subtract(currentCenter));
		}
	}

	if (newZoom) {
		const scale = newZoom / oldZoom;
		mandelMatrix.scale(scale, mandelCenter);
	}
}

function initParams(params) {
	const { zone, zoom } = params;
	updateMandelMatrix({ zone, zoom });
	return { ...params };
}

function reduceParams(params, newParams) {
	const { zoom, mustCompute } = newParams;

	if (!mustCompute) {
		return { ...params, ...newParams };
	}

	// if zoom changed reframe zone
	if (zoom) {
		const scale = zoom / params.zoom;
		mandelMatrix.scale(scale, mandelCenter);

		const newZone = getMandelViewZone();
		return { ...params, ...newParams, zone: newZone };
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
	] = useReducer(
		reduceParams,
		{
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
		},
		initParams
	);

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
	}, []);

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

		const newZone = getMandelViewZone();
		dispatchParams({ zone: newZone, mustCompute: true });
	}, [resolution]);

	useEffect(() => {
		paper.view.onMouseDown = async ({ event: { button } }) => {
			if (button !== 0) return;

			JobQueue.cancelPreviousJobs();
		};
		paper.view.onMouseDrag = ({ point, delta }) => {
			JobQueue.cancelPreviousJobs();
			const pointInMandelView = toMandelView(point);
			const previewsPointInMandelView = toMandelView({
				x: point.x - delta.x,
				y: point.y - delta.y,
			});
			const translation = pointInMandelView.subtract(
				previewsPointInMandelView
			);
			mandelMatrix.translate(translation);
			mandelCenter.set(mandelCenter.subtract(translation));

			const newZone = getMandelViewZone();
			dispatchParams({ zone: newZone, mustCompute: true });
		};
		paper.view.onMouseUp = () => {};
	}, []);

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

		dispatchParams({
			zoom: newZoom > 1 ? newZoom : 1,
			mustCompute: true,
		});
	};

	// re-compute and draw
	const handleChange = (params) => {
		dispatchParams({ ...params, mustCompute: true });
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
