export default class WorkerCrew {
	static i = 0;
	static idleWorkers = new Array(8).fill().map(() => new Worker("worker.js"));
	static allWorkers = [...this.idleWorkers];
	static jobQueue = [];
	static terminated = false;

	static async work(data) {
		this.terminated = false;
		if (this.idleWorkers.length > 0) {
			const worker = this.idleWorkers.pop();
			const results = await new Promise((resolve) => {
				worker.onmessage = (result) => {
					resolve(this.terminated ? [] : result.data);
				};
				worker.postMessage(data);
			});

			this.idleWorkers.push(worker);

			// Empty the queue
			if (this.jobQueue.length) {
				const job = this.jobQueue.shift();
				job.resolve(this.work(job.data));
			}

			return results;
		} else {
			return new Promise((resolve) => {
				this.jobQueue.push({ data, resolve });
			});
		}
	}

	static terminate() {
		this.jobQueue.forEach((job) => job.resolve([]));
		this.jobQueue = [];
		this.terminated = true;
	}
}
