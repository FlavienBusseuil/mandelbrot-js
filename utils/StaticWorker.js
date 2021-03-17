export default class StaticWorker {
	static async work(data) {
		const worker = new Worker("worker.js");
		worker.postMessage(data);
		return new Promise((resolve) => {
			worker.onmessage = ({ data }) => {
				resolve(data);
				worker.terminate();
			};
		});
	}
}
