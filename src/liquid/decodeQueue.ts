/**
 * Decoding a photo is one blocking call of tens of milliseconds (a
 * 1080×810 JPEG takes 20–45 ms on an Android emulator). Mounting a window
 * of pages, or swiping fast, asks for several at once; decoding them
 * back to back would hold the JS thread for hundreds of milliseconds, and
 * every callback, render and request of the app would wait behind them.
 *
 * The queue decodes one image per task, the most urgent first
 * (the page in view, then its neighbors, then the rest), and drops the
 * requests nobody waits for any more (a page that scrolled out of the
 * window before its turn). Between two decodes, the tasks already waiting
 * (callbacks, renders, responses) run first.
 *
 * The encoded bytes are loaded as soon as an image is requested (that is
 * asynchronous, off the JS thread); only the decode itself waits its turn.
 */

export type DecodePriority = 'high' | 'normal' | 'low';

const RANK: Record<DecodePriority, number> = { high: 0, normal: 1, low: 2 };

export type DecodeQueueDeps<D, I> = {
  /** Reads the encoded bytes. */
  load: (key: string) => Promise<D>;
  /** Decodes them. Synchronous and slow: this is what the queue spreads out. */
  decode: (data: D) => I | null;
  /** Runs `fn` as a new task, after the tasks already queued (setTimeout 0). */
  schedule: (fn: () => void) => void;
};

export type DecodeRequest = {
  setPriority(priority: DecodePriority): void;
  cancel(): void;
  readonly key: string;
};

type Waiter<I> = { rank: number; done: (image: I) => void };

type Job<D, I> = {
  key: string;
  seq: number;
  data: D | null;
  waiters: Set<Waiter<I>>;
};

export function createDecodeQueue<D, I>(deps: DecodeQueueDeps<D, I>) {
  const jobs = new Map<string, Job<D, I>>();
  let scheduled = false;
  let seq = 0;

  const rankOf = (job: Job<D, I>) => {
    let r = Infinity;
    for (const w of job.waiters) r = Math.min(r, w.rank);
    return r;
  };

  const next = () => {
    let best: Job<D, I> | null = null;
    let bestRank = Infinity;
    for (const job of jobs.values()) {
      if (job.data === null) continue;
      const r = rankOf(job);
      if (r < bestRank || (r === bestRank && best && job.seq < best.seq)) {
        best = job;
        bestRank = r;
      }
    }
    return best;
  };

  const kick = () => {
    if (scheduled || !next()) return;
    scheduled = true;
    deps.schedule(pump);
  };

  function pump() {
    scheduled = false;
    const job = next();
    if (!job) return;
    jobs.delete(job.key);
    let image: I | null = null;
    try {
      image = deps.decode(job.data!);
    } catch {
      image = null;
    }
    if (image !== null) for (const w of job.waiters) w.done(image);
    kick();
  }

  return {
    /**
     * Asks for `key` to be decoded; `done` is called once with the image
     * (not at all if it cannot be loaded or decoded, or after `cancel`).
     * Requests for the same key share one load and one decode.
     */
    request(key: string, priority: DecodePriority, done: (image: I) => void): DecodeRequest {
      let job = jobs.get(key);
      if (!job) {
        const created: Job<D, I> = { key, seq: seq++, data: null, waiters: new Set() };
        job = created;
        jobs.set(key, created);
        deps.load(key).then(
          (data) => {
            if (jobs.get(key) !== created) return; // cancelled meanwhile
            created.data = data;
            kick();
          },
          () => {
            if (jobs.get(key) === created) jobs.delete(key);
          },
        );
      }
      const waiter: Waiter<I> = { rank: RANK[priority], done };
      job.waiters.add(waiter);
      const owner = job;
      return {
        key,
        setPriority(p) {
          waiter.rank = RANK[p];
        },
        cancel() {
          owner.waiters.delete(waiter);
          if (owner.waiters.size === 0 && jobs.get(key) === owner) jobs.delete(key);
        },
      };
    },
    /** Images waiting: loading or loaded and not yet decoded. */
    get size() {
      return jobs.size;
    },
  };
}
