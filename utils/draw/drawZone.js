import { Color, Path, Point } from "paper";

export function drawZone({ zone, transform: { zoom, translation } }) {
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
