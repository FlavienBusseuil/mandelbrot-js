import { Layout } from "antd";
import paper, { Color, Layer, Path, Point } from "paper";
import React, { useEffect, useReducer, useState } from "react";
import ControlPanel from "../components/ControlPanel";
import { easeOutQuint } from "../utils/easing";
import JobQueue from "../utils/JobQueue";
import { mandelbrotZone } from "../utils/mandelbrot";
import { splitZone } from "../utils/splitZone";
import { wait } from "../utils/wait";
import styles from "./Sketch.module.scss";

const { Sider, Content } = Layout;

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

function getTranslation({ zone, zoom }) {
	const center = new Point(
		((zone.xmin + zone.xmax) * zoom) / 2.0,
		((zone.ymin + zone.ymax) * zoom) / 2.0
	);

	return paper.view.center.subtract(center);
}

const drawMandelbrot = async ({
	points,
	cellW,
	cellH,
	isDebugging = false,
	nbIteration,
	transform: { zoom, translation },
}) => {
	points.forEach(([x, y, i]) => {
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
			strokeColor: isDebugging ? new Color(1, 0, 0, 0.25) : cellColor,
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
	token,
	threshold,
	zone,
	zoom,
}) {
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
}

function reduceParams(params, newParams) {
	return { ...params, ...newParams };
}

const Sketch = () => {
	const [
		{
			depth,
			targetCellSize,
			isDebugging,
			nbIteration,
			threshold,
			zone,
			zoom,
		},
		dispatchParams,
	] = useReducer(reduceParams, {
		depth: 4,
		targetCellSize: 4,
		isDebugging: false,
		nbIteration: 200,
		threshold: 2,
		zone: {
			xmin: -2.25,
			xmax: 1.25,
			ymin: -1.5,
			ymax: 1.5,
		},
		zoom: 250,
	});
	const [realCellSize, setRealCellSize] = useState({
		cellW: 4,
		cellH: 4,
	});
	const [isLoading, setIsLoading] = useState(true);
	const [isComputing, setIsComputing] = useState(false);

	// Initialize UI
	useEffect(() => {
		setIsLoading(false);
	}, []);

	// Initialize Sketch
	useEffect(() => {
		if (isLoading) {
			return;
		}

		// Init Paperjs with canvas
		paper.setup(document.getElementById("mandel-view"));
		// Start computing
		JobQueue.append(({ token }) =>
			computeAndDrawMandelbrot({
				depth,
				isDebugging,
				nbIteration,
				setIsComputing,
				setRealCellSize,
				targetCellSize,
				token,
				threshold,
				zone,
				zoom,
			})
		);
	}, [isLoading]);

	useEffect(() => {
		if (isLoading) {
			return;
		}

		paper.view.onResize = () => {
			JobQueue.append(({ token }) =>
				computeAndDrawMandelbrot({
					depth,
					isDebugging,
					nbIteration,
					setIsComputing,
					setRealCellSize,
					targetCellSize,
					token,
					threshold,
					zone,
					zoom,
				})
			);
		};
	});

	// Handle user zone drawing
	useEffect(() => {
		if (isLoading) {
			return;
		}
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
			JobQueue.append(({ token }) =>
				computeAndDrawMandelbrot({
					depth,
					isDebugging,
					nbIteration,
					setIsComputing,
					setRealCellSize,
					targetCellSize,
					token,
					threshold,
					zone: newZone,
					zoom,
				})
			);
		};
	}, [zone, zoom, isLoading]);

	const handleCancel = () => {
		JobQueue.cancelPreviousJobs();
	};

	const handleWheel = ({ deltaY }) => {
		// JobQueue.cancelPreviousJobs();

		const deltaZoom = Math.trunc(
			(Math.max(Math.min(deltaY, 100), -100) * zoom) / 500
		);
		const newZoom = zoom - deltaZoom;
		dispatchParams({ zoom: newZoom > 1 ? newZoom : 1 });

		// Start computing
		JobQueue.append(({ token }) =>
			computeAndDrawMandelbrot({
				depth,
				isDebugging,
				nbIteration,
				setIsComputing,
				setRealCellSize,
				targetCellSize,
				token,
				threshold,
				zone,
				zoom: newZoom,
			})
		);
	};

	// re-compute and draw
	const handleChange = (params) => {
		dispatchParams(params);

		JobQueue.append(({ token }) =>
			computeAndDrawMandelbrot({
				setIsComputing,
				setRealCellSize,
				token,
				...params,
			})
		);
	};

	return (
		<Layout>
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
						threshold,
						zone,
						zoom,
					}}
				/>
			</Sider>
			<Content>
				<canvas
					className={styles.canvas}
					id="mandel-view"
					resize="true"
					onWheel={handleWheel}
				/>
			</Content>
		</Layout>
	);
};

export default Sketch;
