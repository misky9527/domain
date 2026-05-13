import Database from 'better-sqlite3';
export declare function getDb(): Database.Database;
/**
 * Get or create the default group for a user.
 */
export declare function getOrCreateDefaultGroup(userId: number): number;
/**
 * Get or create a group by name for a user.
 */
export declare function getOrCreateGroup(userId: number, name: string): number;
export default getDb;
//# sourceMappingURL=db.d.ts.map