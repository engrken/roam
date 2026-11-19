CREATE TYPE "InspectionType" AS ENUM ('HANDOVER', 'RETURN');
CREATE TYPE "FuelLevel" AS ENUM ('EMPTY', 'QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL');

CREATE TABLE "VehicleInspection" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "type" "InspectionType" NOT NULL,
  "odometerKm" INTEGER NOT NULL,
  "fuelLevel" "FuelLevel" NOT NULL,
  "conditionNotes" TEXT NOT NULL,
  "damageNotes" TEXT,
  "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleInspection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VehicleInspection_bookingId_vehicleId_type_key" ON "VehicleInspection"("bookingId", "vehicleId", "type");
CREATE INDEX "VehicleInspection_tenantId_inspectedAt_idx" ON "VehicleInspection"("tenantId", "inspectedAt");
CREATE INDEX "VehicleInspection_vehicleId_inspectedAt_idx" ON "VehicleInspection"("vehicleId", "inspectedAt");
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleInspection" ADD CONSTRAINT "VehicleInspection_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "VehicleInspectionPhoto" (
  "id" TEXT NOT NULL,
  "inspectionId" TEXT NOT NULL,
  "pathname" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleInspectionPhoto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "VehicleInspectionPhoto_pathname_key" ON "VehicleInspectionPhoto"("pathname");
CREATE INDEX "VehicleInspectionPhoto_inspectionId_createdAt_idx" ON "VehicleInspectionPhoto"("inspectionId", "createdAt");
ALTER TABLE "VehicleInspectionPhoto" ADD CONSTRAINT "VehicleInspectionPhoto_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "VehicleInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
