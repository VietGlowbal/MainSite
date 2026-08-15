# Personal Canvas report UI

This branch reorganises the existing grounded Personal Report around the six-part Personal Canvas product model without replacing the report engine or versioning.

## Page hierarchy

1. Applicant Snapshot
2. Interactive Personal Canvas
3. Sticky section navigation
4. Core Identity
5. Driving Forces
6. Proven Capabilities
7. Social Proof
8. Areas for Growth
9. Long-Term Vision
10. Key Takeaways

## Grounding rule

The UI only reuses findings already present in `PersonalReportV2`. New visual groupings do not create new claims client-side. Areas for Growth is intentionally transitional until dedicated structured growth recommendations are added to the report schema.

## Personal Canvas mapping

- Core Identity: `coreIdentity` + `signaturePattern`
- Driving Forces: `drivingForce`
- Proven Capabilities: report analytics + `personalPositioning`
- Social Proof: `proofOfMe` + evidence analytics
- Areas for Growth: existing recorded limitations only
- Long-Term Vision: `emergingThemes`
