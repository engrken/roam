import test from "node:test";
import assert from "node:assert/strict";
import { blockingMaintenanceStatuses } from "../src/lib/maintenance-availability.ts";

test("scheduled and in-progress maintenance block rentals", () => {
  assert.deepEqual([...blockingMaintenanceStatuses], ["SCHEDULED", "IN_PROGRESS"]);
});

test("completed and cancelled maintenance do not block rentals", () => {
  assert.equal(blockingMaintenanceStatuses.includes("COMPLETED"), false);
  assert.equal(blockingMaintenanceStatuses.includes("CANCELLED"), false);
});
