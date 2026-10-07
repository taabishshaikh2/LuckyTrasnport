import { validateEnv } from "./config/env.js";
import mongoose from "mongoose";
import { app } from "./app.js";
validateEnv();
await mongoose.connect(process.env.MONGODB_URI);
// Existing installations used a unique trip index that also indexed empty arrays.
// Retain the guard for legacy adhoc invoices while permitting fleet invoices without trip IDs.
const collection=mongoose.connection.collection("invoices");
const indexes=await collection.listIndexes().toArray().catch(e=>{if(e.code===26) return []; throw e;});
const old=indexes.find(i=>i.name === "tripIds_1");
if (old && !old.partialFilterExpression?.["tripIds.0"]) await collection.dropIndex("tripIds_1");
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
