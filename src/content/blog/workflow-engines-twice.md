---
title: What I learnt building workflow engines twice
description: I built the workflow engine under Harness's products and later durable-execution, an open-source durable execution engine for TypeScript, and a few lessons carried over
publishedOn: 25/08/2025
tags: [programming, typescript, workflows]
---

I have built a workflow engine twice. The first ran under every product at [Harness](https://www.harness.io). The second is [durable-execution](https://github.com/gpahal/durable-execution), an open-source engine for TypeScript, now five packages on npm.

## Harness

I joined Harness as a founding software engineer and designed and built the workflow execution engine under its CD, CI, Feature Flags and Cloud Cost Management products. It runs durable workflows that last weeks. While I was there, revenue grew 50x and Harness went from one product to six.

## durable-execution

durable-execution runs tasks durably, from a single function to a multi-step workflow, so they survive logic failures, process crashes and network errors.

Temporal needs its own cluster and Inngest is a hosted service. I wanted a library that runs inside a TypeScript app and keeps its state in the database I already use, Convex or SQL through Drizzle.

A task is a function with an id and a timeout. A parent task returns its own output and a list of children, which run in parallel. This example is from the README:

```ts
const taskA = executor.task({
  id: 'a',
  timeoutMs: 1000,
  run: (ctx, input: { name: string }) => {
    return `Hello from task A, ${input.name}!`
  },
})
const taskB = executor.task({
  id: 'b',
  timeoutMs: 1000,
  run: (ctx, input: { name: string }) => {
    return `Hello from task B, ${input.name}!`
  },
})

const parentTask = executor.parentTask({
  id: 'parent',
  timeoutMs: 1000,
  runParent: (ctx, input: { name: string }) => {
    return {
      output: `Hello from parent task, ${input.name}!`,
      children: [childTask(taskA, { name: input.name }), childTask(taskB, { name: input.name })],
    }
  },
})
```

Tasks also get retries with backoff, cancellation and sleeping tasks that wait for a webhook or event. The executor runs embedded in your app, or as a separate server your app calls over [oRPC](https://orpc.unnoq.com/).

State lives in a storage implementation. Two packages provide one:

- [durable-execution-storage-drizzle](https://github.com/gpahal/durable-execution/tree/main/durable-execution-storage-drizzle) uses [Drizzle ORM](https://orm.drizzle.team/) with PostgreSQL, MySQL or SQLite
- [durable-execution-storage-convex](https://github.com/gpahal/durable-execution/tree/main/durable-execution-storage-convex) runs as a [Convex](https://www.convex.dev/) component

The main package also includes an in-memory storage for tests and simple cases. I use durable-execution mostly as the orchestration layer for my personal agents.

## Lessons that carried over

**Every step can run more than once.** A task runs again when its process fails or when it is retried. So tasks have to be idempotent, and the docs say so first.

**State belongs in storage, not in the process.** A running task gets an expiry of its timeout plus some leeway. If the process dies, a background job finds the expired task and marks it ready again. Several executors can share one storage, and a cancellation reaches whichever one is running the task.

**A tree of tasks covers most workflows.** Parents with parallel children, plus an optional finalize step that combines their results, are the core. Sequential, looping and recursive tasks can all be built from them.

## Resources

- [durable-execution](https://github.com/gpahal/durable-execution), the code and packages
- [Documentation](https://gpahal.github.io/durable-execution), the API reference
- [Design](https://github.com/gpahal/durable-execution/blob/main/durable-execution/README.md#design), on task states, closure, cancellation and recovery
- [Work](/work), for more on my time at Harness
