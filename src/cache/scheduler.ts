/**
 * Download queue with priorities and a concurrency limit.
 *
 * The carousel asks for the current page's image at `high`, its neighbors at
 * `normal`, and pages further away, prefetches and background revalidations
 * at `low`. With a limit of a few parallel downloads, the image the user is
 * looking at never waits behind a prefetch, and a fast swipe re-ranks what is
 * still queued (`bump`).
 *
 * Pure TypeScript, unit tested with Node.
 */

export type LoadPriority = 'high' | 'normal' | 'low';

const RANK: Record<LoadPriority, number> = { high: 0, normal: 1, low: 2 };

type Job = {
  key: string;
  rank: number;
  seq: number;
  start: () => void;
};

export class Scheduler {
  private queue: Job[] = [];
  private active = 0;
  private seq = 0;
  private limit: number;
  private onChange?: () => void;

  constructor(limit = 4, onChange?: () => void) {
    this.limit = Math.max(1, limit);
    this.onChange = onChange;
  }

  setLimit(limit: number) {
    this.limit = Math.max(1, limit);
    this.drain();
  }

  /** Runs `task` when a slot is free, highest priority first, first come first served within a priority. */
  run<T>(key: string, priority: LoadPriority, task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        key,
        rank: RANK[priority],
        seq: this.seq++,
        start: () => {
          this.active++;
          this.onChange?.();
          task()
            .then(resolve, reject)
            .finally(() => {
              this.active--;
              this.onChange?.();
              this.drain();
            });
        },
      });
      this.drain();
    });
  }

  /** Raise a queued job's priority (never lowers it). No effect once it has started. */
  bump(key: string, priority: LoadPriority) {
    const rank = RANK[priority];
    let changed = false;
    for (const job of this.queue) {
      if (job.key === key && rank < job.rank) {
        job.rank = rank;
        changed = true;
      }
    }
    if (changed) this.onChange?.();
  }

  counts() {
    return { active: this.active, queued: this.queue.length };
  }

  private drain() {
    while (this.active < this.limit && this.queue.length > 0) {
      let best = 0;
      for (let i = 1; i < this.queue.length; i++) {
        const a = this.queue[i];
        const b = this.queue[best];
        if (a.rank < b.rank || (a.rank === b.rank && a.seq < b.seq)) best = i;
      }
      const [job] = this.queue.splice(best, 1);
      job.start();
    }
    this.onChange?.();
  }
}
