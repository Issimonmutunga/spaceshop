// Emits seed/supermarket.json and seed/home.json from a compact table.
// Kept as a script so the demo data stays readable and reviewable.
// Run: node scripts/make-seeds.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const now = 1704067200000; // fixed so seeds are byte-stable

/* ------------------------------------------------------------------ utils */
const node = (key, kind, name, x, y, extra = {}) => ({
  key,
  kind,
  name,
  x,
  y,
  parentId: extra.parentKey ?? null,
  landmark: extra.landmark ? true : undefined,
  w: extra.w,
  h: extra.h,
  rotation: extra.rotation,
  qr: undefined, // loader mints label codes
});

/* ------------------------------------------------------------ supermarket */
// A store roughly 24 m x 30 m. Four aisles running north, two cross aisles.
const aisles = [
  { key: "a1", name: "Aisle 1", what: "Grocery", x: -9 },
  { key: "a2", name: "Aisle 2", what: "Drinks", x: -3 },
  { key: "a3", name: "Aisle 3", what: "Household", x: 3 },
  { key: "a4", name: "Aisle 4", what: "Frozen and chilled", x: 9 },
];

const supermarketNodes = [
  node("ent", "point", "Entrance doors", 0, 0, { landmark: true }),
  node("front", "point", "Front cross aisle", 0, -6, { landmark: true }),
  node("back", "point", "Back cross aisle", 0, -24, { landmark: true }),
  node("bakery", "point", "Bakery junction", 11, -6, { landmark: true }),
  node("pharm", "point", "Pharmacy junction", 0, -29, { landmark: true }),
  node("checkout", "point", "Checkout junction", -11, -3, { landmark: true }),

  node("entrance", "zone", "Entrance", 0, 1, { w: 11, h: 5 }),
  node("bakeryzone", "zone", "Bakery", 11, -3, { w: 6, h: 7 }),
  node("pharmacyzone", "zone", "Pharmacy", -11, -29, { w: 7, h: 5 }),
  node("checkoutzone", "zone", "Checkout", -11, -6, { w: 7, h: 6 }),
  node("stockzone", "zone", "Stockroom", -11, -17, { w: 7, h: 8 }),
];

const supermarketEdges = [
  ["ent", "front"],
  ["front", "back"],
  ["front", "checkout"],
  ["front", "bakery"],
  ["back", "pharm"],
];

for (const a of aisles) {
  supermarketNodes.push(
    node(`p-${a.key}-front`, "point", `${a.name} head`, a.x, -6),
    node(`p-${a.key}-back`, "point", `${a.name} rear`, a.x, -24),
    node(a.key, "zone", `${a.name} ${a.what}`, a.x, -15, { w: 4.4, h: 18 }),
  );
  supermarketEdges.push(
    ["front", `p-${a.key}-front`],
    ["back", `p-${a.key}-back`],
    [`p-${a.key}-front`, `p-${a.key}-back`],
  );
}

/** [zoneKey, placeKey, name, y, items[] as [name, tags, slot, qty]] */
const supermarketPlaces = [
  [
    "entrance",
    "baskets",
    "Basket stack",
    1.5,
    [
      ["Shopping basket", ["basket", "trolley"], "Left stack", 24],
      ["Trolley coin", ["trolley", "coin"], "Till drawer", 40],
    ],
  ],
  [
    "entrance",
    "services",
    "Customer services",
    -1.5,
    [
      ["Wheelchair", ["access"], "Left bay", 2],
      ["Store leaflet", ["leaflet", "flyer"], "Rack"],
      ["Lost property box", ["lost", "property"], "Back office"],
    ],
  ],
  [
    "bakeryzone",
    "bread",
    "Bread rack",
    -4.5,
    [
      ["Sourdough loaf", ["bread", "loaf"], "Middle"],
      ["Wholemeal loaf", ["bread", "brown"], "Left"],
      ["Baguette", ["bread", "french"], "Right"],
      ["Bagel 5-pack", ["bread", "bagel"], "Top shelf"],
    ],
  ],
  [
    "bakeryzone",
    "pastry",
    "Pastry case",
    -1.5,
    [
      ["Butter croissant", ["pastry", "croissant"], "Left"],
      ["Pain au chocolat", ["pastry", "chocolate"], "Centre"],
      ["Almond tart", ["pastry", "tart"], "Right"],
      ["Cinnamon bun", ["pastry", "bun"], "Back"],
    ],
  ],
  [
    "a1",
    "pasta",
    "Shelf 1 left",
    -9,
    [
      ["Spaghetti 500 g", ["pasta", "noodle"], "Level 3"],
      ["Penne 500 g", ["pasta", "noodle"], "Level 3"],
      ["Basmati rice 1 kg", ["rice"], "Level 2"],
      ["Pasta sauce jar", ["pasta", "sauce"], "Level 4"],
    ],
  ],
  [
    "a1",
    "cereal",
    "Shelf 1 right",
    -9,
    [
      ["Cornflakes 500 g", ["cereal", "breakfast"], "Level 4"],
      ["Rolled oats 1 kg", ["oats", "porridge"], "Level 2"],
      ["Muesli 500 g", ["cereal", "muesli"], "Level 4"],
      ["Honey 250 g", ["honey", "sweet"], "Level 5"],
    ],
  ],
  [
    "a1",
    "tins",
    "Shelf 2 left",
    -15,
    [
      ["Chopped tomatoes", ["tin", "tomato"], "Level 3", 12],
      ["Chickpeas", ["tin", "pulse"], "Level 3", 9],
      ["Tuna chunks", ["tin", "fish"], "Level 2", 7],
      ["Baked beans", ["tin", "bean"], "Level 2", 11],
      ["Coconut milk", ["tin", "coconut"], "Level 4"],
    ],
  ],
  [
    "a1",
    "snacks",
    "Shelf 2 right",
    -15,
    [
      ["Salted crisps", ["crisp", "snack"], "Level 3", 14],
      ["Dark chocolate 70%", ["chocolate", "sweet"], "Level 2"],
      ["Roasted almonds", ["nuts", "snack"], "Level 4"],
      ["Oat biscuits", ["biscuit", "cookie"], "Level 2"],
    ],
  ],
  [
    "a1",
    "spice",
    "Shelf 3",
    -20,
    [
      ["Ground cinnamon", ["spice"], "Jar 3"],
      ["Black peppercorns", ["spice", "pepper"], "Jar 7"],
      ["Paprika jar", ["spice"], "Jar 11"],
      ["Bay leaves", ["spice", "herb"], "Jar 2"],
    ],
  ],
  [
    "a2",
    "water",
    "Shelf 1 left",
    -9,
    [
      ["Still water 6-pack", ["water", "drink"], "Floor", 8],
      ["Sparkling water 6-pack", ["water", "sparkling"], "Floor", 4],
    ],
  ],
  [
    "a2",
    "juice",
    "Shelf 1 right",
    -9,
    [
      ["Orange juice 1 L", ["juice", "orange"], "Level 2", 6],
      ["Apple juice 1 L", ["juice", "apple"], "Level 2"],
      ["Mango smoothie", ["juice", "smoothie"], "Level 3"],
    ],
  ],
  [
    "a2",
    "coffee",
    "Shelf 2",
    -15,
    [
      ["Ground coffee 500 g", ["coffee"], "Level 3"],
      ["Tea bags 80", ["tea", "teabag"], "Level 3"],
      ["Instant coffee jar", ["coffee", "instant"], "Level 4"],
      ["Herbal tea", ["tea", "herbal"], "Level 4"],
    ],
  ],
  [
    "a2",
    "mixers",
    "Shelf 3",
    -20,
    [
      ["Cola 6-pack", ["cola", "drink"], "Floor", 6],
      ["Ginger ale", ["drink", "ginger"], "Floor"],
      ["Lemonade", ["drink", "lemon"], "Level 1"],
    ],
  ],
  [
    "a3",
    "cleaning",
    "Shelf 1",
    -9,
    [
      ["Washing-up liquid", ["washing up", "dish"], "Level 2", 6],
      ["Surface spray", ["cleaning", "spray"], "Level 2"],
      ["Bleach 1 L", ["cleaning", "bleach"], "Level 1"],
      ["Dishwasher tablets", ["dishwasher", "tablet"], "Level 4"],
    ],
  ],
  [
    "a3",
    "paper",
    "Shelf 2",
    -15,
    [
      ["Kitchen roll 6-pack", ["kitchen roll", "paper"], "Level 3", 5],
      ["Toilet roll 9-pack", ["toilet roll", "paper"], "Level 2", 8],
      ["Kitchen towel", ["paper towel"], "Level 4"],
    ],
  ],
  [
    "a3",
    "wrap",
    "Shelf 3",
    -20,
    [
      ["Cling film", ["cling film", "wrap"], "Level 3"],
      ["Aluminium foil 10 m", ["foil", "wrap"], "Level 3"],
      ["Food bags", ["bag", "wrap"], "Level 4"],
      ["Cling clips", ["clip", "wrap"], "Drawer 1"],
    ],
  ],
  [
    "a4",
    "meals",
    "Shelf 1",
    -9,
    [
      ["Frozen pizza", ["frozen", "pizza"], "Level 3"],
      ["Fish fingers", ["frozen", "fish"], "Level 3"],
      ["Oven chips", ["frozen", "chips"], "Level 4"],
    ],
  ],
  [
    "a4",
    "veg",
    "Shelf 2",
    -15,
    [
      ["Stir-fry mix", ["frozen", "vegetable"], "Level 3"],
      ["Spinach blocks", ["frozen", "spinach"], "Level 5"],
      ["Peas", ["frozen", "peas"], "Level 4"],
    ],
  ],
  [
    "a4",
    "dairy",
    "Shelf 3",
    -20,
    [
      ["Whole milk 2 L", ["milk", "dairy"], "Floor", 6],
      ["Butter block", ["butter", "dairy"], "Level 2"],
      ["Mature cheddar 400 g", ["cheese", "cheddar"], "Level 2"],
      ["Greek yoghurt 500 g", ["yoghurt", "dairy"], "Level 1"],
      ["Double cream", ["cream", "dairy"], "Level 1"],
    ],
  ],
  [
    "pharmacyzone",
    "meds",
    "Shelf 1",
    -29,
    [
      ["Paracetamol 500 mg", ["paracetamol", "painkiller", "tablet"], "Level 2"],
      ["Ibuprofen 200 mg", ["ibuprofen", "painkiller"], "Level 2"],
      ["Cough syrup", ["cough", "syrup"], "Level 3"],
      ["Antacid tablets", ["antacid", "stomach"], "Level 3"],
    ],
  ],
  [
    "pharmacyzone",
    "firstaid",
    "First aid drawer",
    -28,
    [
      ["Plasters", ["plaster", "first aid"], "Drawer 1"],
      ["Antiseptic cream", ["first aid", "cream"], "Drawer 2"],
      ["Burn gel", ["first aid", "burn"], "Drawer 2"],
      ["Thermometer", ["first aid", "temperature"], "Drawer 3"],
    ],
  ],
  [
    "checkoutzone",
    "till1",
    "Till 1",
    -5,
    [
      ["Tape measure", ["tool", "measure"], "Drawer 1"],
      ["Spare till roll", ["till", "receipt"], "Drawer 2"],
      ["Phone charger", ["charger", "cable"], "Counter"],
    ],
  ],
  [
    "checkoutzone",
    "till2",
    "Till 2",
    -6,
    [
      ["Screwdriver small", ["tool", "screwdriver"], "Drawer 1"],
      ["Safety cutter", ["tool", "cutter"], "Drawer 1"],
      ["Umbrella", ["umbrella"], "Side"],
    ],
  ],
  [
    "checkoutzone",
    "till3",
    "Till 3",
    -7,
    [
      ["Reusable bags", ["bag", "reusable"], "Under till", 30],
      ["Mint gum", ["gum", "mint"], "Counter"],
    ],
  ],
  [
    "stockzone",
    "rackA",
    "Rack A",
    -16,
    [
      ["Toilet roll bulk 48", ["toilet roll", "bulk"], "Rack A1", 20],
      ["Water crate", ["water", "bulk"], "Floor", 6],
      ["Crisp boxes", ["bulk", "snack"], "Rack A3", 12],
    ],
  ],
  [
    "stockzone",
    "rackB",
    "Rack B",
    -18,
    [
      ["Price gun labels", ["label", "price"], "Bin 3", 40],
      ["Batteries AA 24", ["battery", "aa"], "Bin 1"],
      ["Light bulbs", ["bulb", "light"], "Bin 2"],
    ],
  ],
];

const homeNodes = [
  node("ent", "point", "Front door", 0, 0, { landmark: true }),
  node("hall", "point", "Hall junction", 0, -3, { landmark: true }),
  node("kit", "point", "Kitchen doorway", -6, -3, { landmark: true }),
  node("kit2", "point", "Kitchen far corner", -6, -9),
  node("liv", "point", "Living room doorway", 6, -3, { landmark: true }),
  node("bed", "point", "Bedroom doorway", 6, -9, { landmark: true }),
  node("gar", "point", "Garage door", -6, -11, { landmark: true }),

  node("z-hall", "zone", "Hall", 0, -1, { w: 6, h: 6 }),
  node("z-kitchen", "zone", "Kitchen", -6, -6, { w: 8, h: 8 }),
  node("z-living", "zone", "Living room", 7, -4, { w: 8, h: 7 }),
  node("z-bedroom", "zone", "Bedroom", 8, -9, { w: 7, h: 7 }),
  node("z-garage", "zone", "Garage", -6, -15, { w: 12, h: 11 }),
];

const homeEdges = [
  ["ent", "hall"],
  ["hall", "kit"],
  ["hall", "liv"],
  ["kit", "kit2"],
  ["kit", "gar"],
  ["liv", "bed"],
];

const homePlaces = [
  [
    "z-hall",
    "coat",
    "Coat rack",
    -1,
    [
      ["House keys", ["keys", "key"], "Hook 2", 2],
      ["Umbrella", ["umbrella"], "Hook 4"],
      ["Sunglasses", ["sunglasses", "glasses"], "Hook 1"],
    ],
  ],
  [
    "z-hall",
    "shoes",
    "Shoe cupboard",
    -4.5,
    [
      ["Wellies", ["boots", "wellies"], "Bottom shelf", 2],
      ["Trainers", ["shoe", "trainers"], "Middle shelf"],
      ["Work boots", ["boots", "work"], "Top shelf"],
    ],
  ],
  [
    "z-kitchen",
    "drawers",
    "Drawer unit",
    -5,
    [
      ["Spatula", ["kitchen", "utensil"], "Drawer 1"],
      ["Wooden spoon", ["kitchen", "utensil"], "Drawer 1"],
      ["Paring knife", ["knife", "kitchen"], "Drawer 2"],
      ["Chef knife", ["knife", "kitchen"], "Drawer 2"],
      ["Tin opener", ["kitchen", "opener"], "Drawer 3"],
      ["Kitchen scissors", ["scissors", "kitchen"], "Drawer 3"],
      ["Batteries AA", ["battery", "aa"], "Drawer 4"],
      ["Small pliers", ["pliers", "tool"], "Drawer 4"],
    ],
  ],
  [
    "z-kitchen",
    "pantry",
    "Pantry shelf",
    -8,
    [
      ["Spaghetti 500 g", ["pasta", "noodle"], "Middle shelf"],
      ["Basmati rice 1 kg", ["rice"], "Bottom shelf"],
      ["Rolled oats", ["oats", "porridge"], "Top shelf"],
      ["Chopped tomatoes", ["tin", "tomato"], "Middle shelf", 3],
      ["Tinned beans", ["tin", "bean"], "Middle shelf"],
      ["Honey jar", ["honey", "sweet"], "Top shelf"],
    ],
  ],
  [
    "z-kitchen",
    "fridge",
    "Fridge",
    -8.5,
    [
      ["Milk 2 L", ["milk", "dairy"], "Door"],
      ["Butter", ["butter", "dairy"], "Top shelf"],
      ["Cheddar 400 g", ["cheese", "cheddar"], "Top shelf"],
      ["Greek yoghurt", ["yoghurt", "dairy"], "Middle shelf"],
      ["Salad bag", ["salad", "vegetable"], "Crisper"],
      ["Mustard", ["mustard", "sauce"], "Door"],
    ],
  ],
  [
    "z-living",
    "tv",
    "TV unit",
    -3.5,
    [
      ["TV remote", ["remote", "tv"], "Tray"],
      ["HDMI cable", ["cable", "hdmi"], "Tray"],
      ["Game controller", ["controller", "game"], "Shelf 1"],
      ["Spare fuses", ["fuse"], "Drawer 2"],
    ],
  ],
  [
    "z-living",
    "books",
    "Bookshelf",
    -6,
    [
      ["Paperback novels", ["book", "reading"], "Shelf 2"],
      ["Sketchpad", ["sketch", "drawing"], "Shelf 1"],
      ["Reading lamp", ["lamp", "light"], "Shelf 3"],
      ["Board games", ["game", "board"], "Bottom shelf"],
    ],
  ],
  [
    "z-bedroom",
    "wardrobe",
    "Wardrobe",
    -8.5,
    [
      ["Winter coat", ["coat", "winter"], "Top rail"],
      ["Rain jacket", ["coat", "rain"], "Middle rail"],
      ["Hiking boots", ["boots", "hiking"], "Floor"],
    ],
  ],
  [
    "z-bedroom",
    "bedside",
    "Bedside table",
    -10,
    [
      ["Paracetamol", ["paracetamol", "tablet"], "Top"],
      ["Reading glasses", ["glasses", "reading"], "Top"],
      ["Phone charger", ["charger", "cable"], "Drawer 1"],
      ["Notebook and pen", ["notebook", "pen"], "Drawer 2"],
    ],
  ],
  [
    "z-garage",
    "toolbox",
    "Blue toolbox",
    -12.5,
    [
      ["Socket set", ["tool", "socket"], "Drawer 1"],
      ["10 mm spanner", ["spanner", "wrench", "tool"], "Drawer 2"],
      ["Pliers", ["tool", "pliers"], "Drawer 2"],
      ["Hex key set", ["tool", "hex"], "Drawer 3"],
      ["Screwdriver set", ["tool", "screwdriver"], "Drawer 3"],
      ["Gaffer tape", ["tape", "gaffer"], "Drawer 4"],
      ["Tape measure", ["tool", "measure"], "Drawer 5"],
      ["Cable ties", ["cable tie", "tie"], "Drawer 5"],
    ],
  ],
  [
    "z-garage",
    "bench",
    "Workbench",
    -16,
    [
      ["Clamp", ["tool", "clamp"], "Clamp rack"],
      ["Sandpaper", ["sandpaper", "abrasive"], "Shelf 2"],
      ["Wood screws", ["screw", "fixing"], "Box 2"],
      ["Hammer", ["tool", "hammer"], "Clamp rack"],
      ["Work gloves", ["glove", "work"], "Hook 2"],
    ],
  ],
  [
    "z-garage",
    "bikes",
    "Bike rack",
    -17,
    [
      ["Bike pump", ["bike", "pump"], "Hook 1"],
      ["Spare inner tube", ["bike", "tube"], "Hook 2"],
      ["Helmet", ["bike", "helmet"], "Shelf 1"],
    ],
  ],
  [
    "z-garage",
    "shed",
    "Shed shelf",
    -18.5,
    [
      ["Potting soil", ["garden", "soil"], "Bottom shelf"],
      ["Watering can", ["garden", "water"], "Floor"],
      ["Garden twine", ["garden", "twine"], "Shelf 2"],
      ["Bulbs", ["garden", "bulb"], "Shelf 1"],
    ],
  ],
];

const supermarketItems = supermarketPlaces.flatMap(([, placeKey, , , items]) =>
  items.map(([name, tags, slot, qty]) => ({ place: placeKey, name, tags, slot, qty })),
);
const homeItems = homePlaces.flatMap(([, placeKey, , , items]) =>
  items.map(([name, tags, slot, qty]) => ({ place: placeKey, name, tags, slot, qty })),
);

const superZoneX = {
  ...Object.fromEntries(aisles.map((a) => [a.key, a.x])),
  entrance: 0,
  bakeryzone: 11,
  pharmacyzone: -11,
  checkoutzone: -11,
  stockzone: -11,
};

/* x positions for home places, kept out of the tables above so they read cleanly */
const placeX = {
  coat: 0,
  shoes: -2,
  drawers: -6,
  pantry: -8.5,
  fridge: -3.5,
  tv: 6,
  books: 8.5,
  wardrobe: 6.5,
  bedside: 9.5,
  toolbox: -4.5,
  bench: -8.5,
  bikes: -3,
  shed: -10,
};

const supermarketNodesWithPlaces = [
  ...supermarketNodes,
  ...supermarketPlaces.map(([zoneKey, key, name, y, items]) =>
    node(key, "place", name, superZoneX[zoneKey], y, {
      parentKey: zoneKey,
      landmark: items.length > 7,
    }),
  ),
];

const homeNodesWithPlaces = [
  ...homeNodes,
  ...homePlaces.map(([zoneKey, key, name, y]) =>
    node(key, "place", name, placeX[key] ?? 0, y, {
      parentKey: zoneKey,
      landmark: key === "toolbox",
    }),
  ),
];

const compact = (o) => {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
};

const strip = (seed) =>
  JSON.stringify(
    {
      ...seed,
      nodes: seed.nodes.map((n) => compact(n)),
      edges: seed.edges.map((e) => compact(e)),
      items: seed.items.map((i) => compact(i)),
    },
    null,
    2,
  );

const outDir = path.join(process.cwd(), "seed");
mkdirSync(outDir, { recursive: true });

const supermarket = {
  space: { name: "Greenfield Market" },
  nodes: supermarketNodesWithPlaces,
  edges: supermarketEdges.map(([from, to]) => ({ from, to })),
  items: supermarketItems,
};
const home = {
  space: { name: "Home" },
  nodes: homeNodesWithPlaces,
  edges: homeEdges.map(([from, to]) => ({ from, to })),
  items: homeItems,
};

writeFileSync(path.join(outDir, "supermarket.json"), strip(supermarket));
writeFileSync(path.join(outDir, "home.json"), strip(home));

console.log(
  `supermarket: ${supermarket.nodes.length} nodes, ${supermarket.items.length} items`,
);
console.log(`home: ${home.nodes.length} nodes, ${home.items.length} items`);
void now;
