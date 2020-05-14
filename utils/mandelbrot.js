import { add, multiply, dist } from "./complex";

const isInMandelbrot = (complex, nbIterations, threshold) => {
	let mandel = [0, 0];
	for (let i = 0; i < nbIterations; i++) {
		mandel = add(multiply(mandel, mandel), complex);
	}

	if (dist(mandel) > threshold) {
		return false;
	}

	return true;
};

const mandelbrot = (complex, maxIterations, threshold) => {
	let mandel = [0, 0];
	let i;
	for (i = 0; i < maxIterations; i++) {
		mandel = add(multiply(mandel, mandel), complex);
		if (dist(mandel) > threshold) {
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

export { mandelbrotZone, mandelbrot, isInMandelbrot };
