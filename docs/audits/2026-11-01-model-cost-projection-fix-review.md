# Task 3 fix review — `b317342..f68f195`

**I1 ADDRESSED. Fix-diff findings: C 0 / I 0 / M 0.**

The revised `checkedUsage` rejects either known cache counter when it exceeds known total input, regardless of whether the other cache counter is missing. It retains the combined-count check when both are known. `estimateProjection` now validates known usage in every group before skipping zero-call pricing. The original `calls: 0`/all-null-usage case still returns an explicit zero because it represents no attempts. Focused tests cover both cache directions and zero-call invalid usage. No new breakage is apparent in the scoped diff.

The appended report records two expected focused RED failures, eight focused GREEN tests, and passing lint/typecheck. These are reported results, not independently rerun here. The full suite, build, dependency audit, offline CLI, source tree, branch/index, database, network, provider, credentials, and environment were outside this re-review. The broader Task 3 evaluation and clinical/transport boundaries remain as stated in the initial review; no new conclusion is drawn about them.
