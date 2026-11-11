---
title: durable-execution
description: A durable execution engine for TypeScript tasks and workflows, published to npm as five packages
href: https://github.com/gpahal/durable-execution
---

[durable-execution](https://www.npmjs.com/package/durable-execution) runs TypeScript tasks and workflows so they survive logic failures, process crashes and network errors instead of vanishing with the process that ran them. It's on npm as five MIT-licensed packages, with storage for Convex and Drizzle and [documentation](https://gpahal.github.io/durable-execution) that includes the full state diagram.

## How it works

A task is a single function or a parent that returns child tasks, which run in parallel. An optional `finalize` task receives every child's result, failed ones included, and decides the parent's output. The executor stores each execution and moves it through explicit states: `ready`, `running`, then `completed`, `failed`, `timed_out` or `cancelled`.

Recovery rests on one rule. A running task gets an expiry from its timeout plus some leeway, and a background process resets any task still running past its expiry to `ready`, so a crash loses no state. Tasks must be idempotent, because a task can run more than once.

Sleeping tasks wait for an outside signal, such as a payment webhook or an approval. Cancellation is stored too, so whichever executor is running a task stops it.

The executor runs in the app's process or as its own server. The packages are:

- [durable-execution](https://github.com/gpahal/durable-execution/tree/main/durable-execution), the core engine, built on [Effect](https://effect.website/)
- [durable-execution-storage-convex](https://github.com/gpahal/durable-execution/tree/main/durable-execution-storage-convex), storage on [Convex](https://www.convex.dev/)
- [durable-execution-storage-drizzle](https://github.com/gpahal/durable-execution/tree/main/durable-execution-storage-drizzle), storage on PostgreSQL, MySQL or SQLite through [Drizzle](https://orm.drizzle.team/)
- [durable-execution-storage-test-utils](https://github.com/gpahal/durable-execution/tree/main/durable-execution-storage-test-utils), a test suite for any storage implementation
- [durable-execution-orpc-utils](https://github.com/gpahal/durable-execution/tree/main/durable-execution-orpc-utils), type-safe RPC with [oRPC](https://orpc.unnoq.com/) for running the executor as a server
