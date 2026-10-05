// The active trip content pack and its engine. One build per trip for now (see vite.config.js).
import trip from "../trips/guam/trip.json";
import stops from "../trips/guam/stops.json";
import restaurants from "../trips/guam/restaurants.json";
import road from "../trips/guam/road-model.json";
import profiles from "../trips/guam/profiles.json";
import calendar from "../trips/guam/calendar.json";
import sources from "../trips/guam/sources.json";
import categories from "../trips/guam/categories.json";
import photos from "../trips/guam/photos.json";
import { createEngine } from "./engine/loop-drive.js";

export const PACK = { trip, stops, restaurants, road, profiles, calendar, sources, categories, photos };
export const ENGINE = createEngine(PACK);
export const ACCESSED = new Date(trip.lastVerified + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
