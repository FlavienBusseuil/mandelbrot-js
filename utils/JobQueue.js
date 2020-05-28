import CancellationToken from "cancellationtoken";

export default class JobQueue {
	static jobs = [];
	static queueTreated = false;
	static async append(job) {
		JobQueue.cancelPreviousJobs();
		const { token, cancel } = CancellationToken.create();
		JobQueue.jobs.push([job, { token, cancel }]);
		job({ token });
	}
	static cancelPreviousJobs() {
		JobQueue.jobs.forEach(([, { cancel }]) => cancel());
		JobQueue.jobs = [];
	}
	static hasRunningJob() {
		return JobQueue.jobs.some(([, token]) => !token.isCancelled);
	}
}
