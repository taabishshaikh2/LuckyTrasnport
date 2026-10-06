import { validateEnv } from "./config/env.js";
import mongoose from "mongoose";
import { app } from "./app.js";
validateEnv();
await mongoose.connect(process.env.MONGODB_URI);
await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
const server = app.listen(process.env.PORT || 3001, () =>
  console.log("Lucky Transport API started"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    }),
  );
