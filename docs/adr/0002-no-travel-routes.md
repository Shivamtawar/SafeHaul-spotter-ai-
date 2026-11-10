# 0002. Routes containing No Travel weather

Status: accepted

## Context
The brief defines a "No Travel" level but does not say how a route that contains one is treated.

## Decision
Such a route stays visible, is ranked after every route without No Travel, and is shown with strict warnings. It is recommended only when every route contains No Travel. Ranking key: `(has_no_travel, no_travel_miles, severe_miles, high_miles, avg_risk, duration)`.

## Consequences
The user always sees all three options and why a route is unsafe. The recommendation never sends a truck through a No Travel zone when an alternative exists.
