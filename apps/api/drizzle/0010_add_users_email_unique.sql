CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email")) WHERE "deleted_at" is null;
