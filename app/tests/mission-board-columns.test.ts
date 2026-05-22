import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { buildMissionBoardColumns } from "../src/components/mission-board-columns.ts";

describe("mission board columns", () => {
  it("wires new mission only to the backlog column", () => {
    const openNewMission = () => {};
    const columns = buildMissionBoardColumns(
      {
        backlog: "Backlog",
        inProgress: "In Progress",
        review: "Review",
        done: "Done",
        newMission: "New mission",
      },
      openNewMission,
    );

    deepStrictEqual(
      columns.map((column) => ({
        id: column.id,
        label: column.label,
        statuses: column.statuses,
      })),
      [
        { id: "backlog", label: "Backlog", statuses: ["requirements"] },
        {
          id: "in_progress",
          label: "In Progress",
          statuses: ["running", "planning", "implementing", "testing", "review_plan", "review_impl"],
        },
        {
          id: "review",
          label: "Review",
          statuses: ["needs_you", "needs_plan_approval", "needs_impl_approval"],
        },
        { id: "done", label: "Done", statuses: ["done", "cancelled"] },
      ],
    );
    strictEqual(columns[0].onAdd, openNewMission);
    strictEqual(columns[0].addLabel, "New mission");
    strictEqual(columns[1].onAdd, undefined);
    strictEqual(columns[2].onAdd, undefined);
    strictEqual(columns[3].onAdd, undefined);
  });
});
