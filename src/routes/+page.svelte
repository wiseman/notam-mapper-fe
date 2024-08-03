<script lang="ts">
	import { geoJsonsToKml } from "$lib/kml";
	import {
		altitudeIsComplete,
		parseCoords,
		polygonIsComplete,
		polygonToGeoJSON,
		polygonsAreEqual,
		type AglAlt,
		type AltitudeRange,
		type Coordinates,
		type FlAlt,
		type MslAlt,
		type Notam,
		type Polygon,
		type RangeRing,
		type SurfaceAlt,
		type UnlimitedAlt,
	} from "$lib/notam";
	import {
		createParser,
		type ParsedEvent,
		type ReconnectInterval,
	} from "eventsource-parser";
	import {
		Button,
		Spinner,
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Textarea,
	} from "flowbite-svelte";
	import maplibregl, {
		type LngLatBoundsLike,
		type StyleSpecification,
	} from "maplibre-gl";
	import "maplibre-gl/dist/maplibre-gl.css";
	import { onMount } from "svelte";
	// @ts-ignore
	import * as turf from "@turf/turf";

	let notamText = `!GPS 01/020 ZLC NAV GPS (MHRC GPS 24-02)(INCLUDING WAAS,GBAS, AND 
ADS-B) MAY NOT BE AVBL WI A 372NM RADIUS CENTERED AT
424006N1153225W(TWF266048) FL400-UNL,
332NM RADIUS AT FL250,
229NM RADIUS AT 10000FT,
233NM RADIUS AT 4000FT AGL,
193NM RADIUS AT 50FT AGL.
DLY 1700-2000
2401081700-2401122000`;
	let notam: Partial<Notam> = {};
	let map: maplibregl.Map | null = null;
	let finishedRangeRings: RangeRing[] = [];
	let fitRangeRing: RangeRing | null = null;
	let finishedPolygons: Polygon[] = [];
	let polygonBounds: LngLatBoundsLike | null = null;
	let geoJsonObjs: any[] = [];
	let searchInProgress = false;

	function checkPolygons() {
		// Examine notam.polygons and find any that are not in finishedPolygons.
		// Add them to finishedPolygons and remove any that are no longer in notam.polygons.
		if (!notam.polygons) return;
		let newPolygons = [];
		for (const polygon of notam.polygons) {
			if (!polygonIsComplete(polygon)) {
				continue;
			}
			if (!finishedPolygons.find((p) => polygonsAreEqual(p, polygon))) {
				newPolygons.push(polygon);
				finishedPolygons.push(polygon);
			}
		}
		// Add any polygons in newPolygons to the map. Use turf.polygon to
		// create a GeoJSON polygon.
		for (const polygon of newPolygons) {
			const geojson = polygonToGeoJSON(polygon);
			if (!polygonBounds) {
				polygonBounds = turf.bbox(geojson);
			} else {
				polygonBounds = turf.bbox(
					turf.combine([geojson, turf.bboxPolygon(polygonBounds)]),
				);
			}
			geoJsonObjs.push(geojson);
			const id = `polygon-${polygon.coordinates.join("-")}`;
			map?.addSource(id, {
				type: "geojson",
				data: geojson,
			});
			map?.addLayer({
				id: id,
				type: "fill",
				source: id,
				paint: {
					"fill-color": "#f00",
					"fill-opacity": 0.2,
				},
			});
		}
		geoJsonObjs = geoJsonObjs;
		if (polygonBounds) {
			map?.fitBounds(polygonBounds, {
				padding: 80,
			});
		}
	}

	function checkRangeRings() {
		// Examine notam.rangeRings and find any that are not in rangeRings.
		// Add them to rangeRings and remove any that are no longer in notam.rangeRings.
		if (!notam.rangeRings) return;
		let newRangeRings = [];
		// console.log(finishedRangeRings);
		for (const rangeRing of notam.rangeRings) {
			if (
				!rangeRing.center ||
				!rangeRing.radiusNm ||
				!rangeRing.altitude
				// !altitudeIsComplete(rangeRing.altitude)
			)
				continue;
			if (
				!finishedRangeRings.find(
					(r) =>
						r.center.lat === rangeRing.center.lat &&
						r.center.lon === rangeRing.center.lon &&
						r.radiusNm === rangeRing.radiusNm,
				)
			) {
				// console.log('Adding range ring', rangeRing);
				newRangeRings.push(rangeRing);
				finishedRangeRings.push(rangeRing);
				// console.log('new rangeRings value:', newRangeRings);
			}
		}
		// Add any rangeRings in newRangeRings to the map. Use turf.circle to create a GeoJSON circle.
		for (const rangeRing of newRangeRings) {
			const [lon, lat] = parseCoords(
				rangeRing.center.lat + rangeRing.center.lon,
			);
			const radiusMiles = rangeRing.radiusNm * 1.15078;
			const circle = turf.circle([lon, lat], radiusMiles, {
				steps: 200,
				units: "miles",
				properties: {
					// label: formatAltitude(rangeRing.altitude),
					radius: rangeRing.radiusNm / 40.0,
				},
			});
			geoJsonObjs.push(circle);
			const id = `range-ring-${rangeRing.center.lat}-${rangeRing.center.lon}-${rangeRing.radiusNm}`;
			// console.log(`Adding source range-ring-${rangeRing.center.lat}-${rangeRing.center.lon}`);
			map?.addSource(id, {
				type: "geojson",
				data: circle,
			});
			// console.log("Adding layer", id);
			map?.addLayer({
				id,
				type: "fill",
				source: `range-ring-${rangeRing.center.lat}-${rangeRing.center.lon}-${rangeRing.radiusNm}`,
				paint: {
					"fill-color": "#801",
					"fill-opacity": 0.2,
				},
			});
			// map?.addLayer({
			// 	id: `rr-label-${id}`,
			// 	type: "symbol",
			// 	source: id,
			// 	layout: {
			// 		"text-field": ["get", "label"],
			// 		// 'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
			// 		"text-variable-anchor": ["center"],
			// 		"text-allow-overlap": true,
			// 		"text-ignore-placement": true,
			// 		"text-radial-offset": [
			// 			"interpolate",
			// 			["linear"],
			// 			["zoom"],
			// 			0,
			// 			["/", ["get", "radius"], 0.1], // Adjust the divisor as needed for appropriate scaling
			// 			22,
			// 			["get", "radius"],
			// 		],
			// 		"text-justify": "auto",
			// 		// 'icon-image': ['concat', ['get', 'icon'], '_15']
			// 	},
			// });

			// Find the rangeRing with the largest radius.
			const largestRangeRing = notam.rangeRings.reduce((a, b) =>
				a.radiusNm > b.radiusNm ? a : b,
			);
			if (
				!fitRangeRing ||
				largestRangeRing.radiusNm > fitRangeRing.radiusNm
			) {
				fitRangeRing = largestRangeRing;
				map?.fitBounds(turf.bbox(circle), {
					padding: 80,
				});
			}
		}
	}

	function formatCoordinates(coords: Coordinates | null): string {
		if (!coords) return "…";
		return `${coords.lat || "…"} ${coords.lon || "…"}`;
	}

	function formatAltitude(
		altitude:
			| undefined
			| null
			| FlAlt
			| MslAlt
			| AglAlt
			| SurfaceAlt
			| AltitudeRange
			| UnlimitedAlt,
	): string {
		if (!altitude) return "…";
		if ("type" in altitude) {
			switch (altitude.type) {
				case "FL":
					return `FL${altitude.heightFt}`;
				case "MSL":
					return `${altitude.heightFt} MSL`;
				case "AGL":
					return `${altitude.heightFt} AGL`;
				case "SFC":
					return "SFC";
				case "UNL":
					return "Unlimited Altitude";
				case "RANGE":
					return `Min: ${formatAltitude(altitude.min)}, Max: ${formatAltitude(altitude.max)}`;
				default:
					return "Unknown Altitude";
			}
		}
		return "Unknown Altitude";
	}

	function resetMap() {
		finishedRangeRings = [];
		fitRangeRing = null;
		finishedPolygons = [];
		polygonBounds = null;
		// Remove all layers and sources from the map.
		if (map) {
			const layers = map.getStyle().layers || [];
			for (const layer of layers) {
				if (
					layer.id.startsWith("range-ring-") ||
					layer.id.startsWith("polygon-") ||
					layer.id.startsWith("rr-label-")
				) {
					map.removeLayer(layer.id);
				}
			}
			const sources = map.getStyle().sources || {};
			for (const source in sources) {
				if (
					source.startsWith("range-ring-") ||
					source.startsWith("polygon-")
				) {
					map.removeSource(source);
				}
			}
		}
	}

	async function downloadKml() {
		const kml = geoJsonsToKml(geoJsonObjs);
		const blob = new Blob([kml], { type: "application/vnd" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "notam.kml";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}

	async function parse() {
		searchInProgress = true;
		try {
			notam = {};
			resetMap();
			const response = await fetch("/api/parse", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: notamText,
			});
			if (!response.ok) {
				console.log(response);
				throw new Error("Failed to parse NOTAM");
			}
			if (!response.body) {
				throw new Error("Response body is undefined");
			}
			const reader = response.body.getReader();
			const decoder = new TextDecoder("utf-8");
			let done = false;
			const onParse = (event: ParsedEvent | ReconnectInterval) => {
				// console.log(event);
				if (event.type === "event") {
					// console.log('event.data', event.data);
					notam = JSON.parse(event.data);
					// console.log(notam);
					checkRangeRings();
					checkPolygons();
				}
			};
			const parser = createParser(onParse);
			while (!done) {
				try {
					const { value, done: readerDone } = await reader.read();
					done = readerDone;
					if (value) {
						const text = decoder.decode(value, { stream: !done });
						parser.feed(text);
					}
				} catch (readError) {
					console.error("Error while reading:", readError);
					done = true; // Ensure the loop ends on an error
				}
			}
			resetMap();
			checkRangeRings();
			checkPolygons();
			notam = notam;
			searchInProgress = false;
		} finally {
			searchInProgress = false;
		}
	}

	const osmStyle: StyleSpecification = {
		version: 8,
		sources: {
			osm: {
				type: "raster",
				tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
				tileSize: 256,
				attribution: "&copy; OpenStreetMap Contributors",
				maxzoom: 19,
			},
		},
		layers: [
			{
				id: "osm",
				type: "raster",
				source: "osm", // This must match the source key above
			},
		],
	};

	const mapTilerSatelliteStyle =
		"https://api.maptiler.com/maps/hybrid/style.json?key=nyNmyljC7z3WFgoMTmUn";

	onMount(() => {
		map = new maplibregl.Map({
			container: "map",
			style: osmStyle,
			// style: 'https://api.maptiler.com/maps/openstreetmap/style.json?key=t7Eta0UXjo6L5tkZVqKC'
		});
	});
</script>

<div class="m-4">
	<h1 class="text-xl text-red-500">NOTAM Mapper</h1>
	<p class="mb-4 text-xs text-gray-400">
		By <a class="underline" href="https://heavymeta.org/">John Wiseman</a>
	</p>
	<Textarea
		class="mb-4"
		rows="10"
		placeholder="Paste NOTAM text here."
		bind:value={notamText}
	>
		<div slot="footer" class="flex">
			<Button
				class="mr-4"
				type="submit"
				disabled={searchInProgress}
				on:click={parse}>Map</Button
			>
			{#if searchInProgress}
				<Spinner class="mt-1 mr-4" />
			{/if}
			{#if geoJsonObjs.length > 0}
				<Button
					type="button"
					disabled={searchInProgress}
					on:click={downloadKml}>Download KML</Button
				>
			{/if}
		</div>
	</Textarea>
	<div class="flex" style="height: 600px;">
		<div class="w-1/2 overflow-y-auto pr-4">
			<div class="dark:text-green-400">
				<p>
					ID: <span class="text-gray-400">{notam.number || "…"}</span>
				</p>
				<p>
					Accountability: <span class="text-gray-400"
						>{notam.accountability || "…"}</span
					>
				</p>
				<p>
					Location: <span class="text-gray-400"
						>{notam.location || "…"}</span
					>
				</p>
				<p>
					Title: <b
						><span class="text-gray-400"
							>{notam.description || "…"}</span
						></b
					>
				</p>
				<p>
					Effective: <span class="text-gray-400"
						>{notam.startDate || "…"}</span
					>
					Expires:
					<span class="text-gray-400">{notam.endDate || "…"}</span>
				</p>
				{#if notam.dailyTimes && notam.dailyTimes.length > 0}
					<Table>
						<TableHead>
							<TableHeadCell>Daily Times</TableHeadCell>
						</TableHead>
						<TableBody>
							{#each notam.dailyTimes as dailyTime}
								<TableBodyRow>
									<TableBodyCell>{dailyTime}</TableBodyCell>
								</TableBodyRow>
							{/each}
						</TableBody>
					</Table>
				{/if}
				{#if notam.rangeRings && notam.rangeRings.length > 0}
					<p>
						Centered at <span class="text-gray-400"
							>{formatCoordinates(
								notam.rangeRings[0].center,
							)}</span
						>
					</p>
					<Table>
						<TableHead>
							<TableHeadCell>Distance</TableHeadCell>
							<TableHeadCell>Altitude</TableHeadCell>
						</TableHead>
						<TableBody>
							{#each notam.rangeRings as rangeRing}
								<TableBodyRow>
									<TableBodyCell
										>{rangeRing.radiusNm || "…"} NM</TableBodyCell
									>
									<TableBodyCell
										>{formatAltitude(
											rangeRing.altitude,
										)}</TableBodyCell
									>
								</TableBodyRow>
							{/each}
						</TableBody>
					</Table>
				{/if}
				{#if notam.polygons && notam.polygons.length > 0}
					<Table>
						<TableHead>
							<TableHeadCell>Coordinates</TableHeadCell>
							<TableHeadCell>Altitude</TableHeadCell>
						</TableHead>
						<TableBody>
							{#each notam.polygons as polygon}
								{#if polygonIsComplete(polygon)}
									<TableBodyRow>
										<TableBodyCell
											>{polygon.coordinates
												.map(formatCoordinates)
												.join("-")}</TableBodyCell
										>
										<TableBodyCell
											>{formatAltitude(
												polygon.altitude,
											)}</TableBodyCell
										>
									</TableBodyRow>
								{/if}
							{/each}
						</TableBody>
					</Table>
				{/if}
			</div>
		</div>
		<div class="w-1/2 pl-4">
			<div id="map"></div>
		</div>
	</div>
</div>

<style>
	#map {
		height: 100%;
	}
</style>
