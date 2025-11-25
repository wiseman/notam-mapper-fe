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

export function completePolygon(polygon: Polygon): Polygon {
    // If coordinates are null, undefined, or empty, return the polygon as-is
    if (!polygon.coordinates || polygon.coordinates.length === 0) {
        return polygon;
    }

    // If the polygon is already complete, return it as-is
    if (polygonIsComplete(polygon)) {
        return polygon;
    }

    // Complete the polygon by connecting the first and last coordinates
    const first = polygon.coordinates[0];
    return {
        ...polygon,
        coordinates: [...polygon.coordinates, { lat: first.lat, lon: first.lon }]
    };
}

export function polygonsAreEqual(a: Polygon, b: Polygon): boolean {
    if (a.coordinates.length !== b.coordinates.length) return false;
    for (let i = 0; i < a.coordinates.length; i++) {
        if (a.coordinates[i].lat !== b.coordinates[i].lat || a.coordinates[i].lon !== b.coordinates[i].lon) return false;
    }
    return true;
}

export function parseCoords(coords: string): [number, number] {
    /**
     * Parse NOTAM/NAVAREA-style coordinates in any of these forms:
     *
     *   1) "422750N1154403W" or "422750N 1154403W"  (DDMMSSH DDDMMSSH)
     *   2) "24-13.51N 067-06.78E"                  (DD-MM.mmH DDD-MM.mmH)
     *   3) "41.67234 12.32"                        (decimal degrees, lat lon)
     *
     * Returns [lon, lat] as decimal degrees.
     */
    let s = coords.trim().toUpperCase().replace(/,/g, " ");
    const tokens = s.split(/\s+/).filter(Boolean);

    // Case 3: decimal degrees, lat lon (no hemisphere letters).
    if (
        tokens.length === 2 &&
        tokens.every(t => /^[+-]?\d+(\.\d+)?$/.test(t))
    ) {
        const lat = parseFloat(tokens[0]);
        const lon = parseFloat(tokens[1]);
        return [lon, lat];
    }

    let latToken: string;
    let lonToken: string;

    if (tokens.length === 1) {
        // Concatenated, e.g. "422750N1154403W"
        const t = tokens[0];

        const nsIdx = t.search(/[NS]/);
        if (nsIdx === -1) {
            throw new Error(`Could not find N/S hemisphere in ${coords}`);
        }
        latToken = t.slice(0, nsIdx + 1);

        const rest = t.slice(nsIdx + 1);
        const ewIdx = rest.search(/[EW]/);
        if (ewIdx === -1) {
            throw new Error(`Could not find E/W hemisphere in ${coords}`);
        }
        lonToken = rest.slice(0, ewIdx + 1);
    } else if (tokens.length === 2) {
        // Separated with hemisphere, e.g. "24-13.51N 067-06.78E"
        [latToken, lonToken] = tokens;
    } else {
        throw new Error(`Unexpected coordinate format: ${coords}`);
    }

    const lat = parseComponent(latToken);
    const lon = parseComponent(lonToken);
    console.log(`Parsed ${coords} to ${lon}, ${lat}`);
    return [lon, lat];
}

function parseComponent(token: string): number {
    /**
     * Parse a single latitude/longitude component with hemisphere, e.g.:
     *
     *   "422750N"    -> 42°27'50" N
     *   "1154403W"   -> 115°44'03" W
     *   "24-13.51N"  -> 24°13.51' N
     *   "067-06.78E" -> 67°06.78' E
     *
     * Returns signed decimal degrees.
     */
    token = token.trim().toUpperCase();
    if (!token) {
        throw new Error("Empty coordinate component");
    }

    const hemi = token[token.length - 1];
    if (!/[NSEW]/.test(hemi)) {
        throw new Error(`Missing hemisphere in ${token}`);
    }
    const body = token.slice(0, -1);

    let deg: number;
    let minutes: number;
    let seconds = 0;

    if (body.includes("-")) {
        // Degrees + decimal minutes: DD-MM.mm or DDD-MM.mm
        const [degStr, minStr] = body.split("-", 2);
        deg = parseInt(degStr, 10);
        minutes = parseFloat(minStr);
    } else {
        // Compact DMS: DDMMSS / DDDMMSS or DDMM / DDDMM (no seconds)
        const len = body.length;
        if (len !== 4 && len !== 5 && len !== 6 && len !== 7) {
            throw new Error(`Unexpected DMS length for ${token}`);
        }

        let degStr: string;
        let minStr: string;
        let secStr: string;

        if (len === 4) {
            // DDMM -> seconds = 0
            degStr = body.slice(0, 2);
            minStr = body.slice(2, 4);
            secStr = "0";
        } else if (len === 5) {
            // DDDMM -> seconds = 0
            degStr = body.slice(0, 3);
            minStr = body.slice(3, 5);
            secStr = "0";
        } else if (len === 6) {
            // DDMMSS
            degStr = body.slice(0, 2);
            minStr = body.slice(2, 4);
            secStr = body.slice(4, 6);
        } else {
            // 7: DDDMMSS
            degStr = body.slice(0, 3);
            minStr = body.slice(3, 5);
            secStr = body.slice(5, 7);
        }

        deg = parseInt(degStr, 10);
        minutes = parseInt(minStr, 10);
        seconds = parseInt(secStr, 10);
    }

    let value = deg + minutes / 60 + seconds / 3600;
    if (hemi === "S" || hemi === "W") {
        value = -value;
    }
    return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function polygonToGeoJSON(polygon: Polygon): any {
    const coordinates = polygon.coordinates.map((coord) => parseCoords(coord.lat + ' ' + coord.lon));
    return {
        type: 'Feature',
        properties: {},
        geometry: {
            type: 'Polygon',
            coordinates: [coordinates],
        },
    };
}