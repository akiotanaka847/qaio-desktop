import type { SkillInvocation } from "./skill-message.ts";
import { decodeSkillMessage } from "./skill-message.ts";
import { decodeAttachmentMessage } from "./attachment-message.ts";

/**
 * The text a Copy action should place on the clipboard for one message.
 *
 * User messages are not persisted as what the user typed. A Skill or an
 * upload is stored as an HTML-comment marker carrying the structured
 * payload the renderer needs, followed by a model-facing body that
 * repeats absolute file paths and phrasing like "Use the <skill> skill."
 * None of that is on screen, so copying the raw content would hand the
 * user machine scaffolding instead of their own words.
 *
 * The rule is to copy what the message *shows*: for a Skill, the card's
 * name, the fields they filled, and anything they typed; for an upload,
 * only their text, since `AttachmentInvocation` documents its paths as
 * decodeable but deliberately unrendered. Assistant messages are already
 * plain markdown and pass through untouched.
 */
export function messageCopyText(content: string): string {
  const skill = decodeSkillMessage(content);
  if (skill) return skillCopyText(skill);

  const attachment = decodeAttachmentMessage(content);
  if (attachment) return attachment.message.trim();

  return content.trim();
}

function skillCopyText(skill: SkillInvocation): string {
  const lines: string[] = [skill.displayName];

  for (const field of skill.fields) {
    const value = field.value.trim();
    if (value) lines.push(`${field.label}: ${value}`);
  }

  const message = skill.message.trim();
  if (message) lines.push("", message);

  return lines.join("\n");
}
