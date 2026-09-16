import { asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Game } from '../types/game';

/** Options used to filter games by related category and publisher names. */
export interface GameFilters {
    /** Exact category names to include. Empty means no category filtering. */
    categoryNames?: string[];
    /** Exact publisher names to include. Empty means no publisher filtering. */
    publisherNames?: string[];
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function toFilterValues(values: string[] | undefined): string[] {
    return [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))];
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function applyGameFilters(query: any, filters: GameFilters = {}): any {
    const categoryNames = toFilterValues(filters.categoryNames);
    const publisherNames = toFilterValues(filters.publisherNames);

    if (categoryNames.length > 0) {
        query = query.where(inArray(categories.name, categoryNames));
    }

    if (publisherNames.length > 0) {
        query = query.where(inArray(publishers.name, publisherNames));
    }

    return query;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Return every game in title order, optionally limited to category and publisher names.
 * @param db - the injectable database client.
 * @param filters - optional exact category and publisher names to include.
 * @returns the matching games with their related category and publisher data.
 */
export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const rows = await applyGameFilters(baseGamesQuery(db), filters).orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** Return every distinct category name, ordered alphabetically.
 * @param db - the injectable database client.
 * @returns all category names in deterministic order.
 */
export async function getAllCategories(db: Database): Promise<string[]> {
    const rows = await db.select({ name: categories.name }).from(categories).orderBy(asc(categories.name));
    return rows.map((row) => row.name);
}

/** Return every distinct publisher name, ordered alphabetically.
 * @param db - the injectable database client.
 * @returns all publisher names in deterministic order.
 */
export async function getAllPublishers(db: Database): Promise<string[]> {
    const rows = await db.select({ name: publishers.name }).from(publishers).orderBy(asc(publishers.name));
    return rows.map((row) => row.name);
}

/** Return every game id in title order.
 * @param db - the injectable database client.
 * @returns all game ids ordered by title.
 */
export async function getAllGameIds(db: Database): Promise<number[]> {
    const rows = await db.select({ id: games.id }).from(games).orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** Return a game by id or null when no match exists.
 * @param db - the injectable database client.
 * @param id - the game id to look up.
 * @returns the matching game with related metadata, or null when the id does not exist.
 */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
