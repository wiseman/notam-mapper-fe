// Converts "hiccup"-style structures (https://github.com/weavejester/hiccup)
// to XML.
type HiccupNode = number | string | [string, Record<string, number | string>, ...HiccupNode[]];

function hiccup(node: HiccupNode): string {
    if (Array.isArray(node)) {
        const [tag, attribs, ...children] = node;
        const attribStrings: string[] = [];

        for (const prop in attribs) {
            if (!Object.prototype.hasOwnProperty.call(attribs, prop) || attribs[prop] === undefined) {
                continue;
            }
            attribStrings.push(`${prop}="${attribs[prop]}"`);
        }

        let xml = `<${tag} ${attribStrings.join(' ')}>`;
        for (const child of children) {
            xml += hiccup(child);
        }
        xml += `</${tag}>\n`;
        return xml;
    } else {
        return node.toString();
    }
}


// Converts "rrggbb" colors to KML format, "aabbggrr".
function RGBColorToKMLColor(c: string): string {
    return 'ff' + c.substring(4, 6) + c.substring(2, 4) + c.substring(0, 2);
}


export function geoJsonsToKml(geoJsons: any[]): string {
    const prologue = '<?xml version="1.0" encoding="UTF-8"?>\n';
    const xmlObj: HiccupNode = ["kml", {
        "xmlns": "http://www.opengis.net/kml/2.2",
        "xmlns:gx": "http://www.google.com/kml/ext/2.2"
    },
        ["Document", {},
            ["Style", { id: "polygonStyle" },
                ["PolyStyle", {},
                    ["color", {}, "190000ff"],  // Red with alpha 0.1 (19 in hex)
                    ["outline", {}, "1"]
                ]
            ],
            ["Style", { id: "lineStyle" },
                ["LineStyle", {},
                    ["color", {}, "ff0000ff"],  // Red
                    ["width", {}, "2"]
                ]
            ],
            ...geoJsons.map((feature, index) => {
                const coordinates = feature.geometry.coordinates[0].map((coord: number[]) =>
                    coord.slice(0, 2).join(',')
                ).join(' ');

                return ["Placemark", {},
                    ["name", {}, `Polygon ${index + 1}`],
                    ["styleUrl", {}, "#polygonStyle"],
                    ["Polygon", {},
                        ["tessellate", {}, "1"],
                        ["altitudeMode", {}, "clampToGround"],
                        ["outerBoundaryIs", {},
                            ["LinearRing", {},
                                ["coordinates", {}, coordinates]
                            ]
                        ]
                    ]
                ];
            })
        ]
    ];

    return prologue + hiccup(xmlObj);
}