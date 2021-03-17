const add = (c1, c2) => [c1[0] + c2[0], c1[1] + c2[1]];

const multiply = (c1, c2) => [
	c1[0] * c2[0] - c1[1] * c2[1],
	c1[0] * c2[1] + c1[1] * c2[0],
];

const distSquare = (c1) => c1[0] * c1[0] + c1[1] * c1[1];

const mandelbrot = (complex, maxIterations, threshold) => {
	let mandel = [0, 0];
	let i;
	for (i = 0; i < maxIterations; i++) {
		mandel = add(multiply(mandel, mandel), complex);
		if (distSquare(mandel) > threshold * threshold) {
			break;
		}
	}

	return i;
};

const mandelbrotZone = async ({
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

onmessage = async function ({
	data: { nbStepX, nbStepY, zone, nbIteration, threshold },
}) {
	const points = await mandelbrotZone({
		nbStepX,
		nbStepY,
		zone,
		nbIteration,
		threshold,
	});
	postMessage(points);
};
