# Client Workflow — The Run-Control Layer

## The Problem

Early agent runs on this infrastructure fell into re-assessment loops: a run would re-evaluate its own plan, revise it, re-evaluate again, and fail to converge on finished work. That's a different failure mode from the operational concerns the workflow runner already handled (concurrent execution, resuming after a turn limit) — it's not about a run crashing or stalling, it's about a run that keeps running without making forward progress.

That gap is what the run-control layer was built to close, and it now sits permanently on top of the orchestration setup for this client, not as a one-off fix.

---

## The Mechanisms

At a high level, three mechanisms constrain how an agent run is allowed to proceed:

- **Locked plans** — once a run's plan is committed, it stays fixed for that run rather than being open to continuous revision mid-execution.
- **Retry caps** — a run has a bounded number of attempts at a given step, rather than an open-ended ability to keep re-trying.
- **Human approval gates** — certain points in a run require an explicit human sign-off before the agent is allowed to continue.

Together, these keep an agent run from drifting into the re-assessment pattern that prompted building this layer in the first place.

---

## Relationship to the Workflow Runner

It's worth being precise about what this layer is and isn't. The `run-lockbox-workflow.sh` script described in [Skills & Workflow Tooling](/projects/RufloOrchestration/workflow/skills-and-tooling) is a separate, earlier mechanism — it solves concurrency (PID locking), resumability (auto-resume on max-turns), and observability (status JSON) for headless multi-pass runs. It is not the run-control layer itself, and the two shouldn't be conflated: the workflow runner governs *how a run executes mechanically*, while the run-control layer governs *whether and how a run is allowed to keep proceeding* toward its goal.

This page intentionally stays at a high level. The run-control layer is described here at the same level of detail as the rest of this operator's account of the engagement — what problem it solves and what the three mechanisms are — rather than as a specification of its exact implementation.
