import activity from "./activity.schema.json";
import routines from "./routines.schema.json";
import routine_runs from "./routine_runs.schema.json";
import config from "./config.schema.json";
import learnings from "./learnings.schema.json";
import knowledge_base from "./knowledge_base.schema.json";

export const schemas = {
  activity,
  routines,
  routine_runs,
  config,
  learnings,
  knowledge_base,
} as const;

export { activity, routines, routine_runs, config, learnings, knowledge_base };

export type SchemaName = keyof typeof schemas;
