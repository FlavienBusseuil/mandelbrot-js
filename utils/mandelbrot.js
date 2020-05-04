import { add, multiply, dist } from "./complex";

const isInMandelbrot = (complex, nbIterations, threshold = 20) => {
  let mandel = [0, 0];
  for (let i = 0; i < nbIterations; i++) {
    mandel = add(multiply(mandel, mandel), complex);
  }

  if (dist(mandel) > threshold) {
    return false;
  }

  return true;
};

const mandelbrot = (complex, maxIterations, threshold = 4) => {
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

export { mandelbrot, isInMandelbrot };
