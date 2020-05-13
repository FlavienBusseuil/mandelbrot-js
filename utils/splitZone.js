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

export { splitZone };
