---
title: durable-execution
description: A durable execution engine for TypeScript tasks and workflows, published to npm as five packages
href: https://github.com/gpahal/durable-execution
---

## The result

[durable-execution](https://www.npmjs.com/package/durable-execution) runs TypeScript tasks and workflows so they survive logic failures, process crashes and network errors. A task can be a single function or a tree of parent and child tasks. It's published to npm as five packages, with storage for Convex and Drizzle and [documentation](https://gpahal.github.io/durable-execution).

## Why build it

A multi-step task that fails partway through should retry or resume, not vanish with the process that ran it. Because tasks here survive crashes and transient errors, the engine is a good fit for AI workflows.

## How it works

The executor stores every task execution and moves it through explicit states, from `ready` and `running` to `completed`, `failed`, `timed_out` or `cancelled`. A parent task runs and returns children, which run in parallel. An optional `finalize` task then receives every child's result, failed ones included, and decides the parent's output.

Recovery rests on one rule. When a task starts running, it gets an expiry time from its timeout plus some leeway. A background process resets any task still running past its expiry to `ready`, so a crashed process loses no task state. Tasks must be idempotent, because a task can run more than once.

Sleeping tasks wait for an outside signal, such as a webhook from a payment provider or an approval, and are woken with an output. Cancellation is stored too, so when several executors share one storage, whichever one is running the task stops it.

The executor can run in the same process as the app or as a separate server. The five packages are:

- [durable-execution](https://github.com/gpahal/durable-execution/tree/main/durable-execution), the core engine, built on [Effect](https://effect.website/)
- [durable-execution-storage-convex](https://github.com/gpahal/durable-execution/tree/main/durable-execution-storage-convex), storage on [Convex](https://www.convex.dev/)
- [durable-execution-storage-drizzle](https://github.com/gpahal/durable-execution/tree/main/durable-execution-storage-drizzle), storage on PostgreSQL, MySQL or SQLite through [Drizzle](https://orm.drizzle.team/)
- [durable-execution-storage-test-utils](https://github.com/gpahal/durable-execution/tree/main/durable-execution-storage-test-utils), a test suite any storage implementation can run against
- [durable-execution-orpc-utils](https://github.com/gpahal/durable-execution/tree/main/durable-execution-orpc-utils), type-safe RPC with [oRPC](https://orpc.unnoq.com/) for running the executor as its own server

## Outcome

All five packages are on npm under the MIT licence. The [documentation](https://gpahal.github.io/durable-execution) covers the task options, error handling, production tips and a design section with the full state diagram.
