ALTER TABLE "Booking" ADD COLUMN "publicTokenHash" TEXT;
CREATE UNIQUE INDEX "Booking_publicTokenHash_key" ON "Booking"("publicTokenHash");
CREATE TABLE "BookingMessage" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "sender" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingMessage_bookingId_createdAt_idx" ON "BookingMessage"("bookingId","createdAt");
ALTER TABLE "BookingMessage" ADD CONSTRAINT "BookingMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE TABLE "BookingDocument" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "pathname" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookingDocument_pathname_key" ON "BookingDocument"("pathname");
CREATE INDEX "BookingDocument_bookingId_reviewStatus_idx" ON "BookingDocument"("bookingId","reviewStatus");
ALTER TABLE "BookingDocument" ADD CONSTRAINT "BookingDocument_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
