import mongoose from 'mongoose';

/**
 * Idempotent migration: convert legacy workspace.members entries that are
 * raw ObjectIds (or strings) into the new {userId, role, addedAt} subdoc shape.
 *
 * Safe to run on every startup — only touches docs that need fixing.
 */
export async function migrateWorkspaceMembers(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) return;

  const coll = db.collection('workspaces');
  // Find workspaces where at least one member is NOT a subdoc with userId.
  // Mongo can't easily filter this with $elemMatch; just scan a small cursor.
  const cursor = coll.find({});
  let migrated = 0;

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    if (!doc) continue;
    const members = doc.members;
    if (!Array.isArray(members)) continue;

    let needsUpdate = false;
    const normalized = members.map((m: any) => {
      // Already the new shape
      if (m && typeof m === 'object' && m.userId) return m;

      // Legacy: raw ObjectId or string
      needsUpdate = true;
      const userIdRaw = m?._id ?? m;
      return {
        userId: new mongoose.Types.ObjectId(userIdRaw),
        role: 'member',
        addedAt: new Date(),
        addedBy: doc.ownerId || null,
      };
    });

    if (needsUpdate) {
      await coll.updateOne(
        { _id: doc._id },
        { $set: { members: normalized } }
      );
      migrated++;
    }
  }

  if (migrated > 0) {
    console.log(`🔄 Migrated ${migrated} workspace(s) to new member-role schema.`);
  }
}
