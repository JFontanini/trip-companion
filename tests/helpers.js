import fs from "node:fs";

const read = (slug, name) => JSON.parse(fs.readFileSync(new URL(`../trips/${slug}/${name}.json`, import.meta.url), "utf8"));

export function loadPack(slug) {
  return {
    trip: read(slug, "trip"), stops: read(slug, "stops"), restaurants: read(slug, "restaurants"), road: read(slug, "road-model"),
    profiles: read(slug, "profiles"), calendar: read(slug, "calendar"), sources: read(slug, "sources"), photos: read(slug, "photos")
  };
}
