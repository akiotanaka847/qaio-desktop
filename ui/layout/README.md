# @qaio-ai/layout

App-level layout primitives. Sidebar for navigation, tab bar for view switching, split view for panels.

## Install

```bash
pnpm add @qaio-ai/layout
```

## Usage

```tsx
import { AppSidebar, TabBar, SplitView } from "@qaio-ai/layout"
import "@qaio-ai/layout/src/styles.css"

<AppSidebar
  logo={<Logo />}
  items={projects}
  selectedId={activeId}
  onSelect={setActiveId}
  onAdd={createProject}
  labels={{
    addItem: "Add project",
    moreOptions: "Project options",
    renameItem: "Rename",
    deleteItem: "Delete",
  }}
/>

<TabBar
  tabs={[
    { id: "board", label: "Board" },
    { id: "chat", label: "Chat", badge: 2 },
  ]}
  activeTab={currentTab}
  onTabChange={setCurrentTab}
/>
```

## Exports

- `AppSidebar` -- project/chat list sidebar with logo, add, delete, keyboard shortcuts, and optional labels for app-level i18n
- `TabBar` -- horizontal tab strip with badges and action slots
- `SplitView` -- two-pane layout with resizable divider
- `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` -- lower-level resizable primitives

## Peer Dependencies

- React 19+
- @qaio-ai/core

---

Part of [Qaio](../../README.md).
