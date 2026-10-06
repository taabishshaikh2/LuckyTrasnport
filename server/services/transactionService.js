import mongoose from "mongoose";
export async function transaction(fn) {
  const s = await mongoose.startSession();
  try {
    let value;
    await s.withTransaction(async () => {
      value = await fn(s);
    });
    return value;
  } finally {
    await s.endSession();
  }
}
