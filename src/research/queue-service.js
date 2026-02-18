/**
 * Research Queue Service — In-process orchestrator for the deep research pipeline.
 *
 * Manages job submission, pipeline stage orchestration (decomposition -> retrieval ->
 * scoring -> synthesis), concurrency control, and progress event emission.
 */

const TERMINAL_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"]);

class ResearchQueueService {
  constructor({
    manager,
    decompositionWorker,
    retrievalWorker,
    scoringWorker,
    synthesisWorker,
    eventBus,
    maxConcurrency = 3,
  }) {
    this.manager = manager;
    this.decomposition = decompositionWorker;
    this.retrieval = retrievalWorker;
    this.scoring = scoringWorker;
    this.synthesis = synthesisWorker;
    this.eventBus = eventBus;
    this.maxConcurrency = maxConcurrency;

    this._queue = [];
    this._activeCount = 0;
  }

  get queueLength() {
    return this._queue.length;
  }

  async submitJob({ userId, query, ttl, metadata, agentId }) {
    const job = this.manager.createJob({ userId, query, ttl, metadata, agentId });
    this.eventBus.emit("research:queued", job);

    this._queue.push(job.id);
    this._drainQueue();

    return job;
  }

  _isCancelled(jobId) {
    const job = this.manager.getJob(jobId);
    return !job || TERMINAL_STATUSES.has(job.status);
  }

  async processJob(jobId) {
    const job = this.manager.getJob(jobId);
    if (!job) return;

    try {
      // Stage 1: Decomposition
      this.manager.updateStatus(jobId, "PROCESSING");
      this._emitProgress(jobId, "decomposition", 0);

      const subQuestions = await this.decomposition.execute(job.query);
      this.manager.setQueryDecomposition(jobId, subQuestions);
      this._emitProgress(jobId, "decomposition", 100);

      if (this._isCancelled(jobId)) return;

      // Stage 2: Retrieval — use job's agent_id for RAG search, fall back to jobId
      this._emitProgress(jobId, "retrieval", 0);
      const ragAgentId = job.agent_id || jobId;
      const sources = await this.retrieval.execute(subQuestions, ragAgentId);
      this._emitProgress(jobId, "retrieval", 100);

      if (this._isCancelled(jobId)) return;

      // Stage 3: Scoring
      this._emitProgress(jobId, "scoring", 0);
      const scoringResult = await this.scoring.execute(sources, job.query);
      this._emitProgress(jobId, "scoring", 100);

      if (this._isCancelled(jobId)) return;

      // Save sources to DB
      for (const source of scoringResult.scoredSources) {
        this.manager.addSource({
          jobId,
          url: source.url || "",
          title: source.title || "",
          contentPreview: (source.text || "").slice(0, 500),
          domainAuthority: source.domainAuthority,
          recencyScore: source.recencyScore,
          relevanceScore: source.relevanceScore,
          credibilityTier: source.credibilityTier,
          compositeScore: source.composite,
          retrievalMethod: source.retrievalMethod,
        });
      }

      // Stage 4: Synthesis
      this._emitProgress(jobId, "synthesis", 0);
      const synthesisResult = await this.synthesis.execute({
        query: job.query,
        scoredSources: scoringResult.scoredSources,
        scoredClaims: scoringResult.scoredClaims,
        jobConfidence: scoringResult.jobConfidence,
      });
      this._emitProgress(jobId, "synthesis", 100);

      // Save result and complete
      const resultId = this.manager.saveResult({
        jobId,
        synthesis: synthesisResult.synthesis,
        sources: scoringResult.scoredSources,
        claims: scoringResult.scoredClaims,
        evidenceSet: sources,
        tokenUsage: synthesisResult.tokenUsage || {},
      });

      this.manager.completeJob(jobId, {
        resultId,
        confidenceScore: scoringResult.jobConfidence.confidence,
        sourceCount: scoringResult.jobConfidence.sourceCount,
        hasContradictions: scoringResult.jobConfidence.hasContradictions,
      });

      this.eventBus.emit("research:completed", {
        jobId,
        confidenceScore: scoringResult.jobConfidence.confidence,
      });
    } catch (error) {
      this.manager.failJob(jobId, error.message);
      this.eventBus.emit("research:failed", {
        jobId,
        error: error.message,
      });
    }
  }

  async cancelJob(jobId) {
    const job = this.manager.getJob(jobId);
    if (!job || TERMINAL_STATUSES.has(job.status)) return false;

    this.manager.updateStatus(jobId, "CANCELLED");
    this._queue = this._queue.filter((id) => id !== jobId);
    this.eventBus.emit("research:cancelled", { jobId });
    return true;
  }

  getQueueSummary() {
    return this.manager.getQueueSummary();
  }

  _emitProgress(jobId, stage, progress) {
    this.manager.updateStageProgress(jobId, stage, progress);
    this.eventBus.emit("research:progress", { jobId, stage, progress });
  }

  _drainQueue() {
    while (this._activeCount < this.maxConcurrency && this._queue.length > 0) {
      const jobId = this._queue.shift();
      this._activeCount++;
      this.processJob(jobId).finally(() => {
        this._activeCount--;
        this._drainQueue();
      });
    }
  }
}

module.exports = { ResearchQueueService };
