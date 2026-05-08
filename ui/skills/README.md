# @qaio-ai/skills

Skills management UI backed by Qaio skill files. Browse installed skills, view details, search and install from the community marketplace.

## Install

```bash
pnpm add @qaio-ai/skills
```

## Usage

```tsx
import { SkillsGrid } from "@qaio-ai/skills"

<SkillsGrid
  skills={installedSkills}
  loading={false}
  onSkillClick={(skill) => navigate(`/skills/${skill.id}`)}
  onSearch={(q) => searchCommunitySkills(q)}
  onInstallCommunity={(skill) => installSkill(skill)}
/>
```

## Exports

- `SkillsGrid` -- main view with installed skill list + optional community section
- `SkillRow` -- single skill row with name, description, icon
- `SkillDetailPage` -- full detail view for a selected skill
- `CommunitySkillsSection` -- search and browse community skills
- `CommunitySkillRow` -- single community skill with install button
- `LearningRow` -- skill learning/memory display
- Types: `Skill`, `CommunitySkill`, `LearningCategory`, `SkillLearning`

## Peer Dependencies

- React 19+
- @qaio-ai/core

---

Part of [Qaio](../../README.md).
