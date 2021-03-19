export default class WorkerCrew {
	static i = 0;
	static idleWorkers = new Array(8).fill().map(() => new Worker("worker.js"));
	static jobQueue = [];

	static async work(data) {
		if (this.idleWorkers.length > 0) {
			const worker = this.idleWorkers.pop();
			const results = await new Promise((resolve) => {
				worker.onmessage = (result) => {
					resolve(result.data);
				};
				worker.postMessage(data);
			});

			this.idleWorkers.push(worker);

			// Empty the queue
			if (this.jobQueue.length) {
				const job = this.jobQueue.pop();
				job.resolve(await this.work(job.data));
			}

			return results;
		} else {
			return new Promise((resolve) => {
				this.jobQueue.push({ data, resolve });
			});
		}
	}
}
