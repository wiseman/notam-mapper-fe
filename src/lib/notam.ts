export type SurfaceAlt = {
    type: "SFC";
};

export type UnlimitedAlt = {
    type: "UNL";
};

export type MslAlt = {
    type: "MSL";
    heightFt: number;
};

export type AglAlt = {
    type: "AGL";
    heightFt: number;
};

export type FlAlt = {
    type: "FL";
    heightFt: number;
};

export type AltitudeRange = {
    type: "RANGE";
    min: SurfaceAlt | UnlimitedAlt | MslAlt | AglAlt | FlAlt;
    max: SurfaceAlt | UnlimitedAlt | MslAlt | AglAlt | FlAlt;
};

type AllAltitudes = undefined | null | FlAlt | MslAlt | AglAlt | SurfaceAlt | AltitudeRange | UnlimitedAlt;
export function altitudeIsComplete(alt: Partial<AllAltitudes>): boolean {
    if (!alt) return false;
    if ('type' in alt) {
        if (alt.type === "RANGE") {
            return altitudeIsComplete(alt.min) && altitudeIsComplete(alt.max);
        } else if (alt.type === "SFC" || alt.type === "UNL") {
            return true;
        } else if (alt.type === "MSL" || alt.type === "AGL" || alt.type === "FL") {
            return alt.heightFt !== undefined && alt.heightFt !== null;
        }
    }
    return false;
}

export type Coordinates = {
    lat: string;
    lon: string;
};

export type RangeRing = {
    center: Coordinates;
    radiusNm: number;
    altitude: MslAlt | AglAlt | SurfaceAlt | AltitudeRange | UnlimitedAlt | FlAlt;
};

export type Polygon = {
    coordinates: Coordinates[];
    altitude: AltitudeRange;
};

export type Notam = {
    number?: string,
    accountability?: string;
    description: string;
    location: string;
    rangeRings: RangeRing[];
    polygons: Polygon[];
    dailyTimes: string[];
    startDate?: Date;
    endDate?: Date;
};

export function polygonIsComplete(polygon: Partial<Polygon>): boolean {
    if (!polygon.coordinates || polygon.coordinates.length < 3) return false;
    const first = polygon.coordinates[0];
    if (!first.lat || !first.lon) return false;
    const last = polygon.coordinates[polygon.coordinates.length - 1];
    // Check if the polygon is closed
    return first.lat === last.lat && first.lon === last.lon;
}

export function polygonsAreEqual(a: Polygon, b: Polygon): boolean {
    if (a.coordinates.length !== b.coordinates.length) return false;
    for (let i = 0; i < a.coordinates.length; i++) {
        if (a.coordinates[i].lat !== b.coordinates[i].lat || a.coordinates[i].lon !== b.coordinates[i].lon) return false;
    }
    return true;
}

export function parseCoords(coords: string): [number, number] {
    /** Converts a string like '422750N1154403W' to a decimal lon,lat like
[-115.734, 42.463]. */

    let lat: number =
        parseInt(coords.slice(0, 2)) +
        parseInt(coords.slice(2, 4)) / 60 +
        parseInt(coords.slice(4, 6)) / 3600;
    let lon: number =
        parseInt(coords.slice(7, 10)) +
        parseInt(coords.slice(10, 12)) / 60 +
        parseInt(coords.slice(12, 14)) / 3600;

    if (coords[6] === 'S') {
        lat = -lat;
    }
    if (coords[14] === 'W') {
        lon = -lon;
    }

    return [lon, lat];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function polygonToGeoJSON(polygon: Polygon): any {
    const coordinates = polygon.coordinates.map((coord) => parseCoords(coord.lat + coord.lon));
    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: [coordinates],
        },
    };
}