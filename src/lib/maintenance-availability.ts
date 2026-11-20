/** Maintenance states that prevent a vehicle from being booked. Keep public availability and submission checks aligned. */
export const blockingMaintenanceStatuses = ["SCHEDULED", "IN_PROGRESS"] as const;
