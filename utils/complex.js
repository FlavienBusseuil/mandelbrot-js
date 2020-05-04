const add = (c1, c2) => [c1[0] + c2[0], c1[1] + c2[1]];

const multiply = (c1, c2) => [
  c1[0] * c2[0] - c1[1] * c2[1],
  c1[0] * c2[1] + c1[1] * c2[0]
];

const dist = c1 => Math.sqrt(c1[0] * c1[0] + c1[1] * c1[1]);

export { add, multiply, dist };
