import { Color, Path, Point } from "paper";
import { easeOutQuint } from "./easing";

export async function drawMandelbrot({
	points,
	cellW,
	cellH,
	isDebugging = false,
	nbIteration,
	transform: { zoom, translation },
}) {
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
}
