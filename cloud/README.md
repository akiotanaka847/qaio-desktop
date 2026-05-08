# Qaio Cloud

Managed deployment service for Qaio Engine. We run it for you.

## What it is
Dev builds a product on Qaio Engine. Doesn't want to run infra. Pushes to Qaio Cloud. Cloud provisions + monitors + bills. Dev focuses on agents.

## Status
**TBD — placeholder.** Directory exists to reserve the name. No code yet.

## Relation to other products
- Hosts **Qaio Engine** instances for third-party devs
- Always On + Teams could run on Cloud (dogfooding) OR on separate infra
- This is the **revenue engine** for Qaio as a company

## Unknowns to solve
- Multi-tenant isolation strategy (VM per customer? container per customer?)
- Pricing model (per request, per agent, per compute-hour?)
- Custom branding — customer apps need own domain + branding (whitelabeling)
- SLA + support tiers
- Self-service signup vs sales-led onboarding
- Engine plugin/extension model — how custom code ships alongside managed Engine
