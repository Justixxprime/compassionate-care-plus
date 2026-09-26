-- CreateTable
CREATE TABLE "message_read_states" (
    "thread_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "message_read_states_pkey" PRIMARY KEY ("thread_id","user_id")
);

-- CreateIndex
CREATE INDEX "message_read_states_user_id_last_read_at_idx" ON "message_read_states"("user_id", "last_read_at");

-- AddForeignKey
ALTER TABLE "message_read_states" ADD CONSTRAINT "message_read_states_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "message_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_read_states" ADD CONSTRAINT "message_read_states_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
