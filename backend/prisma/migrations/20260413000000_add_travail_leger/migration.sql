-- AlterEnum (IF NOT EXISTS: some DBs already had this value applied out-of-band)
ALTER TYPE "public"."WorkerType" ADD VALUE IF NOT EXISTS 'TRAVAIL_LEGER';
