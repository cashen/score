import { DurableObject } from "cloudflare:workers";
import { sortExamsChronologically } from "./lib/model.js";

const MAX_EXAMS = 80;

function indexKey(studentId, trash = false) {
  return (trash ? "exam-trash-index" : "exam-index") + ":" + studentId;
}

function bounded(items) {
  return sortExamsChronologically(
    (Array.isArray(items) ? items : []).filter((item) => item && item.id)
  ).slice(0, MAX_EXAMS);
}

/**
 * Per-student write coordinator for exam indexes.
 * Durable Object request serialization prevents concurrent KV read-modify-write
 * operations from losing one another. KV remains the durable read store.
 */
export class StudentIndexCoordinator extends DurableObject {
  async mutateExamIndex({ studentId, operation, summary }) {
    if (!studentId || !summary?.id) throw new Error("Invalid exam index mutation");
    const activeKey = indexKey(studentId, false);
    const trashKey = indexKey(studentId, true);
    const active = (await this.env.SCORE_KV.get(activeKey, "json")) || { studentId, items: [] };
    const trash = (await this.env.SCORE_KV.get(trashKey, "json")) || { studentId, items: [] };
    let activeItems = Array.isArray(active.items) ? active.items : [];
    let trashItems = Array.isArray(trash.items) ? trash.items : [];

    if (operation === "upsert-active") {
      activeItems = [summary, ...activeItems.filter((item) => item.id !== summary.id && !item.deletedAt)];
      trashItems = trashItems.filter((item) => item.id !== summary.id);
      await this.env.SCORE_KV.put(activeKey, JSON.stringify({
        studentId, items: bounded(activeItems), updatedAt: new Date().toISOString()
      }));
      return;
    }

    if (operation === "delete") {
      activeItems = activeItems.filter((item) => item.id !== summary.id);
      trashItems = [summary, ...trashItems.filter((item) => item.id !== summary.id)];
      await Promise.all([
        this.env.SCORE_KV.put(activeKey, JSON.stringify({
          studentId, items: bounded(activeItems), updatedAt: new Date().toISOString()
        })),
        this.env.SCORE_KV.put(trashKey, JSON.stringify({
          studentId, items: bounded(trashItems), updatedAt: new Date().toISOString()
        }))
      ]);
      return;
    }

    if (operation === "restore") {
      activeItems = [summary, ...activeItems.filter((item) => item.id !== summary.id && !item.deletedAt)];
      trashItems = trashItems.filter((item) => item.id !== summary.id);
      await Promise.all([
        this.env.SCORE_KV.put(activeKey, JSON.stringify({
          studentId, items: bounded(activeItems), updatedAt: new Date().toISOString()
        })),
        this.env.SCORE_KV.put(trashKey, JSON.stringify({
          studentId, items: trashItems, updatedAt: new Date().toISOString()
        }))
      ]);
      return;
    }

    throw new Error("Unknown exam index operation");
  }
}
