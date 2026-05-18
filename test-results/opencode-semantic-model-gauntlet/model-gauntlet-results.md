# OpenCode Model Gauntlet Results

Generated: 2026-05-18T13:16:59.867Z

Runs per model: 1
Recommended threshold: average >= 80, successful runs >= 1, consistency >= 85, hard failures = 0

Provider-infra runs are reported separately and are not counted as model behavior. They still block a Recommended verdict until rerun succeeds.

Scoring weights: launchBootstrap=15, directReply=10, peerRelayAB=15, peerRelayBC=15, concurrentReplies=15, taskRefs=10, cleanTranscript=10, noDuplicateTokens=5, latencyStable=5.

## Model Summary

| Model | Verdict | Confidence | Readiness | Consistency | Score Spread | Behavior Avg | Overall Avg | Counted | Pass Runs | Weakest Stage | Weakest TaskRef | Dominant Failure | Blockers | Provider Infra | Runtime Transport | Model Fails | Protocol Runs | p50 | p95 |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `opencode/big-pickle` | Tested only | low | 54 | 100 | 0 | 35 | 35 | 1/1 | 0/1 | cleanTranscript 0/1 (0%) | directReply 1/1 (100%) | model-behavior | overall average 35 < 80; behavioral average 35 < 80; successful runs 0 < 1; hard failures 1; model-behavior failures 1; highest weighted stage loss concurrentReplies=15 | 0 | 0 | 1 | 0 | 133048ms | 133048ms |

## opencode/big-pickle

Readiness score: 54.

Score stability: consistency=100, min=35, max=35, spread=0, stdDev=0, samples=1.

Recommendation blockers: overall average 35 < 80; behavioral average 35 < 80; successful runs 0 < 1; hard failures 1; model-behavior failures 1; highest weighted stage loss concurrentReplies=15.

Weighted stage impact: concurrentReplies:loss=15, failed=1, pass=0/1 (0%); peerRelayAB:loss=15, failed=1, pass=0/1 (0%); peerRelayBC:loss=15, failed=1, pass=0/1 (0%); cleanTranscript:loss=10, failed=1, pass=0/1 (0%); latencyStable:loss=5, failed=1, pass=0/1 (0%).

Stage pass rates: launchBootstrap:1/1 (100%), directReply:1/1 (100%), peerRelayAB:0/1 (0%), peerRelayBC:0/1 (0%), concurrentReplies:0/1 (0%), taskRefs:1/1 (100%), cleanTranscript:0/1 (0%), noDuplicateTokens:0/1 (0%), latencyStable:0/1 (0%).

TaskRef pass rates: directReply:1/1 (100%), peerRelayAB:n/a, peerRelayBC:n/a, concurrentBob:n/a, concurrentTom:n/a.

Protocol totals: badMessages=0, duplicateOrMissingTokens=0, affectedRuns=0.

| Run | Outcome | Category | Score | Counted | Duration | Failed Stages | Slowest Stage | TaskRefs | Protocol | Diagnostics |
| ---: | --- | --- | ---: | --- | ---: | --- | --- | --- | --- | --- |
| 1 | behavioral-fail | model-behavior | 35 | yes | 133048ms | peerRelayAB, peerRelayBC, concurrentReplies, cleanTranscript, noDuplicateTokens, latencyStable | launchBootstrap:23735ms | directReply:ok | - | Timed out waiting for OpenCode member bob to become idle. Last durableState: reply_pending |

