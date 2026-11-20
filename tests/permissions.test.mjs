import test from "node:test";
import assert from "node:assert/strict";
import { canManageBilling, canManageFleet, canManageTeam, canManageWorkspaceSettings } from "../src/lib/permissions.ts";

const roles = ["OWNER", "ADMIN", "MANAGER", "STAFF"];

test("fleet permissions are limited to owners, admins, and managers", () => {
  assert.deepEqual(roles.filter(canManageFleet), ["OWNER", "ADMIN", "MANAGER"]);
});

test("team permissions are limited to owners and admins", () => {
  assert.deepEqual(roles.filter(canManageTeam), ["OWNER", "ADMIN"]);
});

test("workspace settings permissions are limited to owners and admins", () => {
  assert.deepEqual(roles.filter(canManageWorkspaceSettings), ["OWNER", "ADMIN"]);
});

test("billing permissions are owner-only", () => {
  assert.deepEqual(roles.filter(canManageBilling), ["OWNER"]);
});
