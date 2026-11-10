# 0003. Threshold boundaries and miles

Status: accepted

## Context
The risk table's ranges overlap at their edges (for example rain 0.10–0.25 and 0.25–0.50).

## Decision
Lower bounds are inclusive. The top bands follow the brief literally: rain Severe is 0.50–1.00 inclusive and No Travel is above 1.00; snow Severe is 2.0–3.0 inclusive and No Travel is above 3.0. Each checkpoint stands for the road halfway to its neighbours, and Severe/High miles are the sum of those stretches. Wind uses sustained speed (`wind_speed_10m`), not gusts.

## Consequences
Every value maps to exactly one level, and the rules are covered by boundary tests.
