import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
let client: MongoClient | null = null;

export async function getDb() {
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }
  return client.db(process.env.MONGODB_DB || "work-calendar");
}